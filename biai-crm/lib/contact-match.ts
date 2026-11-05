import db from "./db";

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 3 && normalized.includes("@") ? normalized : null;
}

const BD_PHONE_RE = /(?:\+?880|0)1[3-9]\d{8}/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export function quickExtractPhone(rawText: string) {
  return rawText.match(BD_PHONE_RE)?.[0] ?? null;
}
export function quickExtractEmail(rawText: string) {
  return rawText.match(EMAIL_RE)?.[0] ?? null;
}

export type KnownContact = {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  org: string | null;
  person_id?: string | null;
};

// Matching is only a warning signal. A phone number may be shared, so this
// never selects a contact to merge or reuse automatically.
export function findPossibleContact(name: string | null, phone: string | null, email: string | null): KnownContact | null {
  if (!name?.trim()) return null;
  const nameKey = name.trim().toLocaleLowerCase();
  const phoneKey = normalizePhone(phone);
  const emailKey = normalizeEmail(email);
  if (!phoneKey && !emailKey) return null;

  const contacts = db.prepare("SELECT id, name, phone, email, org, person_id FROM contacts WHERE name IS NOT NULL").all() as KnownContact[];
  return contacts.find((contact) => {
    if (contact.name?.trim().toLocaleLowerCase() !== nameKey) return false;
    return Boolean(
      (phoneKey && normalizePhone(contact.phone) === phoneKey) ||
      (emailKey && normalizeEmail(contact.email) === emailKey)
    );
  }) ?? null;
}

export function findExactDuplicateLead(rawText: string) {
  return db.prepare("SELECT * FROM leads WHERE TRIM(raw_text) = ? ORDER BY created_at DESC LIMIT 1")
    .get(rawText.trim()) as any;
}
