import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const proofs = db.prepare("SELECT id, lead_id, stage, file_name, file_mime, uploaded_by, approval_status, reviewed_by, reviewed_at, created_at FROM lead_stage_proof WHERE lead_id = ? ORDER BY created_at DESC").all(Number(id));
  return NextResponse.json({ proofs });
}
