import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || null;
  const stage = url.searchParams.get("stage") || null;
  const priority = url.searchParams.get("priority") || null;
  const from = url.searchParams.get("from") || null;
  const to = url.searchParams.get("to") || null;

  let sql = `
    SELECT l.id, l.contact_id, l.person_id, l.category, l.priority, l.stage, l.lead_verdict, l.created_at,
           c.name AS contact_name, c.org AS contact_org, c.person_id AS person_key
    FROM leads l
    LEFT JOIN contacts c ON c.id = l.contact_id
    WHERE 1 = 1
  `;
  const params: any[] = [];

  if (category) {
    sql += " AND l.category = ?";
    params.push(category);
  }
  if (stage) {
    sql += " AND l.stage = ?";
    params.push(stage);
  }
  if (priority) {
    sql += " AND l.priority = ?";
    params.push(priority);
  }
  if (from) {
    sql += " AND l.created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND l.created_at <= ?";
    params.push(to);
  }

  sql += " ORDER BY l.created_at DESC";

  const rows = db.prepare(sql).all(...params) as any[];

  const personNodes: any[] = [];
  const nodes: any[] = [];
  const links: any[] = [];
  const seenPersons = new Map<string, string>();

  for (const row of rows) {
    const personKey = row.person_key || row.person_id || `contact:${row.contact_id}`;
    if (!seenPersons.has(personKey)) {
      const personId = `person:${personKey}`;
      seenPersons.set(personKey, personId);
      personNodes.push({
        id: personId,
        type: "person",
        name: row.contact_name || "Unknown",
        org: row.contact_org || null,
      });
    }

    const leadId = `lead:${row.id}`;
    nodes.push({
      id: leadId,
      type: "lead",
      leadId: row.id,
      personId: seenPersons.get(personKey),
      name: row.contact_name || "Unknown",
      category: row.category,
      stage: row.stage,
      priority: row.priority,
      verdict: row.lead_verdict,
      createdAt: row.created_at,
      hidden: false,
    });
    links.push({ source: seenPersons.get(personKey), target: leadId });
  }

  return NextResponse.json({ nodes: [...personNodes, ...nodes], links });
}
