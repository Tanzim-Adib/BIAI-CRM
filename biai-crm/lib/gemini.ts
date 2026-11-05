import { GoogleGenerativeAI } from "@google/generative-ai";
import { KNOWLEDGE_BASE } from "./knowledge-base";

export type ExtractionResult = {
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_org: string | null;
  category: "Sales enquiry" | "Complaint" | "Support question" | "Spam" | "Not a lead";
  priority: "High" | "Medium" | "Low";
  lead_verdict: "Lead" | "Not a lead";
  lead_reasoning: string;
  estimated_value: string;
  suggested_reply: string;
};

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return new GoogleGenerativeAI(key);
}

const SYSTEM_PRIMER = `You are the intake-analysis engine for BIAI's internal CRM.
You will be given a pasted conversation or note from a sales channel
(WhatsApp, Facebook Messenger, website contact form, or a staff member's
phone-call notes). The text may be in English, Bangla, or Banglish
(code-mixed). Reply in whichever of those the enquirer themselves used,
matching their register.

Ground every factual claim in the KNOWLEDGE BASE below. If something is not
covered there, do not invent it — hedge and say it will be confirmed, or
point to WhatsApp/email. Never state a specific price, discount, or policy
detail that isn't in the knowledge base.

KNOWLEDGE BASE:
${KNOWLEDGE_BASE}

CATEGORY must be exactly one of these five — never a free-text label of
your own invention:
  "Sales enquiry"    — asking about courses, pricing, schedule, enrollment
  "Complaint"         — anything expressing frustration, requesting a refund
                        or cancellation, reporting a problem with payment or
                        service, or threatening to escalate/post publicly.
                        Watch for signals beyond explicit "I want a refund":
                        anger, words like "upset"/"disappointed", a request
                        to cancel, a payment made with no confirmation
                        received, or a threat to go public if unresolved.
                        A complaint is ALWAYS "priority": "High", regardless
                        of tone, and is virtually always "lead_verdict":
                        "Not a lead" — a complaint is not a new sales
                        opportunity, it is retention/support risk.
  "Support question"  — a how-does-this-work question from someone not
                        actively being sold to (e.g. an existing enrollee
                        asking about class format)
  "Spam"               — unrelated promotional content, scams, unrelated ads
  "Not a lead"         — doesn't fit the above and isn't a sales lead
                        (e.g. a job application, unrelated question)

Return ONLY a single JSON object (no markdown fences, no commentary) with
exactly these fields:
{
  "contact_name": string | null,
  "contact_phone": string | null,
  "contact_email": string | null,
  "contact_org": string | null,
  "category": "Sales enquiry" | "Complaint" | "Support question" | "Spam" | "Not a lead",
  "priority": "High" | "Medium" | "Low",
  "lead_verdict": "Lead" | "Not a lead",   // judged on the WHOLE thread, not per message — e.g. a company asking about staff training is a clear Lead even if one message alone reads as a general question
  "lead_reasoning": string,         // one or two sentences on why
  "estimated_value": string,        // for a Sales enquiry/Lead: a rough BDT figure or range if inputs support it (e.g. headcount x per-seat rate, or the named program's fee), otherwise "Unclear - needs quote". For a Complaint: do NOT say "needs quote" (there is no sale here) — instead name what's at stake, e.g. "Refund/retention risk - no new revenue" or the refund amount if stated. For Spam/Not a lead: "N/A".
  "suggested_reply": string         // a ready-to-send reply in the enquirer's own language/register, grounded only in the knowledge base, hedging on anything not published. For a Complaint, this should acknowledge the issue and the urgency, not pitch anything.
}

If a PRIOR CONTACT HISTORY block is given below, this sender has written in
before — use it. Let it change your read in concrete ways: if this message
is a near-duplicate follow-up on an already-open enquiry, say so in
lead_reasoning rather than treating it as a fresh one; if a prior enquiry
from them is still unresolved, factor that into priority (a second message
with no reply yet leans toward higher urgency, not lower); and the
suggested reply can acknowledge you've spoken before rather than opening
as if to a stranger. Never fabricate history that isn't in the block.`;

export async function extractLead(
  rawText: string,
  priorContext?: string | null
): Promise<ExtractionResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const contextBlock = priorContext ? `\nPRIOR CONTACT HISTORY:\n${priorContext}\n` : "";

  // Google's free tier occasionally returns 503 ("high demand") — this is
  // transient server-side overload, not a bug in this code. Retry a few
  // times with backoff before giving up.
  let lastErr: any;
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      result = await model.generateContent([
        SYSTEM_PRIMER,
        `${contextBlock}\nCONVERSATION / NOTE TO ANALYZE:\n${rawText}`,
      ]);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      const is503 = err?.message?.includes("503") || err?.status === 503;
      if (!is503 || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt))); // 1s, 2s, 4s
    }
  }
  if (lastErr) throw lastErr;

  const text = result!.response.text();
  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "Gemini returned a response that wasn't valid JSON. Raw response: " +
        text.slice(0, 500)
    );
  }
  return parsed;
}

// --- "Ask AI" per-lead chat --------------------------------------------
// A free-form conversational assistant scoped to one lead, for a staff
// member to ask for a rephrase, a read on the client's likely tone/intent,
// alternative reply angles, or a profile summary. Unlike extractLead above,
// this returns plain text, not a fixed JSON schema — it's a conversation,
// not a structured extraction.

export type ChatTurn = { role: "user" | "model"; text: string };

const CHAT_SYSTEM_PRIMER = `You are a sales-assistant chatbot embedded in BIAI's
internal CRM, helping a staff member handle ONE specific enquiry. You are not
talking to the customer — you're coaching the staff member handling them.

You can be asked to:
- Rephrase or adjust the tone of a draft reply (more formal, shorter, warmer, etc.)
- Give a read on what the client's tone/wording suggests about them (rushed?
  price-sensitive? skeptical? already decided?) — this is an informed guess
  from the text, not a certainty, so hedge appropriately
- Suggest a few different angles for how to reply, with tradeoffs
- Summarize what's known about this contact so far, in 1-2 sentences, for
  their CRM profile (only do this when explicitly asked to summarize)

Ground any factual claim about BIAI's courses/pricing/policy in the knowledge
base below — never invent a price, date, or policy not stated there.

KNOWLEDGE BASE:
${KNOWLEDGE_BASE}

Keep replies conversational and short — a few sentences, not an essay, unless
asked for a longer suggested reply draft.`;

export async function chatAboutLead(params: {
  rawText: string;
  category: string;
  priority: string;
  leadVerdict: string;
  suggestedReply: string;
  history: ChatTurn[];
  userMessage: string;
}): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  });

  const context = `ENQUIRY CONTEXT:
Raw message: ${params.rawText}
Category: ${params.category}
Priority: ${params.priority}
Lead verdict: ${params.leadVerdict}
Current suggested reply: ${params.suggestedReply}`;

  const transcript = params.history
    .map((t) => `${t.role === "user" ? "Staff" : "Assistant"}: ${t.text}`)
    .join("\n");

  const prompt = [
    CHAT_SYSTEM_PRIMER,
    context,
    transcript ? `\nCONVERSATION SO FAR:\n${transcript}` : "",
    `\nStaff: ${params.userMessage}`,
  ].join("\n");

  let lastErr: any;
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      result = await model.generateContent(prompt);
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      const is503 = err?.message?.includes("503") || err?.status === 503;
      if (!is503 || attempt === 3) break;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  if (lastErr) throw lastErr;

  return result!.response.text().trim();
}
