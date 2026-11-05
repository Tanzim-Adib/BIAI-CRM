import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  db.prepare("UPDATE leads SET last_seen_at = ?, updated_at = datetime('now') WHERE id = ?").run(new Date().toISOString(), leadId);
  db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'viewed', 'Enquiry opened in Pipeline')").run(leadId, user.id);
  return NextResponse.json({ ok: true });
}
