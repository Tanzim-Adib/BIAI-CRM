"use client";

import { useState } from "react";
import AiIcon from "./AiIcon";

type Turn = { role: "user" | "model"; text: string };

const QUICK_ACTIONS = [
  { label: "Rephrase more formally", prompt: "Rephrase the suggested reply to sound more formal." },
  { label: "Rephrase shorter", prompt: "Rephrase the suggested reply to be much shorter and punchier." },
  { label: "Read their tone", prompt: "What does this client's wording suggest about them — mood, urgency, price sensitivity?" },
  { label: "Suggest reply angles", prompt: "Give me 2-3 different angles I could take in my reply, with tradeoffs." },
];

export default function AskAiPanel({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [summarized, setSummarized] = useState(false);

  async function send(message: string, summarize = false) {
    if (loading) return;
    setLoading(true);
    const nextTurns = message ? [...turns, { role: "user" as const, text: message }] : turns;
    if (message) setTurns(nextTurns);
    setInput("");

    try {
      const res = await fetch(`/api/leads/${leadId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: turns, summarize }),
      });
      const data = await res.json();
      if (data.reply) {
        setTurns((t) => [...t, { role: "model", text: data.reply }]);
        if (summarize) setSummarized(true);
      } else if (data.error) {
        setTurns((t) => [...t, { role: "model", text: `⚠️ ${data.error}` }]);
      }
    } catch {
      setTurns((t) => [...t, { role: "model", text: "⚠️ Couldn't reach the AI — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: "6px 10px" }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <AiIcon size={11} /> Ask AI
      </button>
    );
  }

  return (
    <div
      style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 10, padding: 10, background: "#fff" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="row-between" style={{ marginTop: 0, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700 }}><AiIcon size={11} /> Ask AI about this lead</span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 10, padding: "3px 7px" }}
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.label}
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: "4px 8px" }}
            disabled={loading}
            onClick={() => send(qa.prompt)}
          >
            {qa.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: 10, padding: "4px 8px", opacity: summarized ? 0.6 : 1 }}
          disabled={loading}
          onClick={() => send("", true)}
        >
          {summarized ? "✓ Saved to profile" : "Summarize to profile"}
        </button>
      </div>

      {turns.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                padding: "7px 9px",
                borderRadius: 8,
                background: t.role === "user" ? "#f1eef7" : "#fffaf4",
                alignSelf: t.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                whiteSpace: "pre-wrap",
              }}
            >
              {t.text}
            </div>
          ))}
          {loading && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Thinking…</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) send(input.trim());
          }}
          placeholder="Ask anything about this lead…"
          style={{ flex: 1, fontSize: 12, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px" }}
        />
        <button
          type="button"
          className="btn btn-dark"
          style={{ fontSize: 11, padding: "6px 12px" }}
          disabled={loading || !input.trim()}
          onClick={() => input.trim() && send(input.trim())}
        >
          Send
        </button>
      </div>
    </div>
  );
}
