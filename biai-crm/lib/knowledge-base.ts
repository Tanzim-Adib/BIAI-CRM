// BIAI's own facts, grounding the AI's suggested-reply generation so it
// never invents prices, course names, or claims it can't back up. Sourced
// from the Knowledge Base tab of the BRD/FRD doc (biai.com.bd, fetched
// 2026-11-03). Read fresh on every intake call — edit freely, no rebuild
// needed beyond a save.

export const KNOWLEDGE_BASE = `
BIAI — Bangladesh Institute of Artificial Intelligence Ltd.
Dhaka, in partnership with Outskill. Trade License TRAD/DNCC/005647/2026.
Self-described as "Bangladesh's first applied AI institute."
Website: biai.com.bd

PROGRAMS
1. Free AI Masterclass — Online, live, 3 hours, rolling registration, Free.
   Enroll: go.outskill.com/claude-bangladesh
2. 3-Day Generative AI Bootcamp — Online, live, 3 days / 20 hours.
   Next cohort 13-15 Nov 2026, then monthly. Price: ৳9,999.
   Enroll: biai.com.bd/enroll
   Builds: a deployed web app, an AI agent, a custom assistant, and an ad film.
3. AI Generalist Fellowship — Hybrid, 12 months (6+6), schedule by enquiry.
   Price: not published. Enquiry via WhatsApp.
   Full-stack AI generalist, real capstone project; build-first, no fixed
   syllabus — goal-shaped path, suitable for non-technical backgrounds.
4. In-Person Cohort — In person, Dhaka. Duration/schedule/price: not published.
   Enquiry via WhatsApp. Ends with pitching a real AI solution to a corporate partner.

CORPORATE TRAINING ("For Business")
- Process: audit current workflow -> redesign with AI at the core -> build
  and roll out, training the team hands-on -> post-rollout support.
- Focus areas: productivity, marketing & sales, process automation,
  leadership & strategy.
- Group sizes: 2-10, 11-25, 26-50, 50+.
- Format: online, onsite, or hybrid; Bangla or English.
- Pricing: ALWAYS an individual quote — nothing published. No group/corporate
  discount PERCENTAGE is published either — never confirm a discount amount,
  offer to get a quote instead.
- Enquiry: biai.com.bd/for-business/enquiry, or WhatsApp.

REFUND & CANCELLATION POLICY (updated 27 Oct 2026)
- Full refund if requested before the program's start date.
- Generally unavailable once the program has "substantially started"
  (typically after the first live session), except where law requires a
  refund or BIAI cancels/materially changes the program.
- Approved refunds processed in 7-10 working days to the original payment method.
- Request by emailing support@biai.com.bd with name, program, and reason.
- If BIAI cancels: full refund, same 7-10 working day timeline.

PAYMENTS
- Processed via SSLCommerz.
- An optional "Lifetime Access Pass" add-on exists, but its exact
  contents/benefits are not detailed on the fetched pages — hedge on this.

CONTACT
- Email: support@biai.com.bd
- WhatsApp: +880 1328-446600
- Facebook: biai.bd · Instagram: biai.bd · LinkedIn: biai-ltd · YouTube: @biaibd

NOT PUBLISHED — DO NOT INVENT AN ANSWER ON ANY OF THESE. Say you'll confirm
and get back to them (or point to WhatsApp/email) instead of asserting a fact:
- Any installment/EMI payment plan
- The group/corporate discount AMOUNT (the existence of custom quotes is fine
  to mention; a percentage or taka figure is not)
- Fellowship and In-Person Cohort fees
- Whether live sessions are recorded
- Certificate validity / government accreditation detail
- Any specific class location (e.g. a neighbourhood like Mirpur)
`.trim();
