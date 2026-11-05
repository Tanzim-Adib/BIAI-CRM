import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { chatAboutLead } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const leads = db.prepare(`SELECT l.external_id, l.category, l.priority, l.stage, l.lead_verdict, l.created_at, l.updated_at, c.name AS contact_name
    FROM leads l JOIN contacts c ON c.id = l.contact_id WHERE l.created_at >= ? ORDER BY l.created_at DESC LIMIT 100`).all(start) as any[];
  const activity = db.prepare("SELECT action, detail, created_at FROM activity_log WHERE created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 200").all() as any[];
  if (!leads.length) return NextResponse.json({ summary: "There is no pipeline activity from the last seven days to summarize." });
  const report = await chatAboutLead({
    rawText: JSON.stringify({ leads, activity }), category: "Weekly pipeline summary", priority: "n/a", leadVerdict: "n/a", suggestedReply: "",
    history: [], userMessage: "Summarize the last seven days of CRM pipeline activity for staff. Highlight stage movements, urgent/overdue items, notable patterns, and clear next actions. Do not invent facts; keep this concise.",
  });
  return NextResponse.json({ summary: report });
}
