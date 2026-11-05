import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runEscalationCheck } from "@/lib/escalation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  runEscalationCheck();

  const escalated = db.prepare("SELECT l.id, l.external_id, l.category, l.priority, l.stage, l.next_escalation_at, c.name AS contact_name, c.org AS contact_org FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.escalated = 1 AND l.resolved_at IS NULL AND l.stage NOT IN ('paid','lost') ORDER BY l.next_escalation_at ASC").all();
  const overdue = db.prepare("SELECT l.id, l.category, l.priority, l.stage, l.reminder_at, c.name AS contact_name, c.org AS contact_org FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.reminder_at IS NOT NULL AND datetime(l.reminder_at) <= datetime('now') AND l.resolved_at IS NULL AND l.stage NOT IN ('paid','lost') ORDER BY l.reminder_at ASC").all();
  const followUpTimers = db.prepare("SELECT l.id, l.external_id, l.category, l.stage, l.reminder_at, c.name AS contact_name FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.reminder_at IS NOT NULL AND datetime(l.reminder_at) > datetime('now') AND l.resolved_at IS NULL AND l.stage NOT IN ('paid','lost') ORDER BY l.reminder_at ASC LIMIT 25").all();
  const unclaimed = db.prepare("SELECT l.id, l.category, l.priority, l.stage, c.name AS contact_name, c.org AS contact_org FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.taken_by IS NULL AND l.resolved_at IS NULL AND l.lead_verdict = 'Lead' AND l.stage NOT IN ('paid','lost') ORDER BY l.created_at DESC LIMIT 10").all();
  const needsAttention = db.prepare("SELECT l.id, l.category, l.priority, l.stage, c.name AS contact_name, c.org AS contact_org FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.priority = 'High' AND l.taken_by IS NULL AND l.resolved_at IS NULL AND l.escalated = 0 AND l.stage NOT IN ('paid','lost') ORDER BY l.created_at DESC LIMIT 10").all();

  return NextResponse.json({ escalated, overdue, followUpTimers, unclaimed, needsAttention, total: (escalated as any[]).length + (overdue as any[]).length + (needsAttention as any[]).length });
}
