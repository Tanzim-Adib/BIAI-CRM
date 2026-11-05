import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Per contact, rolls up their most urgent lead into one node's worth of
// data — this is AF-11's node-per-contact graph, built on the same data as
// everything else (no new fields beyond what AF-10/AF-6 already produce).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const rows = db
    .prepare(
      `SELECT
         c.id, c.name, c.org, c.channel, c.ai_summary, c.hidden_at,
         l.id AS lead_id, l.category, l.priority, l.stage, l.lead_verdict,
         l.lead_reasoning, l.estimated_value, l.escalated, l.resolved_at,
         l.taken_by, u.name AS taken_by_name, l.created_at AS lead_created_at
       FROM contacts c
       LEFT JOIN leads l ON l.id = (
         SELECT id FROM leads
         WHERE contact_id = c.id
         ORDER BY
           CASE priority WHEN 'High' THEN 0 ELSE 1 END,
           created_at DESC
         LIMIT 1
       )
       LEFT JOIN users u ON u.id = l.taken_by
       ORDER BY c.id`
    )
    .all() as any[];

  const nodes = rows.map((r) => ({
    id: r.id,
    name: r.name ?? "Unknown",
    org: r.org,
    channel: r.channel,
    aiSummary: r.ai_summary,
    hidden: !!r.hidden_at,
    leadId: r.lead_id,
    category: r.category,
    priority: r.priority,
    stage: r.stage,
    leadVerdict: r.lead_verdict,
    leadReasoning: r.lead_reasoning,
    estimatedValue: r.estimated_value,
    escalated: !!r.escalated,
    resolved: !!r.resolved_at,
    takenByName: r.taken_by_name,
    needsAction: !!r.escalated && !r.resolved_at,
  }));

  return NextResponse.json({ nodes });
}
