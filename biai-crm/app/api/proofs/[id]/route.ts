import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Only an admin can review payment proof." }, { status: 403 });
  const { id } = await params;
  const proofId = Number(id);
  const { approved } = await req.json();
  if (typeof approved !== "boolean") return NextResponse.json({ error: "approved must be boolean." }, { status: 400 });
  const proof = db.prepare("SELECT * FROM lead_stage_proof WHERE id = ? AND stage = 'paid'").get(proofId) as any;
  if (!proof) return NextResponse.json({ error: "Payment proof not found." }, { status: 404 });
  db.transaction(() => {
    db.prepare("UPDATE lead_stage_proof SET approval_status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?")
      .run(approved ? "approved" : "rejected", user.id, proofId);
    if (approved) {
      db.prepare("UPDATE leads SET coin_status = 'approved' WHERE id = ? AND stage = 'paid'").run(proof.lead_id);
    } else {
      db.prepare("UPDATE leads SET coin_status = 'not_eligible' WHERE id = ?").run(proof.lead_id);
    }
  })();
  return NextResponse.json({ ok: true });
}
