import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLeadFromText } from "@/lib/intake";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { rawText, channel } = await req.json();
  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
    return NextResponse.json({ error: "Paste the conversation or note first." }, { status: 400 });
  }

  try {
    const { lead, contact, duplicate, possibleContact } = await createLeadFromText(rawText, channel ?? null, user.id);
    return NextResponse.json({ ok: true, lead, contact, duplicate, possibleContact });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AI extraction failed: " + (err?.message ?? "unknown error") },
      { status: 502 }
    );
  }
}
