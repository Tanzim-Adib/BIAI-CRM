import db from "./db";

export function runEscalationCheck() {
  const intervalMs = Number(process.env.ESCALATION_INTERVAL_MS || 12 * 60 * 60 * 1000);
  const now = new Date().toISOString();
  const overdueEscalations = db.prepare("SELECT id FROM leads WHERE escalated = 1 AND resolved_at IS NULL AND stage NOT IN ('paid','lost') AND next_escalation_at IS NOT NULL AND datetime(next_escalation_at) <= datetime(?)").all(now) as Array<{id:number}>;
  const reset = db.prepare("UPDATE leads SET next_escalation_at = ?, updated_at = datetime('now') WHERE id = ?");
  const notify = db.prepare("INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, NULL, 'escalation_reminder', ?)");
  for (const lead of overdueEscalations) {
    db.transaction(() => {
      notify.run(lead.id, "Escalation timer elapsed; reminder generated.");
      reset.run(new Date(Date.now() + intervalMs).toISOString(), lead.id);
    })();
  }

  const unviewedMs = Number(process.env.UNVIEWED_HIGH_PRIORITY_MS || 60 * 1000);
  db.prepare(`UPDATE leads SET priority = 'High', updated_at = datetime('now')
    WHERE priority != 'High' AND stage NOT IN ('paid','lost') AND resolved_at IS NULL
    AND datetime(COALESCE(last_seen_at, created_at), '+' || ? || ' milliseconds') <= datetime(?)`)
    .run(unviewedMs, now);

  const initialReminderMs = Number(process.env.FOLLOW_UP_MS || 48 * 60 * 60 * 1000);
  db.prepare("UPDATE leads SET reminder_at = ? WHERE reminder_at IS NULL AND lead_verdict = 'Lead' AND stage = 'new'")
    .run(new Date(Date.now() + initialReminderMs).toISOString());
}
