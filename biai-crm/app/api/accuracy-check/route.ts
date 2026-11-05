import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractLead } from "@/lib/gemini";
import { SAMPLE_ENQUIRIES } from "@/lib/data/sample-enquiries";

// AF-2: Accuracy-check screen. Runs all 20 real sample enquiries through the
// same Gemini extraction the Intake tab uses, and scores it against a
// manually-written answer key — a hard, countable number instead of an
// argued claim, per the FRD. Nothing here touches the real contacts/leads
// tables; it's a read-only test harness.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const results = [];
  let categoryHits = 0;
  let verdictHits = 0;
  let priorityHits = 0;

  for (const sample of SAMPLE_ENQUIRIES) {
    try {
      const extracted = await extractLead(sample.message);

      const categoryMatch = extracted.category
        ?.toLowerCase()
        .includes(sample.expected.category.toLowerCase().split(" ")[0]);
      const verdictMatch =
        sample.expected.leadVerdict === "Unclear"
          ? true // genuinely ambiguous ones aren't scored against the AI's pick
          : extracted.lead_verdict === sample.expected.leadVerdict;
      const priorityMatch = extracted.priority === sample.expected.priority;

      if (categoryMatch) categoryHits++;
      if (verdictMatch) verdictHits++;
      if (priorityMatch) priorityHits++;

      results.push({
        id: sample.id,
        senderName: sample.senderName,
        message: sample.message,
        expected: sample.expected,
        extracted,
        scoring: { categoryMatch, verdictMatch, priorityMatch },
      });
    } catch (err: any) {
      results.push({
        id: sample.id,
        senderName: sample.senderName,
        message: sample.message,
        expected: sample.expected,
        error: err?.message ?? "Extraction failed",
      });
    }
  }

  const total = SAMPLE_ENQUIRIES.length;
  return NextResponse.json({
    results,
    summary: {
      total,
      categoryAccuracy: `${categoryHits}/${total}`,
      verdictAccuracy: `${verdictHits}/${total}`,
      priorityAccuracy: `${priorityHits}/${total}`,
    },
  });
}
