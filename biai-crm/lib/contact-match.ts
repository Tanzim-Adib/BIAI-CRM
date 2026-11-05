import db from "./db";

// Phone can't be a reliable join key on its own — it's blank on Facebook
// Messenger/comments, and formats vary (+8801711000001, 01711000001,
// 1711 000001...). This module tries several signals, in order of
// reliability, rather than trusting any single field.

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Compare on the last 10 digits, which is stable across +880/0/no-prefix
  // formats for Bangladeshi numbers.
  return digits.slice(-10);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.length > 3 && e.includes("@") ? e : null;
}

// Cheap regex pre-extraction, run BEFORE the AI call, so a known contact's
// history can be handed to the AI as context on the same request — rather
// than needing a second round-trip once the AI itself extracts the phone.
const BD_PHONE_RE = /(?:\+?880|0)1[3-9]\d{8}/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function quickExtractPhone(rawText: string): string | null {
  const m = rawText.match(BD_PHONE_RE);
  return m ? m[0] : null;
}

export function quickExtractEmail(rawText: string): string | null {
  const m = rawText.match(EMAIL_RE);
  return m ? m[0] : null;
}

export type KnownContact = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  org: string | null;
};

export function findContactByPhone(phone: string | null): KnownContact | null {
  const norm = normalizePhone(phone);
  if (!norm) return null;
  const rows = db.prepare("SELECT id, name, phone, email, org FROM contacts").all() as KnownContact[];
  return rows.find((c) => normalizePhone(c.phone) === norm) ?? null;
}

export function findContactByEmail(email: string | null): KnownContact | null {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  const rows = db.prepare("SELECT id, name, phone, email, org FROM contacts").all() as KnownContact[];
  return rows.find((c) => normalizeEmail(c.email) === norm) ?? null;
}

// Weakest signal — only used when phone/email give nothing (e.g. Facebook
// Messenger with no phone). Scoped to the same channel and an exact,
// trimmed, case-insensitive name match to limit false merges; still
// imperfect (two different "Rafi" on WhatsApp would wrongly merge), which
// is inherent to the brief's paste-box model having no account/login tying
// messages to a real identity — flagged here rather than silently assumed.
export function findContactByNameAndChannel(name: string | null, channel: string | null): KnownContact | null {
  if (!name || name.trim().length < 2) return null;
  const normName = name.trim().toLowerCase();
  const rows = db
    .prepare("SELECT id, name, phone, email, org FROM contacts WHERE channel = ?")
    .all(channel) as KnownContact[];
  return rows.find((c) => (c.name ?? "").trim().toLowerCase() === normName) ?? null;
}

// Exact-duplicate guard: the same raw message pasted twice (a staff member
// accidentally double-submitting, or copy-pasting the same WhatsApp export
// a second time) should never create a second lead record.
export function findExactDuplicateLead(rawText: string) {
  const trimmed = rawText.trim();
  return db
    .prepare("SELECT * FROM leads WHERE TRIM(raw_text) = ? ORDER BY created_at DESC LIMIT 1")
    .get(trimmed) as any;
}

// Builds the "you've seen this contact before" context block handed to the
// AI, when a pre-extraction phone/email match finds someone. Kept short —
// a few past leads' gist, not full raw text dumps, to avoid bloating the
// prompt.
export function buildPriorContext(contactId: number): string | null {
  const past = db
    .prepare(
      `SELECT category, priority, lead_verdict, stage, resolved_at,
              substr(raw_text, 1, 200) AS snippet, created_at
       FROM leads WHERE contact_id = ? ORDER BY created_at DESC LIMIT 5`
    )
    .all(contactId) as any[];

  if (past.length === 0) return null;

  const lines = past.map(
    (p) =>
      `- [${p.created_at}] ${p.category} (${p.priority} priority, ${p.lead_verdict}, stage: ${p.stage}${p.resolved_at ? ", resolved" : ", NOT resolved"}): "${p.snippet}"`
  );
  return `This sender has contacted BIAI before. Prior enquiries from them:\n${lines.join("\n")}`;
}
