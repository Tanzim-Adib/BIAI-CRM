import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Soft-delete only — hides a node from the contact graph, never deletes the
// underlying record. Per AF-11: a High-priority contact can never be
// hidden, so a staff member can't accidentally bury something urgent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const contactId = Number(id);
  const body = await req.json().catch(() => ({}));
  const hide = body.hide !== false;

  if (hide) {
    const highPriorityOpen = db
      .prepare(
        `SELECT COUNT(*) AS n FROM leads
         WHERE contact_id = ? AND priority = 'High' AND resolved_at IS NULL`
      )
      .get(contactId) as any;
    if (highPriorityOpen.n > 0) {
      return NextResponse.json(
        { error: "This contact has an unresolved High-priority lead and can't be hidden from the graph." },
        { status: 400 }
      );
    }
    db.prepare("UPDATE contacts SET hidden_at = datetime('now') WHERE id = ?").run(contactId);
  } else {
    db.prepare("UPDATE contacts SET hidden_at = NULL WHERE id = ?").run(contactId);
  }

  return NextResponse.json({ ok: true });
}
