import db from "./db";
import { extractLead } from "./gemini";
import {
  quickExtractPhone,
  quickExtractEmail,
  findContactByPhone,
  findContactByEmail,
  findContactByNameAndChannel,
  findExactDuplicateLead,
  buildPriorContext,
} from "./contact-match";

// Shared by both the in-app Intake form (app/api/intake) and the n8n
// webhook (app/api/webhook/intake), so both paths insert identically.
export async function createLeadFromText(
  rawText: string,
  channel: string | null,
  userId: number | null
) {
  // 1. Exact-duplicate guard — the same raw message pasted twice (accidental
  // double-submit, or re-pasting the same WhatsApp export) should never
  // create a second lead. Skips the AI call entirely when it fires.
  const existingDuplicate = findExactDuplicateLead(rawText);
  if (existingDuplicate) {
    const contact = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(existingDuplicate.contact_id);
    return { lead: existingDuplicate, contact, duplicate: true };
  }

  // 2. Pre-extract phone/email via regex BEFORE calling the AI, so that if
  // this sender is already known, their prior history can be handed to the
  // AI as context in the same request (rather than needing a second
  // round-trip after the AI extracts the phone itself).
  const quickPhone = quickExtractPhone(rawText);
  const quickEmail = quickExtractEmail(rawText);
  const preMatch =
    findContactByPhone(quickPhone) ?? findContactByEmail(quickEmail) ?? null;
  const priorContext = preMatch ? buildPriorContext(preMatch.id) : null;

  const extracted = await extractLead(rawText, priorContext);

  // 3. Final contact matching using the AI-extracted fields. Only phone and
  // email are treated as strong enough to auto-merge records and surface
  // prior history — names repeat across different real people (two
  // different "Sadman Sakib"s on two different channels is a real case,
  // not an edge case), so a name-only match is NEVER auto-merged or used
  // to reuse a contact_id. It's recorded separately as `possibleContact`
  // and surfaced as a heads-up for a human to resolve by asking, not
  // something the system assumes or leaks prior details over.
  let matchedContact =
    findContactByPhone(extracted.contact_phone) ??
    findContactByEmail(extracted.contact_email) ??
    preMatch;

  const possibleContact = matchedContact
    ? null
    : findContactByNameAndChannel(extracted.contact_name, channel);

  let contactId: number;
  if (matchedContact) {
    contactId = matchedContact.id;
    // Enrich blank fields on the existing contact rather than losing newly
    // learned info (e.g. they'd only given a name before, now gave a phone).
    const updates: string[] = [];
    const params: any[] = [];
    if (!matchedContact.phone && extracted.contact_phone) {
      updates.push("phone = ?");
      params.push(extracted.contact_phone);
    }
    if (!matchedContact.email && extracted.contact_email) {
      updates.push("email = ?");
      params.push(extracted.contact_email);
    }
    if (!matchedContact.org && extracted.contact_org) {
      updates.push("org = ?");
      params.push(extracted.contact_org);
    }
    if (!matchedContact.name && extracted.contact_name) {
      updates.push("name = ?");
      params.push(extracted.contact_name);
    }
    if (updates.length > 0) {
      params.push(contactId);
      db.prepare(`UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }
  } else {
    const contactInfo = db
      .prepare(
        "INSERT INTO contacts (name, phone, email, org, channel) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        extracted.contact_name,
        extracted.contact_phone,
        extracted.contact_email,
        extracted.contact_org,
        channel ?? null
      );
    contactId = Number(contactInfo.lastInsertRowid);
  }

  const reminderAt =
    extracted.lead_verdict === "Lead"
      ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      : null;

  const leadInfo = db
    .prepare(
      `INSERT INTO leads
        (contact_id, raw_text, channel, category, priority, lead_verdict,
         lead_reasoning, estimated_value, suggested_reply, stage,
         assigned_to, reminder_at, possible_contact_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
    )
    .run(
      contactId,
      rawText,
      channel ?? null,
      extracted.category,
      extracted.priority,
      extracted.lead_verdict,
      extracted.lead_reasoning,
      extracted.estimated_value,
      extracted.suggested_reply,
      userId,
      reminderAt,
      possibleContact?.id ?? null
    );
  const leadId = Number(leadInfo.lastInsertRowid);

  db.prepare(
    "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'created', ?)"
  ).run(
    leadId,
    userId,
    matchedContact
      ? `Intake via ${channel ?? "unspecified channel"} (matched existing contact)`
      : possibleContact
        ? `Intake via ${channel ?? "unspecified channel"} (possible name match — unconfirmed, not merged)`
        : `Intake via ${channel ?? "unspecified channel"}`
  );

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);

  return {
    lead,
    contact,
    duplicate: false,
    possibleContact: possibleContact
      ? { id: possibleContact.id, name: possibleContact.name }
      : null,
  };
}
