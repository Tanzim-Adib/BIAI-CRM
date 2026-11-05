import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const paid = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE taken_by = ? AND stage = 'paid' AND coin_status = 'approved'").get(user.id) as any;
  const totalTaken = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE taken_by = ?").get(user.id) as any;
  return NextResponse.json({ paidCount: paid.count, totalTaken: totalTaken.count });
}
