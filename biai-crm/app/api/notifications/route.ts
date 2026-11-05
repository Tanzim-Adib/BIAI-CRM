import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runEscalationCheck } from "@/lib/escalation";

// Real, computed notifications — no external service, no polling delay.
// Three kinds: escalated (High-priority, unactioned 72h+), overdue (past the
// 48h reminder but not yet escalated), and unclaimed (sitting with nobody
// having hit "Lead taken"). This is what the bell icon reads from.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  runEscalationCheck();

  const escalated = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.escalated = 1 AND l.resolved_at IS NULL
       ORDER BY l.updated_at DESC`
    )
    .all();

  const overdue = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, l.reminder_at, c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.reminder_at IS NOT NULL
         AND l.reminder_at < datetime('now')
         AND l.resolved_at IS NULL
         AND l.escalated = 0
         AND l.stage NOT IN ('paid', 'lost')
       ORDER BY l.reminder_at ASC`
    )
    .all();

  const unclaimed = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.taken_by IS NULL AND l.resolved_at IS NULL AND l.lead_verdict = 'Lead'
         AND l.stage NOT IN ('paid', 'lost')
       ORDER BY l.created_at DESC
       LIMIT 10`
    )
    .all();

  // High-priority items need attention right away, whether or not they're a
  // "Lead" — a complaint is never a sales lead, but it's the most urgent
  // thing in the inbox. Without this, something like an angry refund request
  // could sit silently until its 48h reminder fires, which defeats the
  // point of marking it High priority at all.
  const needsAttention = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.priority = 'High' AND l.taken_by IS NULL AND l.resolved_at IS NULL
         AND l.escalated = 0
         AND l.stage NOT IN ('paid', 'lost')
       ORDER BY l.created_at DESC
       LIMIT 10`
    )
    .all();

  return NextResponse.json({
    escalated,
    overdue,
    unclaimed,
    needsAttention,
    total: escalated.length + overdue.length + needsAttention.length,
  });
}
