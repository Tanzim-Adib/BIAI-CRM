import crypto from "crypto";
import db from "./db";
import { extractLead } from "./gemini";
import { findExactDuplicateLead, findPossibleContact } from "./contact-match";

export async function createLeadFromText(rawText: string, channel: string | null, userId: number | null) {
  const trimmedText = rawText.trim();
  const duplicate = findExactDuplicateLead(trimmedText);
  if (duplicate) {
    const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(duplicate.contact_id);
    return { lead: duplicate, contact, duplicate: true, possibleContact: null };
  }

  // Do not merge on a shared phone/email. Create a distinct person record and
  // only surface a candidate warning when name plus an identifier also match.
  const extracted = await extractLead(trimmedText);
  const possibleContact = findPossibleContact(
    extracted.contact_name,
    extracted.contact_phone,
    extracted.contact_email
  );
  const personId = `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const contactResult = db.prepare(
    "INSERT INTO contacts (person_id, name, phone, email, org, channel) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(personId, extracted.contact_name, extracted.contact_phone, extracted.contact_email, extracted.contact_org, channel);
  const contactId = Number(contactResult.lastInsertRowid);
  const externalId = `E-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const reminderAt = extracted.lead_verdict === "Lead"
    ? new Date(Date.now() + Number(process.env.FOLLOW_UP_MS || 48 * 60 * 60 * 1000)).toISOString()
    : null;

  const leadResult = db.prepare(
    `INSERT INTO leads (external_id, person_id, contact_id, raw_text, channel, category, priority,
      lead_verdict, lead_reasoning, estimated_value, suggested_reply, stage, assigned_to, reminder_at, possible_contact_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
  ).run(externalId, personId, contactId, trimmedText, channel, extracted.category, extracted.priority,
    extracted.lead_verdict, extracted.lead_reasoning, extracted.estimated_value, extracted.suggested_reply,
    userId, reminderAt, possibleContact?.id ?? null);
  const leadId = Number(leadResult.lastInsertRowid);

  db.prepare("INSERT INTO lead_messages (message_id, lead_id, channel, body) VALUES (?, ?, ?, ?)")
    .run(`M-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, leadId, channel, trimmedText);
  db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'created', ?)")
    .run(leadId, userId, `Intake via ${channel ?? "unspecified channel"}${possibleContact ? " (possible identity match; not merged)" : ""}`);

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);
  return {
    lead,
    contact,
    duplicate: false,
    possibleContact: possibleContact ? { id: possibleContact.id, name: possibleContact.name, personId: possibleContact.person_id } : null,
  };
}
