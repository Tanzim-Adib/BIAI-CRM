"use client";

import { useEffect, useState } from "react";

type Escalation = { id: number; external_id?: string; category: string; contact_name: string | null; next_escalation_at: string | null };

function formatCountdown(deadline: string | null, now: number) {
  if (!deadline) return "—";
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [now, setNow] = useState(Date.now());

  function load() {
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((result) => { if (!result.error) setData(result); })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const poll = window.setInterval(load, 15000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(poll); window.clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".notif-wrap")) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const total = data?.total ?? 0;
  const escalated: Escalation[] = data?.escalated ?? [];

  return (
    <div className="notif-wrap" style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Notifications${total ? ` (${total})` : ""}`}
        className="icon-btn"
        style={{ position: "relative", border: 0, cursor: "pointer" }}
        onClick={() => { setOpen((v) => !v); load(); }}
      >
        🔔
        {total > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--high)", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{total}</span>}
      </button>

      {open && (
        <div className="avatar-menu show" style={{ width: 340, padding: 10 }}>
          <div className="who" style={{ fontWeight: 700 }}>Notifications</div>
          {!data ? <p className="verdict-box">Loading…</p> : (
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {escalated.length > 0 && <>
                <div className="notif-section" style={{ color: "#b42318" }}>🚨 Escalation countdowns</div>
                {escalated.map((item) => {
                  const remaining = item.next_escalation_at ? new Date(item.next_escalation_at).getTime() - now : 0;
                  return <div className="notif-row" key={`e${item.id}`} style={{ color: "#b42318", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{item.contact_name ?? "Unknown"} — {item.category}</span>
                    <strong style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{remaining <= 0 ? "Reminder due" : formatCountdown(item.next_escalation_at, now)}</strong>
                  </div>;
                })}
              </>}
              {data.needsAttention?.length > 0 && <>
                <div className="notif-section">⚡ Needs attention now (High priority)</div>
                {data.needsAttention.map((n: any) => <div className="notif-row" key={`a${n.id}`}>{n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}</div>)}
              </>}
              {data.overdue?.length > 0 && <>
                <div className="notif-section">⏱ Needs follow-up</div>
                {data.overdue.map((n: any) => <div className="notif-row" key={`o${n.id}`}>{n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}</div>)}
              </>}
              {data.unclaimed?.length > 0 && <>
                <div className="notif-section">📥 Unclaimed leads</div>
                {data.unclaimed.map((n: any) => <div className="notif-row" key={`u${n.id}`}>{n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}</div>)}
              </>}
              {total === 0 && data.unclaimed?.length === 0 && <p className="verdict-box">Nothing needs attention right now.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
