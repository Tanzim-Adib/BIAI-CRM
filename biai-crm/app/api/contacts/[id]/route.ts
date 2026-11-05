import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// A single contact plus every lead tied to them (their full thread history)
// and the activity log across those leads — the detail view for the
// Contacts tab, and the data a contact-graph node expands into.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const contactId = Number(id);

  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);
  if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const leads = db
    .prepare(
      `SELECT l.*, u.name AS assigned_to_name
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.contact_id = ?
       ORDER BY l.created_at DESC`
    )
    .all(contactId);

  const leadIds = (leads as any[]).map((l) => l.id);
  const activity =
    leadIds.length > 0
      ? db
          .prepare(
            `SELECT a.*, u.name AS user_name
             FROM activity_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.lead_id IN (${leadIds.map(() => "?").join(",")})
             ORDER BY a.created_at DESC`
          )
          .all(...leadIds)
      : [];

  return NextResponse.json({ contact, leads, activity });
}

// Lets staff correct the AI-extracted name/phone/org when it got it wrong
// (e.g. misread a name from a WhatsApp signature, or missed a phone number).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const contactId = Number(id);
  const body = await req.json();

  const existing = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId) as any;
  if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const editableFields = ["name", "phone", "email", "org"] as const;
  const updates: string[] = [];
  const values: any[] = [];
  for (const field of editableFields) {
    if (body[field] !== undefined && body[field] !== existing[field]) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, contact: existing });
  }

  values.push(contactId);
  db.prepare(`UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(contactId);
  return NextResponse.json({ ok: true, contact });
}
