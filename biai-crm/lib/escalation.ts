import db from "./db";

export function runEscalationCheck() {
  const intervalMs = Number(process.env.ESCALATION_INTERVAL_MS || 12 * 60 * 60 * 1000);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Existing escalations notify and roll their next deadline forward. This is
  // request-driven: the notification API runs it while the app is in use.
  const due = db.prepare(`SELECT id FROM leads WHERE escalated = 1 AND resolved_at IS NULL
    AND stage NOT IN ('paid','lost') AND next_escalation_at IS NOT NULL
    AND datetime(next_escalation_at) <= datetime(?)`).all(nowIso) as Array<{ id: number }>;
  const processDue = db.transaction(() => {
    for (const lead of due) {
      db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, NULL, 'escalation_reminder', ?)")
        .run(lead.id, "Escalation countdown elapsed; reminder generated.");
      db.prepare("UPDATE leads SET next_escalation_at = ?, updated_at = datetime('now') WHERE id = ?")
        .run(new Date(nowMs + intervalMs).toISOString(), lead.id);
    }
  });
  processDue();

  // Start automatic escalations for overdue High-priority enquiries and log
  // the transition so the action is visible to staff.
  const autoEscalate = db.prepare(`UPDATE leads SET escalated = 1, escalated_at = ?, next_escalation_at = ?, updated_at = datetime('now')
    WHERE escalated = 0 AND priority = 'High' AND stage NOT IN ('paid','lost')
    AND resolved_at IS NULL AND reminder_at IS NOT NULL AND datetime(reminder_at) <= datetime(?)`).run(
      nowIso, new Date(nowMs + intervalMs).toISOString(), nowIso
    );
  if (autoEscalate.changes > 0) {
    db.prepare(`INSERT INTO activity_log (lead_id, user_id, action, detail)
      SELECT id, NULL, 'escalated', 'Automatically escalated after overdue high-priority reminder'
      FROM leads WHERE escalated = 1 AND escalated_at = ?`).run(nowIso);
  }

  // Test override is 60 seconds; production defaults to 48h.
  const unviewedMs = Number(process.env.UNVIEWED_HIGH_PRIORITY_MS || 48 * 60 * 60 * 1000);
  db.prepare(`UPDATE leads SET priority = 'High', updated_at = 'now'
    WHERE priority != 'High' AND stage NOT IN ('paid','lost') AND resolved_at IS NULL
    AND datetime(COALESCE(last_seen_at, created_at), '+' || ? || ' seconds') <= datetime(?)`)
    .run(Math.ceil(unviewedMs / 1000), nowIso);
}
