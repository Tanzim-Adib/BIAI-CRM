import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const REQUIRED_PROOF_STAGES = new Set(["contacted", "interested", "paid"]);
const VALID_STAGES = new Set(["new", "contacted", "interested", "paid", "lost"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return NextResponse.json({ error: "Invalid lead ID." }, { status: 400 });

  const body = await req.json();
  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.stage !== undefined && body.stage !== existing.stage) {
    if (!VALID_STAGES.has(body.stage)) return NextResponse.json({ error: "Invalid pipeline stage." }, { status: 400 });
    if (REQUIRED_PROOF_STAGES.has(body.stage)) {
      const proofCount = (db.prepare("SELECT COUNT(*) AS count FROM lead_stage_proof WHERE lead_id = ? AND stage = ?").get(leadId, body.stage) as { count: number }).count;
      if (!proofCount) return NextResponse.json({ error: `Upload PNG/JPEG evidence for ${body.stage} before changing the stage.` }, { status: 400 });
    }
    if (body.stage === "paid") {
      updates.push("coin_status = ?");
      values.push("pending_approval");
    } else if (existing.stage === "paid") {
      updates.push("coin_status = ?");
      values.push("not_eligible");
    }
    updates.push("stage = ?");
    values.push(body.stage);
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'stage_changed', ?)")
      .run(leadId, user.id, `${existing.stage} -> ${body.stage}`);
  }

  if (body.assigned_to !== undefined && body.assigned_to !== existing.assigned_to) {
    updates.push("assigned_to = ?"); values.push(body.assigned_to);
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'reassigned', ?)")
      .run(leadId, user.id, `Reassigned to user #${body.assigned_to}`);
  }
  if (body.take === true && !existing.taken_by) {
    updates.push("taken_by = ?", "taken_at = datetime('now')"); values.push(user.id);
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'taken', ?)").run(leadId, user.id, `${user.name} took this lead`);
  } else if (body.take === false && existing.taken_by === user.id) {
    updates.push("taken_by = NULL", "taken_at = NULL");
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'taken', ?)").run(leadId, user.id, "Released back to unclaimed");
  }

  if (body.resolve === true && !existing.resolved_at) {
    updates.push("resolved_at = datetime('now')", "escalated = 0", "next_escalation_at = NULL");
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'resolved', ?)").run(leadId, user.id, `Resolved by ${user.name}`);
  } else if (body.resolve === false && existing.resolved_at) {
    updates.push("resolved_at = NULL");
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'resolved', ?)").run(leadId, user.id, "Reopened");
  }

  if (body.escalated !== undefined && Boolean(body.escalated) !== Boolean(existing.escalated)) {
    updates.push("escalated = ?", "escalated_at = ?", "next_escalation_at = ?");
    values.push(body.escalated ? 1 : 0, body.escalated ? new Date().toISOString() : null,
      body.escalated ? new Date(Date.now() + Number(process.env.ESCALATION_INTERVAL_MS || 12 * 60 * 60 * 1000)).toISOString() : null);
    db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'escalated', ?)").run(leadId, user.id, body.escalated ? "Escalated" : "De-escalated");
  }

  const editableFields = ["category", "priority", "lead_verdict", "lead_reasoning", "estimated_value", "suggested_reply"] as const;
  const edited: string[] = [];
  for (const field of editableFields) {
    if (body[field] !== undefined && body[field] !== existing[field]) { updates.push(`${field} = ?`); values.push(body[field]); edited.push(field); }
  }
  if (edited.length) db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'edited', ?)").run(leadId, user.id, `Staff corrected: ${edited.join(", ")}`);

  if (!updates.length) return NextResponse.json({ ok: true, lead: existing });
  updates.push("updated_at = datetime('now')"); values.push(leadId);
  db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true, lead: db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) });
}
