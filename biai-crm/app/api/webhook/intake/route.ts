import { NextRequest, NextResponse } from "next/server";
import { createLeadFromText } from "@/lib/intake";

// Separate from /api/intake on purpose: that route checks the browser's
// session cookie, which n8n has no way to hold. This route instead checks
// a shared secret in the x-api-key header, set as INTAKE_API_KEY in your
// own .env.local — never shared with anyone else, just like the Gemini key.
//
// Point your n8n workflow's HTTP Request node at this URL:
//   POST http://localhost:3000/api/webhook/intake        (while testing locally)
// Headers: x-api-key: <your INTAKE_API_KEY>
// Body (JSON): { "rawText": "...the message...", "channel": "whatsapp" }
export async function POST(req: NextRequest) {
  const expected = process.env.INTAKE_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "INTAKE_API_KEY is not set in .env.local — add one before using this webhook." },
      { status: 500 }
    );
  }

  const got = req.headers.get("x-api-key");
  if (got !== expected) {
    return NextResponse.json({ error: "Invalid or missing x-api-key header." }, { status: 401 });
  }

  const { rawText, channel } = await req.json();
  if (!rawText || typeof rawText !== "string" || rawText.trim().length < 3) {
    return NextResponse.json({ error: "rawText is required (min 3 chars)." }, { status: 400 });
  }

  try {
    // No logged-in user for a webhook call, so assigned_to is left null —
    // it shows as "Unclaimed" until a staff member hits "Lead taken".
    const { lead, contact, duplicate, possibleContact } = await createLeadFromText(rawText, channel ?? null, null);
    return NextResponse.json({ ok: true, lead, contact, duplicate, possibleContact });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AI extraction failed: " + (err?.message ?? "unknown error") },
      { status: 502 }
    );
  }
}
