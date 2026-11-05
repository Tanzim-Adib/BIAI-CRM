"use client";

import { useEffect, useState } from "react";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any | null>(null);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    load();
    // Real but simple: re-check every 60s while the app is open, instead of
    // needing a push service. Good enough for a single-user demo session.
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(".notif-wrap")) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const total = data?.total ?? 0;

  return (
    <div className="notif-wrap" style={{ position: "relative" }}>
      <div
        className="icon-btn"
        style={{ position: "relative" }}
        onClick={() => {
          setOpen((v) => !v);
          load();
        }}
      >
        🔔
        {total > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: "var(--high)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 999,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {total}
          </span>
        )}
      </div>

      {open && (
        <div className="avatar-menu show" style={{ width: 320, padding: 10 }}>
          <div className="who" style={{ fontWeight: 700 }}>Notifications</div>
          {!data ? (
            <p className="verdict-box">Loading…</p>
          ) : total === 0 && data.unclaimed.length === 0 && (!data.needsAttention || data.needsAttention.length === 0) ? (
            <p className="verdict-box">Nothing needs attention right now.</p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {data.needsAttention && data.needsAttention.length > 0 && (
                <>
                  <div className="notif-section">⚡ Needs attention now (High priority)</div>
                  {data.needsAttention.map((n: any) => (
                    <div className="notif-row" key={`a${n.id}`}>
                      {n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}
                    </div>
                  ))}
                </>
              )}
              {data.escalated.length > 0 && (
                <>
                  <div className="notif-section">🚩 Escalated</div>
                  {data.escalated.map((n: any) => (
                    <div className="notif-row" key={`e${n.id}`}>
                      {n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}
                    </div>
                  ))}
                </>
              )}
              {data.overdue.length > 0 && (
                <>
                  <div className="notif-section">⏱ Needs follow-up (48h+)</div>
                  {data.overdue.map((n: any) => (
                    <div className="notif-row" key={`o${n.id}`}>
                      {n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}
                    </div>
                  ))}
                </>
              )}
              {data.unclaimed.length > 0 && (
                <>
                  <div className="notif-section">📥 Unclaimed leads</div>
                  {data.unclaimed.map((n: any) => (
                    <div className="notif-row" key={`u${n.id}`}>
                      {n.contact_name ?? "Unknown"} {n.contact_org ? `· ${n.contact_org}` : ""} — {n.category}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
