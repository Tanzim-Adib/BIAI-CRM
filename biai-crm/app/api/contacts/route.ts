import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// One row per contact, with their lead count and most recent stage — this is
// what both the Contacts tab and the contact-graph view (AF-11) read from.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const contacts = db
    .prepare(
      `SELECT c.*,
              COUNT(l.id) AS lead_count,
              MAX(l.created_at) AS last_contact_at,
              (SELECT stage FROM leads WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_stage,
              (SELECT lead_verdict FROM leads WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_verdict
       FROM contacts c
       LEFT JOIN leads l ON l.contact_id = c.id
       GROUP BY c.id
       ORDER BY last_contact_at DESC`
    )
    .all();

  return NextResponse.json({ contacts });
}
