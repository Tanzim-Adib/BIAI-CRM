// The 20 real sample enquiries BIAI provided for the take-home task, plus a
// manually-written answer key (category / lead verdict / priority) for the
// accuracy-check screen (AF-2) to score the AI's extraction against.
// Source: sample-enquiries.csv, as given.

export type SampleEnquiry = {
  id: number;
  channel: string;
  receivedAt: string;
  senderName: string;
  phone: string | null;
  message: string;
  expected: {
    category: string;
    leadVerdict: "Lead" | "Not a lead" | "Unclear";
    priority: "High" | "Low";
    note: string;
  };
};

export const SAMPLE_ENQUIRIES: SampleEnquiry[] = [
  {
    id: 1, channel: "WhatsApp", receivedAt: "2026-10-26 09:12", senderName: "Rafi Ahmed", phone: "01711000001",
    message: "Assalamualaikum, apnader 3 day bootcamp er price koto? Payment kibhabe korbo?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Bootcamp price/payment, casual tone" },
  },
  {
    id: 2, channel: "Facebook Messenger", receivedAt: "2026-10-26 09:40", senderName: "Tahmina Akter", phone: null,
    message: "ফেলোশিপ প্রোগ্রামে ভর্তি হতে চাই। কবে শুরু হবে?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Fellowship enrollment interest, Bangla" },
  },
  {
    id: 3, channel: "Website form", receivedAt: "2026-10-26 10:05", senderName: "Mahmud Hasan (Managing Director, Gazipur textile company)", phone: "01711000003",
    message: "I run a 40-person textile company in Gazipur. We want AI training for our team. Can someone call me this week?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "High", note: "MD title + 40 headcount + explicit ask = corporate lead" },
  },
  {
    id: 4, channel: "WhatsApp", receivedAt: "2026-10-26 10:31", senderName: "Sabbir", phone: "01711000004",
    message: "Vai class gula live hoy naki recorded? Recording pawa jay?",
    expected: { category: "Support question", leadVerdict: "Unclear", priority: "Low", note: "Recording policy not published — must hedge" },
  },
  {
    id: 5, channel: "Phone call note", receivedAt: "2026-10-26 11:02", senderName: "Nasreen Sultana", phone: "01711000005",
    message: "Called to ask about student discount. Said she will call again tomorrow after 5 PM.",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Student discount not published — hedge" },
  },
  {
    id: 6, channel: "Facebook comment", receivedAt: "2026-10-26 11:20", senderName: "Ishtiaq", phone: null,
    message: "Ei course korle job pabo?",
    expected: { category: "Support question", leadVerdict: "Not a lead", priority: "Low", note: "Vague comment, no real buying intent" },
  },
  {
    id: 7, channel: "WhatsApp", receivedAt: "2026-10-26 12:48", senderName: "Farzana Rahman", phone: "01711000007",
    message: "পেমেন্ট করেছি কিন্তু কোনো কনফার্মেশন পাইনি। আমার নাম ফারজানা রহমান। ২৫ তারিখে বিকাশে দিয়েছি।",
    expected: { category: "Complaint", leadVerdict: "Not a lead", priority: "High", note: "Already paid, no confirmation — complaints are always High" },
  },
  {
    id: 8, channel: "Website form", receivedAt: "2026-10-26 13:15", senderName: "Anika Chowdhury", phone: "01711000008",
    message: "Do you offer refunds if I cannot attend after paying?",
    expected: { category: "Support question", leadVerdict: "Not a lead", priority: "Low", note: "Refund policy is actually published — answerable, no hedge needed" },
  },
  {
    id: 9, channel: "Facebook Messenger", receivedAt: "2026-10-26 14:02", senderName: "Jahid", phone: null,
    message: "Offline class kothay hobe? Mirpur e?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Specific location not published — hedge" },
  },
  {
    id: 10, channel: "WhatsApp", receivedAt: "2026-10-26 14:30", senderName: "Kamrul Islam (HR, a bank in Motijheel)", phone: "01711000010",
    message: "Hi, I'm from a bank in Motijheel. Need a quote for training 120 employees. Online or onsite both fine.",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "High", note: "HR title + 120 headcount + explicit quote ask" },
  },
  {
    id: 11, channel: "Facebook comment", receivedAt: "2026-10-26 15:10", senderName: "Earn Crypto Daily", phone: null,
    message: "Earn 5000 USD every day with our crypto signals! Click bit.ly/xxxx now!!!",
    expected: { category: "Spam", leadVerdict: "Not a lead", priority: "Low", note: "Obvious spam" },
  },
  {
    id: 12, channel: "WhatsApp", receivedAt: "2026-10-27 09:05", senderName: "Rafi Ahmed", phone: "01711000001",
    message: "Bootcamp er price ta bolen please",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "SAME CONTACT as #1 (same phone) — should merge, not duplicate" },
  },
  {
    id: 13, channel: "Facebook Messenger", receivedAt: "2026-10-27 09:44", senderName: "Mim", phone: null,
    message: "আমি ক্লাস ৯-এ পড়ি। আমি কি ফ্রি মাস্টারক্লাসে জয়েন করতে পারব?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Free masterclass, sender states she's in grade 9" },
  },
  {
    id: 14, channel: "Website form", receivedAt: "2026-10-27 10:20", senderName: "Shirin Sultana", phone: "01711000013",
    message: "Is the fellowship suitable for a non-technical marketing manager? I have 8 years of experience but no coding.",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "High", note: "Stated role title + 8 yrs experience = formality signal" },
  },
  {
    id: 15, channel: "WhatsApp", receivedAt: "2026-10-27 11:55", senderName: "Tanvir", phone: "01711000014",
    message: "Add-on ta ki? Lifetime access mane ki?",
    expected: { category: "Support question", leadVerdict: "Unclear", priority: "Low", note: "Lifetime Access Pass not detailed — hedge" },
  },
  {
    id: 16, channel: "Phone call note", receivedAt: "2026-10-27 12:30", senderName: "Habibur Rahman", phone: "01711000015",
    message: "Caller wants to cancel his enrolment and get his money back. Very upset. Said he will post about it on Facebook if not solved today.",
    expected: { category: "Complaint", leadVerdict: "Not a lead", priority: "High", note: "Refund + upset + public-post threat — escalate" },
  },
  {
    id: 17, channel: "Facebook Messenger", receivedAt: "2026-10-27 13:42", senderName: "Nowshin", phone: null,
    message: "Apnader course certificate ta ki govt approved?",
    expected: { category: "Support question", leadVerdict: "Not a lead", priority: "Low", note: "Certificate accreditation not published — hedge" },
  },
  {
    id: 18, channel: "WhatsApp", receivedAt: "2026-10-27 14:18", senderName: "Rezaul Karim (owner, small garment factory)", phone: "01711000017",
    message: "আমার কোম্পানির ১৫ জন কর্মীর জন্য কি গ্রুপ ডিসকাউন্ট আছে?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "High", note: "Owner title + 15 headcount; discount AMOUNT not published — hedge" },
  },
  {
    id: 19, channel: "WhatsApp", receivedAt: "2026-10-27 15:09", senderName: "Samira", phone: "01711000018",
    message: "Can I pay in two instalments for the fellowship?",
    expected: { category: "Sales enquiry", leadVerdict: "Lead", priority: "Low", note: "Installment plan not published — hedge" },
  },
  {
    id: 20, channel: "Website form", receivedAt: "2026-10-27 16:00", senderName: "Arif Hossain", phone: "01711000019",
    message: "Looking for a job as an AI intern. Where do I apply?",
    expected: { category: "Not a lead", leadVerdict: "Not a lead", priority: "Low", note: "Job seeker, not a sales enquiry at all" },
  },
];
