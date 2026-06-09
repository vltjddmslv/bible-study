import { NextResponse } from "next/server";
import { readDb, writeDb, hashPassword, generateSalt } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    
    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { error: "아이디는 3글자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "비밀번호는 4글자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const db = readDb();

    if (db.users[cleanUsername]) {
      return NextResponse.json(
        { error: "이미 존재하는 아이디입니다." },
        { status: 400 }
      );
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);

    db.users[cleanUsername] = {
      passwordHash,
      salt,
      progress: {},
      notes: {},
      studyHistory: [],
      completedDays: {},
      updatedAt: new Date().toISOString(),
    };

    writeDb(db);

    return NextResponse.json({ success: true, message: "회원가입 완료!" });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
