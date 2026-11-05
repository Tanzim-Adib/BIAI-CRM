import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Feeds the coin/reward widget. Two counts, both tied to "taken_by" — the
// explicit claim action — since that's the real signal of "this rep worked
// this lead," independent of who the AI originally assigned it to.
// No monetary figures here on purpose: commission amounts vary by deal size
// and tier, so a dashboard animation showing a guessed taka amount would be
// a liability if it turned out wrong. Coins/counts only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const paid = db
    .prepare("SELECT COUNT(*) AS count FROM leads WHERE taken_by = ? AND stage = 'paid'")
    .get(user.id) as any;

  const totalTaken = db
    .prepare("SELECT COUNT(*) AS count FROM leads WHERE taken_by = ?")
    .get(user.id) as any;

  return NextResponse.json({
    paidCount: paid.count,
    totalTaken: totalTaken.count,
  });
}
