import db from "./db";

// AF-9: tiered escalation. A High-priority lead whose 48h reminder has
// passed AND sat unactioned for a further 24h (72h total) auto-escalates —
// no real email/telephony hookup here (that needs a paid provider, out of
// scope under the free-tier constraint), but the escalated flag is real and
// drives the notifications bell, the contact-graph red state (AF-11), and
// the Dashboard's escalated count. Called from any route that reads lead
// state, so the check runs on normal page loads rather than needing a cron.
export function runEscalationCheck() {
  db.prepare(
    `UPDATE leads
     SET escalated = 1
     WHERE escalated = 0
       AND priority = 'High'
       AND stage NOT IN ('paid', 'lost')
       AND resolved_at IS NULL
       AND reminder_at IS NOT NULL
       AND datetime(reminder_at, '+24 hours') < datetime('now')`
  ).run();
}
