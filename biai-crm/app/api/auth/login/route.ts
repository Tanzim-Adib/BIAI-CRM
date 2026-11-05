import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = db
    .prepare("SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = ?")
    .get(normalizedEmail) as
    | { id: number; name: string; email: string; password_hash: string; role: string }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const { token, expires } = createSession(user.id);
  await setSessionCookie(token, expires);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
