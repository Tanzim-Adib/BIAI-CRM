import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { runEscalationCheck } from "@/lib/escalation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  runEscalationCheck();

  const byStage = db
    .prepare("SELECT stage, COUNT(*) AS count FROM leads GROUP BY stage")
    .all();

  const byCategory = db
    .prepare(
      "SELECT category, COUNT(*) AS count FROM leads GROUP BY category ORDER BY count DESC LIMIT 8"
    )
    .all();

  const byPriority = db
    .prepare("SELECT priority, COUNT(*) AS count FROM leads GROUP BY priority")
    .all();

  const leadVsNot = db
    .prepare("SELECT lead_verdict, COUNT(*) AS count FROM leads GROUP BY lead_verdict")
    .all();

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total_leads,
              SUM(CASE WHEN lead_verdict = 'Lead' THEN 1 ELSE 0 END) AS total_qualified,
              SUM(CASE WHEN stage = 'paid' THEN 1 ELSE 0 END) AS total_paid,
              SUM(CASE WHEN escalated = 1 THEN 1 ELSE 0 END) AS total_escalated
       FROM leads`
    )
    .get();

  // Leads whose 48h reminder has passed and are still sitting unresolved —
  // what the "needs follow-up" widget and escalation logic both key off.
  const overdue = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, l.reminder_at,
              c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       WHERE l.reminder_at IS NOT NULL
         AND l.reminder_at < datetime('now')
         AND l.resolved_at IS NULL
         AND l.stage NOT IN ('paid', 'lost')
       ORDER BY l.reminder_at ASC`
    )
    .all();

  const recent = db
    .prepare(
      `SELECT l.id, l.category, l.priority, l.stage, l.created_at,
              c.name AS contact_name, c.org AS contact_org
       FROM leads l JOIN contacts c ON c.id = l.contact_id
       ORDER BY l.created_at DESC LIMIT 8`
    )
    .all();

  return NextResponse.json({ byStage, byCategory, byPriority, leadVsNot, totals, overdue, recent });
}
