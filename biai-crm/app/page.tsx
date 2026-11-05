"use client";

import { useEffect, useState } from "react";
import CoinLoader from "./components/CoinLoader";
import BiaiEmblem from "./components/BiaiEmblem";
import AiIcon from "./components/AiIcon";
import NotificationBell from "./components/NotificationBell";
import CopyButton from "./components/CopyButton";
import SpinnerLogo from "./components/SpinnerLogo";
import AskAiPanel from "./components/AskAiPanel";
import CoinRewardWidget from "./components/CoinRewardWidget";
import ContactGraph from "./components/ContactGraph";

type User = { id: number; name: string; email: string; role: string };

const STAGES = ["new", "contacted", "interested", "paid", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  paid: "Paid",
  lost: "Lost",
};
const STAGE_VAR: Record<string, string> = {
  new: "var(--new)",
  contacted: "var(--contacted)",
  interested: "var(--interested)",
  paid: "var(--paid)",
  lost: "var(--lost)",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase() || "?";
}

export default function Home() {
  const [loaderDone, setLoaderDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tab, setTab] = useState<"intake" | "pipeline" | "contacts" | "dashboard" | "graph">("intake");

  useEffect(() => {
    function onJump() {
      setTab("pipeline");
    }
    window.addEventListener("biai:jump-to-pipeline", onJump);
    return () => window.removeEventListener("biai:jump-to-pipeline", onJump);
  }, []);
  const [avatarOpen, setAvatarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .finally(() => setCheckedAuth(true));
  }, []);

  if (!loaderDone) {
    return <CoinLoader onFinish={() => setLoaderDone(true)} />;
  }
  if (!checkedAuth) return null;
  if (!user) return <AuthScreen onAuthed={setUser} />;

  return (
    <div id="app-shell" className="show">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brandmark">
            <BiaiEmblem size={30} withBackground clipId="headerEmblemClip" />
            <span className="name">BIAI CRM</span>
          </div>
          <nav className="tabs">
            {(["intake", "pipeline", "contacts", "dashboard", "graph"] as const).map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
            <NotificationBell />
            <div className="avatar-wrap">
              <div className="avatar" onClick={() => setAvatarOpen((v) => !v)}>
                {initials(user.name)}
              </div>
              <div className={`avatar-menu${avatarOpen ? " show" : ""}`}>
                <div className="who">
                  {user.name}
                  <br />
                  <span style={{ opacity: 0.7 }}>Staff account</span>
                </div>
                <button>Profile settings</button>
                <button
                  className="danger"
                  onClick={async () => {
                    setAvatarOpen(false);
                    await fetch("/api/auth/logout", { method: "POST" });
                    setUser(null);
                  }}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="shell">
        {tab === "intake" && <IntakePanel />}
        {tab === "pipeline" && <PipelinePanel />}
        {tab === "contacts" && <ContactsPanel />}
        {tab === "dashboard" && <DashboardPanel />}
        {tab === "graph" && <ContactGraph />}
        <div className="footer-note">BIAI CRM — internal tool</div>
      </main>
      <CoinRewardWidget />
    </div>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "signin" ? { email, password } : { name, email, password, inviteCode };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      const me = await fetch("/api/auth/me").then((r) => r.json());
      onAuthed(me.user);
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div id="login-screen" className="show">
      <form className="card login-card" onSubmit={submit}>
        <div style={{ margin: "0 auto 16px", width: 52, height: 52 }}>
          <BiaiEmblem size={52} withBackground clipId="loginEmblemClip" />
        </div>
        <h2>{isSignup ? "Create your BIAI CRM account" : "Sign in to BIAI CRM"}</h2>
        <p>{isSignup ? "For BIAI sales & admissions staff" : "Staff access only · internal tool"}</p>

        <div className="seg" style={{ marginBottom: 18 }}>
          <button type="button" className={!isSignup ? "sel-lead" : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button type="button" className={isSignup ? "sel-lead" : ""} onClick={() => setMode("signup")}>
            Sign up
          </button>
        </div>

        {isSignup && (
          <div className="field">
            <label>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@biai.com.bd"
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        {isSignup && (
          <>
            <div className="field">
              <label>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </div>
            <div className="field">
              <label>Invite code</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="From your BIAI admin"
                required
              />
              <div className="verdict-box">
                New staff accounts need an admin-issued invite code — placeholder for now, no
                real invite system wired up yet.
              </div>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>
        <div className="alt">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <a onClick={() => setMode("signin")}>Sign in</a>
            </>
          ) : (
            <>Forgot password? <a>Reset it</a></>
          )}
        </div>
      </form>
    </div>
  );
}

function Tag({ children, kind }: { children: React.ReactNode; kind: "lead" | "notlead" }) {
  return <span className={`tag ${kind}`}>{children}</span>;
}

function Pri({ level }: { level: string }) {
  const high = level?.toLowerCase() === "high";
  return <span className={`pri ${high ? "high" : "low"}`}>{high ? "⚡ High" : "− Low"}</span>;
}

function IntakePanel() {
  const [channel, setChannel] = useState("whatsapp");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  // Editable copy of what the AI extracted — staff corrections live here
  // until "Save corrections" writes them back, so the AI's first pass is
  // never the final, un-editable word.
  const [edited, setEdited] = useState<any | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  function setField(key: string, value: any) {
    setEdited((e: any) => ({ ...e, [key]: value }));
    setSaveState("idle");
  }

  async function saveCorrections() {
    if (!result || !edited) return;
    setSaveState("saving");
    await Promise.all([
      fetch(`/api/leads/${result.lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: edited.category,
          priority: edited.priority,
          lead_verdict: edited.lead_verdict,
          estimated_value: edited.estimated_value,
          suggested_reply: edited.suggested_reply,
        }),
      }),
      fetch(`/api/contacts/${result.contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: edited.contact_name, phone: edited.contact_phone }),
      }),
    ]);
    setSaveState("saved");
    loadRecent();
  }

  function loadRecent() {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setRecent((d.leads ?? []).slice(0, 4)));
  }
  useEffect(() => { loadRecent(); }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Intake failed.");
        return;
      }
      setResult(data);
      setEdited({
        contact_name: data.contact.name ?? "",
        contact_phone: data.contact.phone ?? "",
        category: data.lead.category ?? "",
        priority: data.lead.priority ?? "Low",
        lead_verdict: data.lead.lead_verdict ?? "Not a lead",
        estimated_value: data.lead.estimated_value ?? "",
        suggested_reply: data.lead.suggested_reply ?? "",
      });
      setSaveState("idle");
      setRawText("");
      loadRecent();
    } finally {
      setLoading(false);
    }
  }

  const CHANNELS = [
    { v: "whatsapp", label: "WhatsApp" },
    { v: "facebook", label: "Messenger" },
    { v: "telegram", label: "Telegram" },
    { v: "website", label: "Web form" },
    { v: "phone", label: "📞 Call note" },
  ];

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">Intake</h1>
          <p className="subtitle">Paste a raw message. AI pulls out the lead fields — you review, edit and save.</p>
        </div>
        <div className="chip-row">
          <span className="chip good">● {recent.length} recent</span>
          <span className="chip"><AiIcon /> Gemini-powered</span>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card panel">
            <h3>
              📋 Raw message{" "}
              <span style={{ marginLeft: "auto", fontWeight: 400, color: "var(--ink-soft)", fontSize: 12 }}>
                Paste from any channel
              </span>
            </h3>
            <div className="src-row">
              {CHANNELS.map((c) => (
                <span
                  key={c.v}
                  className={`src-pill${channel === c.v ? " active" : ""}`}
                  onClick={() => setChannel(c.v)}
                >
                  {c.label}
                </span>
              ))}
            </div>
            <textarea
              className="raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                "[14/06/25, 10:42] +880 1712-345678: Assalamu alaikum bhai, apnader data science bootcamp er next batch kobe start hobe?"
              }
            />
            <div className="row-between">
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                {rawText.length} characters
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" type="button" onClick={() => setRawText("")}>
                  Clear
                </button>
                <button
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={loading || rawText.trim().length < 3}
                >
                  {loading ? "Processing…" : "✨ Process with AI"}
                </button>
              </div>
            </div>
            {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
          </div>

          <div className="card panel" style={{ marginTop: 16 }}>
            <h3>
              Recent intakes
              <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }} />
            </h3>
            {recent.length === 0 && (
              <p className="verdict-box">Nothing yet — process a message to see it here.</p>
            )}
            {recent.map((r) => (
              <div className="recent-item" key={r.id}>
                <span className="dot" style={{ background: STAGE_VAR[r.stage] }} />
                <span style={{ flex: 1 }}>{r.contact_name ?? "Unknown"}</span>
                <Tag kind={r.lead_verdict === "Lead" ? "lead" : "notlead"}>{r.lead_verdict}</Tag>
                <span style={{ color: "var(--ink-soft)" }}>{timeAgo(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card panel">
          <h3>
            <AiIcon /> AI extraction
            <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }}>
              {result ? "Edit anything the AI got wrong, then save" : "Awaiting a message"}
            </span>
          </h3>

          {!result && (
            <p className="verdict-box">
              Paste a message on the left and click "Process with AI" — the extracted fields and
              suggested reply will appear here, fully editable.
            </p>
          )}

          {result && edited && (
            <>
              {result.duplicate && (
                <div className="chip warn" style={{ marginBottom: 12 }}>
                  ⚠ Exact duplicate — this message already exists in the Pipeline, no new lead was created.
                </div>
              )}
              {result.possibleContact && (
                <div className="chip warn" style={{ marginBottom: 12 }}>
                  ⚠ Someone named "{result.possibleContact.name}" is already in Contacts on this channel — could
                  be the same person, could just share a name. Not merged automatically; ask them directly before
                  assuming, and don't volunteer their prior enquiry details until they confirm.
                </div>
              )}
              <div className="field-grid">
                <div className="field">
                  <label><AiIcon size={11} /> Name</label>
                  <input
                    value={edited.contact_name}
                    onChange={(e) => setField("contact_name", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label><AiIcon size={11} /> Phone</label>
                  <input
                    value={edited.contact_phone}
                    onChange={(e) => setField("contact_phone", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Channel</label>
                  <input defaultValue={result.lead.channel ?? ""} readOnly />
                </div>
                <div className="field">
                  <label><AiIcon size={11} /> Category</label>
                  <input
                    value={edited.category}
                    onChange={(e) => setField("category", e.target.value)}
                  />
                </div>
              </div>
              <div className="field-grid">
                <div className="field">
                  <label><AiIcon size={11} /> Priority</label>
                  <div className="seg">
                    <button
                      type="button"
                      className={edited.priority === "High" ? "sel-high" : ""}
                      onClick={() => setField("priority", "High")}
                    >
                      ⚡ High
                    </button>
                    <button
                      type="button"
                      className={edited.priority !== "High" ? "sel-low" : ""}
                      onClick={() => setField("priority", "Low")}
                    >
                      − Low
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label><AiIcon size={11} /> Lead verdict</label>
                  <div className="seg">
                    <button
                      type="button"
                      className={edited.lead_verdict === "Lead" ? "sel-lead" : ""}
                      onClick={() => setField("lead_verdict", "Lead")}
                    >
                      ✓ Lead
                    </button>
                    <button
                      type="button"
                      className={edited.lead_verdict !== "Lead" ? "sel-low" : ""}
                      onClick={() => setField("lead_verdict", "Not a lead")}
                    >
                      Not a lead
                    </button>
                  </div>
                </div>
              </div>
              <div className="verdict-box">{result.lead.lead_reasoning}</div>

              <div className="field" style={{ marginTop: 14 }}>
                <label><AiIcon size={11} /> Estimated value</label>
                <input
                  value={edited.estimated_value}
                  onChange={(e) => setField("estimated_value", e.target.value)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="row-between" style={{ marginTop: 0 }}>
                  <h3 style={{ margin: 0 }}><AiIcon /> AI-suggested reply</h3>
                  <CopyButton text={edited.suggested_reply} />
                </div>
                <textarea
                  className="reply-box"
                  style={{ marginTop: 10, minHeight: 140, resize: "vertical" }}
                  value={edited.suggested_reply}
                  onChange={(e) => setField("suggested_reply", e.target.value)}
                />
              </div>

              <div className="row-between">
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  {saveState === "saved" ? "✅ Corrections saved" : "Already saved to Pipeline — edit and save to correct it"}
                </span>
                <button
                  className="btn btn-dark"
                  onClick={saveCorrections}
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving" ? "Saving…" : "✓ Save corrections"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PipelinePanel() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    const data = await fetch("/api/leads").then((r) => r.json());
    setLeads(data.leads ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function patch(id: number, body: any) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  const needsFollowUp = leads.filter(
    (l) => l.reminder_at && new Date(l.reminder_at) < new Date() && !["paid", "lost"].includes(l.stage) && !l.resolved_at
  ).length;
  const highPriority = leads.filter((l) => l.priority === "High").length;

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">
            Pipeline <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 15 }}>{leads.length} enquiries</span>
          </h1>
          <p className="subtitle">Click a card to see the full message and classification, claim it, or mark it resolved.</p>
        </div>
        <div className="chip-row">
          {needsFollowUp > 0 && <span className="chip warn">🚩 {needsFollowUp} need follow-up (48h+)</span>}
          <span className="chip">⚡ {highPriority} high priority</span>
        </div>
      </div>

      {loading ? (
        <SpinnerLogo />
      ) : (
        <div className="board">
          {STAGES.map((stage) => {
            const group = leads.filter((l) => l.stage === stage);
            return (
              <div className="col" key={stage}>
                <div className="col-head">
                  <span className="dot" style={{ background: STAGE_VAR[stage] }} />
                  {STAGE_LABEL[stage]}
                  <span className="count-badge">{group.length}</span>
                </div>
                {group.map((lead) => {
                  return (
                    <div
                      className="kcard"
                      key={lead.id}
                      style={{ borderLeftColor: lead.priority === "High" ? "var(--high)" : "transparent", cursor: "pointer" }}
                      onClick={() => setOpenId(lead.id)}
                    >
                      <div className="top">
                        <span>{lead.contact_name ?? "Unknown"}</span>
                        <Pri level={lead.priority} />
                      </div>
                      <div className="meta">{lead.category}</div>
                      <div className="bottom">
                        <Tag kind={lead.lead_verdict === "Lead" ? "lead" : "notlead"}>
                          {lead.lead_verdict === "Lead" ? "✓ Lead" : "Not a lead"}
                        </Tag>
                        <span>{timeAgo(lead.created_at)}</span>
                      </div>
                      <div className="bottom" style={{ marginTop: 4 }}>
                        <span>{lead.taken_by_name ? `👤 ${lead.taken_by_name}` : "Unclaimed"}</span>
                        {lead.resolved_at && <span style={{ color: "#17895c" }}>✓ Resolved</span>}
                        {lead.escalated === 1 && !lead.resolved_at && <span style={{ color: "var(--high)" }}>🚩 Escalated</span>}
                      </div>
                      {lead.possible_contact_id && (
                        <div className="bottom" style={{ marginTop: 4, color: "var(--brand, #c9842e)" }}>
                          <span>⚠ Possibly {lead.possible_contact_name} — unconfirmed</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {group.length === 0 && <p className="verdict-box">—</p>}
              </div>
            );
          })}
        </div>
      )}

      {openId != null && (() => {
        const lead = leads.find((l) => l.id === openId);
        if (!lead) return null;
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(20,20,20,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: 20,
            }}
            onClick={() => setOpenId(null)}
          >
            <div
              className="card panel"
              style={{
                maxWidth: 560,
                width: "100%",
                maxHeight: "86vh",
                overflowY: "auto",
                padding: 22,
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn btn-ghost"
                style={{ position: "absolute", top: 12, right: 12, fontSize: 12, padding: "4px 10px" }}
                onClick={() => setOpenId(null)}
              >
                ✕ Close
              </button>

              <div className="top" style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{lead.contact_name ?? "Unknown"}</span>
                <Pri level={lead.priority} />
              </div>
              <div className="meta" style={{ marginBottom: 10 }}>{lead.category}</div>
              <div className="bottom" style={{ marginBottom: 2 }}>
                <Tag kind={lead.lead_verdict === "Lead" ? "lead" : "notlead"}>
                  {lead.lead_verdict === "Lead" ? "✓ Lead" : "Not a lead"}
                </Tag>
                <span>{timeAgo(lead.created_at)}</span>
              </div>
              <div className="bottom" style={{ marginBottom: 14 }}>
                <span>{lead.taken_by_name ? `👤 ${lead.taken_by_name}` : "Unclaimed"}</span>
                {lead.resolved_at && <span style={{ color: "#17895c" }}>✓ Resolved</span>}
                {lead.escalated === 1 && !lead.resolved_at && <span style={{ color: "var(--high)" }}>🚩 Escalated</span>}
              </div>

              {lead.possible_contact_id && (
                <div className="chip warn" style={{ marginBottom: 14 }}>
                  ⚠ Someone named "{lead.possible_contact_name}" already exists in Contacts on this channel —
                  could be the same person, could share a name only. Not auto-merged. Ask them directly before
                  assuming it's a returning contact, and don't share prior enquiry details until they confirm.
                </div>
              )}

              <div className="row-between" style={{ marginTop: 0, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>Raw message</span>
                <CopyButton text={lead.raw_text ?? ""} />
              </div>
              <div className="verdict-box" style={{ marginBottom: 8, fontStyle: "italic" }}>
                "{lead.raw_text}"
              </div>
              <div className="verdict-box" style={{ marginBottom: 8 }}>
                {lead.lead_reasoning}
              </div>
              <div style={{ fontSize: 11.5, marginBottom: 8 }}>
                <strong>Est. value:</strong> {lead.estimated_value}
              </div>
              {lead.suggested_reply && (
                <>
                  <div className="row-between" style={{ marginTop: 0, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)" }}>
                      <AiIcon size={11} /> Suggested reply
                    </span>
                    <CopyButton text={lead.suggested_reply} />
                  </div>
                  <div className="verdict-box" style={{ marginBottom: 8 }}>{lead.suggested_reply}</div>
                </>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "6px 10px" }}
                  onClick={() => patch(lead.id, { take: !lead.taken_by })}
                >
                  {lead.taken_by ? "Release" : "Lead taken"}
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "6px 10px" }}
                  onClick={() => patch(lead.id, { resolve: !lead.resolved_at })}
                >
                  {lead.resolved_at ? "Reopen" : "Mark resolved"}
                </button>
                <select
                  value={lead.stage}
                  onChange={(e) => patch(lead.id, { stage: e.target.value })}
                  style={{ fontSize: 11, border: "1px solid var(--line)", borderRadius: 8, padding: "4px 6px" }}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>Move to {STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <AskAiPanel leadId={lead.id} />
            </div>
          </div>
        );
      })()}
    </section>
  );
}

function ContactsPanel() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLead, setEditingLead] = useState(false);
  const [leadEdits, setLeadEdits] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((d) => {
        setContacts(d.contacts ?? []);
        if (d.contacts?.length) setSelectedId(d.contacts[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    fetch(`/api/contacts/${selectedId}`)
      .then((r) => r.json())
      .then((d) => setDetail(d));
  }, [selectedId]);

  async function act(action: "reassign" | "escalate") {
    if (!detail?.leads?.length) return;
    const latest = detail.leads[0];
    if (action === "escalate") {
      await fetch(`/api/leads/${latest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalated: !latest.escalated }),
      });
    }
    // Reassign needs a target user picker — left for when the team-member
    // list UI is built; escalate toggle works end-to-end today.
    const refreshed = await fetch(`/api/contacts/${selectedId}`).then((r) => r.json());
    setDetail(refreshed);
  }

  async function saveLeadEdits() {
    if (!detail?.leads[0] || !leadEdits) return;
    await fetch(`/api/leads/${detail.leads[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadEdits),
    });
    setEditingLead(false);
    const refreshed = await fetch(`/api/contacts/${selectedId}`).then((r) => r.json());
    setDetail(refreshed);
  }

  const selected = contacts.find((c) => c.id === selectedId);

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">
            Contacts <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 15 }}>{contacts.length}</span>
          </h1>
        </div>
      </div>

      {loading ? (
        <SpinnerLogo />
      ) : contacts.length === 0 ? (
        <p className="verdict-box">No contacts yet — they're created automatically from the Intake tab.</p>
      ) : (
        <div className="contacts-shell">
          <div className="card panel" style={{ padding: 14 }}>
            {contacts.map((c) => (
              <div
                key={c.id}
                className={`contact-row${c.id === selectedId ? " sel" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="avatar-sm">{initials(c.name)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.name ?? "Unknown"}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                    {STAGE_LABEL[c.latest_stage] ?? "—"} · {c.last_contact_at ? timeAgo(c.last_contact_at) : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card panel">
            {!detail ? (
              <SpinnerLogo />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar-sm" style={{ width: 44, height: 44, fontSize: 14 }}>
                    {initials(detail.contact.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {detail.contact.name ?? "Unknown"}{" "}
                      {detail.leads[0] && <Pri level={detail.leads[0].priority} />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                      {detail.contact.org ?? detail.contact.channel ?? "—"} · First seen{" "}
                      {new Date(detail.contact.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => act("reassign")}>Reassign</button>
                  <button className="btn btn-ghost" onClick={() => act("escalate")}>
                    {detail.leads[0]?.escalated ? "De-escalate" : "Escalate"}
                  </button>
                </div>

                {detail.leads[0]?.escalated === 1 && (
                  <div className="chip warn" style={{ margin: "14px 0" }}>
                    🚩 Escalated — flagged for senior follow-up
                  </div>
                )}

                {detail.leads.map((lead: any) => (
                  <div className="msg" key={lead.id}>
                    <div className="meta">
                      {lead.channel ?? "—"} · {new Date(lead.created_at).toLocaleString()}
                    </div>
                    {lead.raw_text}
                  </div>
                ))}
              </>
            )}
          </div>

          <div>
            <div className="card panel" style={{ marginBottom: 14 }}>
              <h3>
                <AiIcon /> AI Lead verdict
                <span
                  style={{ marginLeft: "auto", fontWeight: 400, fontSize: 11.5, color: "var(--ink-soft)", cursor: "pointer" }}
                  onClick={() => {
                    if (!detail?.leads[0]) return;
                    if (!editingLead) {
                      setLeadEdits({
                        category: detail.leads[0].category,
                        priority: detail.leads[0].priority,
                        lead_verdict: detail.leads[0].lead_verdict,
                        estimated_value: detail.leads[0].estimated_value,
                      });
                    }
                    setEditingLead((v) => !v);
                  }}
                >
                  {editingLead ? "Cancel" : "Edit"}
                </span>
              </h3>
              {!detail?.leads[0] ? (
                <p className="verdict-box">—</p>
              ) : editingLead ? (
                <>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Category</label>
                    <input
                      value={leadEdits.category}
                      onChange={(e) => setLeadEdits({ ...leadEdits, category: e.target.value })}
                    />
                  </div>
                  <div className="seg" style={{ marginBottom: 10 }}>
                    <button
                      type="button"
                      className={leadEdits.priority === "High" ? "sel-high" : ""}
                      onClick={() => setLeadEdits({ ...leadEdits, priority: "High" })}
                    >
                      ⚡ High
                    </button>
                    <button
                      type="button"
                      className={leadEdits.priority !== "High" ? "sel-low" : ""}
                      onClick={() => setLeadEdits({ ...leadEdits, priority: "Low" })}
                    >
                      − Low
                    </button>
                  </div>
                  <div className="seg" style={{ marginBottom: 10 }}>
                    <button
                      type="button"
                      className={leadEdits.lead_verdict === "Lead" ? "sel-lead" : ""}
                      onClick={() => setLeadEdits({ ...leadEdits, lead_verdict: "Lead" })}
                    >
                      ✓ Lead
                    </button>
                    <button
                      type="button"
                      className={leadEdits.lead_verdict !== "Lead" ? "sel-low" : ""}
                      onClick={() => setLeadEdits({ ...leadEdits, lead_verdict: "Not a lead" })}
                    >
                      Not a lead
                    </button>
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Estimated value</label>
                    <input
                      value={leadEdits.estimated_value}
                      onChange={(e) => setLeadEdits({ ...leadEdits, estimated_value: e.target.value })}
                    />
                  </div>
                  <button className="btn btn-dark" onClick={saveLeadEdits}>✓ Save</button>
                </>
              ) : (
                <>
                  <Tag kind={detail.leads[0].lead_verdict === "Lead" ? "lead" : "notlead"}>
                    {detail.leads[0].lead_verdict === "Lead" ? "✓ Lead" : "Not a lead"}
                  </Tag>{" "}
                  <Pri level={detail.leads[0].priority} />
                  <div className="verdict-box">{detail.leads[0].lead_reasoning}</div>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>Estimated value</div>
                  <div style={{ fontWeight: 700 }}>{detail.leads[0].estimated_value}</div>
                </>
              )}
            </div>
            <div className="card panel">
              <h3>Record</h3>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Category</span>
                  <span>{detail?.leads[0]?.category ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Stage</span>
                  <span>{STAGE_LABEL[detail?.leads[0]?.stage] ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Enquiries</span>
                  <span>{detail?.leads?.length ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardPanel() {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <SpinnerLogo />;

  const maxStage = Math.max(1, ...data.byStage.map((s: any) => s.count));
  const maxCategory = Math.max(1, ...data.byCategory.map((c: any) => c.count));
  const categoryColors = ["var(--ink)", "#9099a8", "#9099a8", "#9099a8", "var(--brand)"];

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">Dashboard</h1>
          <p className="subtitle">Enquiries across all channels</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="card stat">
          <div className="label">Total enquiries</div>
          <div className="value">{data.totals.total_leads ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="label">AI-verified leads</div>
          <div className="value">{data.totals.total_qualified ?? 0}</div>
        </div>
        <div className="card stat warn">
          <div className="label">🚩 Needs follow-up</div>
          <div className="value">{data.overdue.length}</div>
          <div className="sub" style={{ color: "#9c6a0d" }}>No status change in 48h+</div>
        </div>
        <div className="card stat">
          <div className="label">Paid</div>
          <div className="value">{data.totals.total_paid ?? 0}</div>
        </div>
      </div>

      {data.overdue.length > 0 && (
        <div className="card panel" style={{ marginBottom: 16, background: "#fff7e9cc", borderColor: "#f3e0ae" }}>
          <h3>🚩 Needs follow-up</h3>
          {data.overdue.map((o: any) => (
            <div className="recent-item" key={o.id}>
              <span style={{ flex: 1 }}>
                {o.contact_name ?? "Unknown"} {o.contact_org ? `· ${o.contact_org}` : ""}
              </span>
              <Pri level={o.priority} />
              <span style={{ color: "var(--ink-soft)" }}>{timeAgo(o.reminder_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="dash-grid">
        <div className="card panel">
          <h3>
            By pipeline stage
            <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }}>
              {data.totals.total_leads ?? 0} total
            </span>
          </h3>
          <div style={{ display: "flex", gap: 18, height: 140, padding: "10px 0" }}>
            {STAGES.map((stage) => {
              const row = data.byStage.find((s: any) => s.stage === stage);
              const count = row?.count ?? 0;
              return (
                <div key={stage} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", textAlign: "center", flex: 1 }}>
                  <div style={{ background: STAGE_VAR[stage], height: `${Math.max(4, (count / maxStage) * 100)}%`, borderRadius: "6px 6px 0 0" }} />
                  <div style={{ fontSize: 11.5, marginTop: 6 }}>{STAGE_LABEL[stage]} {count}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card panel">
          <h3>Recent enquiries</h3>
          {data.recent.map((r: any) => (
            <div className="recent-item" key={r.id}>
              <span style={{ flex: 1 }}>
                {r.contact_name ?? "Unknown"} {r.contact_org && <span style={{ color: "var(--ink-soft)" }}>· {r.contact_org}</span>}
              </span>
              <span style={{ color: "var(--ink-soft)" }}>{STAGE_LABEL[r.stage]}</span>
            </div>
          ))}
          {data.recent.length === 0 && <p className="verdict-box">No enquiries yet.</p>}
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card panel">
          <h3>By category</h3>
          <div style={{ display: "flex", gap: 14, height: 120, padding: "10px 0" }}>
            {data.byCategory.map((c: any, i: number) => (
              <div key={c.category} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", textAlign: "center", flex: 1 }}>
                <div style={{ background: categoryColors[i % categoryColors.length], height: `${Math.max(4, (c.count / maxCategory) * 100)}%`, borderRadius: "6px 6px 0 0" }} />
                <div style={{ fontSize: 11, marginTop: 6 }}>{c.category} {c.count}</div>
              </div>
            ))}
            {data.byCategory.length === 0 && <p className="verdict-box">No data yet.</p>}
          </div>
        </div>
        <div className="card panel">
          <h3>By priority</h3>
          {data.byPriority.map((p: any) => (
            <div className="bar-row" key={p.priority}>
              <span style={{ width: 90 }}>{p.priority}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max(4, (p.count / (data.totals.total_leads || 1)) * 100)}%`,
                    background: p.priority === "High" ? "var(--high)" : "var(--low)",
                  }}
                />
              </div>
              <span>{p.count}</span>
            </div>
          ))}
          {data.byPriority.length === 0 && <p className="verdict-box">No data yet.</p>}
        </div>
      </div>
    </section>
  );
}
