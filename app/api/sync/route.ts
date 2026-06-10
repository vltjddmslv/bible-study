import { NextResponse } from "next/server";
import { readDb, writeDb, UserData } from "@/lib/db";

// GET handler: Download progress from the server
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");
    const token = searchParams.get("token");

    if (!username || !token) {
      return NextResponse.json(
        { error: "인증 정보가 필요합니다." },
        { status: 401 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await readDb();
    const user = db.users[cleanUsername];

    if (!user || user.token !== token) {
      return NextResponse.json(
        { error: "유효하지 않은 로그인 세션입니다." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: user.progress || {},
      notes: user.notes || {},
      studyHistory: user.studyHistory || [],
      completedDays: user.completedDays || {},
      studyPlan: user.studyPlan || null,
      updatedAt: user.updatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST handler: Upload and merge progress to the server
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, token, progress, notes, studyHistory, completedDays, studyPlan } = body;

    if (!username || !token) {
      return NextResponse.json(
        { error: "인증 정보가 필요합니다." },
        { status: 401 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = await readDb();
    const user = db.users[cleanUsername];

    if (!user || user.token !== token) {
      return NextResponse.json(
        { error: "유효하지 않은 로그인 세션입니다." },
        { status: 401 }
      );
    }

    // --- SMART CUMULATIVE MERGE ON SERVER ---
    
    // 1. Merge Progress (learned > reviewing > unlearned)
    const mergedProgress = { ...(user.progress || {}) };
    if (progress) {
      Object.keys(progress).forEach((key) => {
        const serverStatus = mergedProgress[key] || "unlearned";
        const clientStatus = progress[key];
        if (clientStatus === "learned") {
          mergedProgress[key] = "learned";
        } else if (clientStatus === "reviewing" && serverStatus !== "learned") {
          mergedProgress[key] = "reviewing";
        }
      });
    }

    // 2. Merge Completed Days (Union of completed days)
    const mergedCompleted = { ...(user.completedDays || {}) };
    if (completedDays) {
      Object.keys(completedDays).forEach((dayStr) => {
        if (completedDays[dayStr]) {
          mergedCompleted[dayStr] = true;
        }
      });
    }

    // 3. Merge Notes (Keep longer note)
    const mergedNotes = { ...(user.notes || {}) };
    if (notes) {
      Object.keys(notes).forEach((key) => {
        const serverNote = mergedNotes[key] || "";
        const clientNote = notes[key] || "";
        if (clientNote.length > serverNote.length) {
          mergedNotes[key] = clientNote;
        }
      });
    }

    // 4. Merge Study History (Union by date, keeping highest count)
    const mergedHistory = [...(user.studyHistory || [])];
    if (studyHistory) {
      studyHistory.forEach((clientRec: any) => {
        const serverIdx = mergedHistory.findIndex((h) => h.date === clientRec.date);
        if (serverIdx >= 0) {
          mergedHistory[serverIdx].count = Math.max(mergedHistory[serverIdx].count, clientRec.count);
        } else {
          mergedHistory.push(clientRec);
        }
      });
    }

    // Save back to DB
    user.progress = mergedProgress;
    user.completedDays = mergedCompleted;
    user.notes = mergedNotes;
    user.studyHistory = mergedHistory;
    if (studyPlan !== undefined) {
      user.studyPlan = studyPlan;
    }
    user.updatedAt = new Date().toISOString();

    await writeDb(db);

    return NextResponse.json({
      success: true,
      message: "진행 기록이 클라우드 서버에 동기화(병합) 완료되었습니다.",
      updatedAt: user.updatedAt,
      // Return merged state so client can optionally sync back
      data: {
        progress: mergedProgress,
        completedDays: mergedCompleted,
        notes: mergedNotes,
        studyHistory: mergedHistory,
        studyPlan: user.studyPlan || null,
      }
    });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
