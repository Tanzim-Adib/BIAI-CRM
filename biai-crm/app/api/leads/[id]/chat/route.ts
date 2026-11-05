import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { chatAboutLead, ChatTurn } from "@/lib/gemini";

// "Ask AI" per-lead chat. Conversation history lives client-side (passed in
// on every call) — nothing is persisted here except the special case of an
// explicit "summarize" action, which writes to contacts.ai_summary so the
// contact graph can read it later.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const leadId = Number(id);
  const body = await req.json();

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const history: ChatTurn[] = Array.isArray(body.history) ? body.history : [];
  const userMessage: string = body.message ?? "";
  const summarize: boolean = body.summarize === true;

  const effectiveMessage = summarize
    ? "Summarize what we know about this contact so far, in 1-2 sentences, for their CRM profile — focus on who they are, what they want, and how likely they are to convert."
    : userMessage;

  if (!effectiveMessage || effectiveMessage.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  let reply: string;
  try {
    reply = await chatAboutLead({
      rawText: lead.raw_text,
      category: lead.category,
      priority: lead.priority,
      leadVerdict: lead.lead_verdict,
      suggestedReply: lead.suggested_reply,
      history,
      userMessage: effectiveMessage,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "AI chat failed: " + (err?.message ?? "unknown error") },
      { status: 502 }
    );
  }

  if (summarize) {
    db.prepare("UPDATE contacts SET ai_summary = ? WHERE id = ?").run(reply, lead.contact_id);
    db.prepare(
      "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'edited', ?)"
    ).run(leadId, user.id, "AI profile summary saved");
  }

  return NextResponse.json({ ok: true, reply });
}
