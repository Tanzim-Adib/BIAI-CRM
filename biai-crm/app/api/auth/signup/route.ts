import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import {
  createSession,
  hashPassword,
  isValidInviteCode,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, email, password, inviteCode } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }
  if (!isValidInviteCode(inviteCode)) {
    return NextResponse.json({ error: "A valid invite code is required to sign up." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(normalizedEmail);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role, invite_code_used) VALUES (?, ?, ?, 'staff', ?)"
    )
    .run(String(name).trim(), normalizedEmail, passwordHash, String(inviteCode).trim());

  const { token, expires } = createSession(Number(info.lastInsertRowid));
  await setSessionCookie(token, expires);

  return NextResponse.json({ ok: true });
}
