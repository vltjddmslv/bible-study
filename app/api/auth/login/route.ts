import { NextResponse } from "next/server";
import { readDb, writeDb, hashPassword } from "@/lib/db";
import crypto from "crypto";

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
    const db = readDb();
    const user = db.users[cleanUsername];

    if (!user) {
      return NextResponse.json(
        { error: "존재하지 않는 아이디입니다." },
        { status: 400 }
      );
    }

    const inputHash = hashPassword(password, user.salt);

    if (inputHash !== user.passwordHash) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 400 }
      );
    }

    // Generate a secure session token
    const token = crypto.randomBytes(32).toString("hex");
    
    // Save token in the DB
    user.token = token;
    user.updatedAt = new Date().toISOString();
    
    writeDb(db);

    return NextResponse.json({
      success: true,
      username: cleanUsername,
      token,
      message: "로그인 성공!",
    });
  } catch (e) {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
