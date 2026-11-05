import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import db from "./db";

const SESSION_COOKIE = "biai_session";
const SESSION_DAYS = 7;
const CONFIGURED_INVITE = (process.env.INVITE_CODE || process.env.NEXT_PUBLIC_INVITE_CODE || "").trim();

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expires.toISOString());
  return { token, expires };
}

export async function setSessionCookie(token: string, expires: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as
    | { id: number; name: string; email: string; role: string; expires_at: string }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

export function isValidInviteCode(code: string) {
  if (typeof code !== "string") return false;
  const trimmed = code.trim();
  if (!trimmed) return false;
  if (CONFIGURED_INVITE) return trimmed === CONFIGURED_INVITE;
  return trimmed.length >= 4;
}
