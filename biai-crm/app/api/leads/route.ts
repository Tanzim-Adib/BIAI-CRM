import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const leads = db
    .prepare(
      `SELECT l.*, c.name AS contact_name, c.phone AS contact_phone,
              c.email AS contact_email, c.org AS contact_org,
              u.name AS assigned_to_name,
              t.name AS taken_by_name,
              p.name AS possible_contact_name
       FROM leads l
       JOIN contacts c ON c.id = l.contact_id
       LEFT JOIN users u ON u.id = l.assigned_to
       LEFT JOIN users t ON t.id = l.taken_by
       LEFT JOIN contacts p ON p.id = l.possible_contact_id
       ORDER BY l.created_at DESC`
    )
    .all();

  return NextResponse.json({ leads });
}
