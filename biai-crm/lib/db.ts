import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "biai-crm.db");

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', -- 'staff' | 'admin'
  invite_code_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  email TEXT,
  org TEXT,
  channel TEXT, -- 'whatsapp' | 'facebook' | 'website' | 'phone'
  ai_summary TEXT, -- AI's running read on this contact (tone, likely intent),
                    -- built by the per-lead "Ask AI" chat; feeds the contact graph
  hidden_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  person_id TEXT,
  contact_id INTEGER NOT NULL,
  raw_text TEXT NOT NULL,            -- original pasted conversation/notes
  channel TEXT,
  category TEXT,                     -- AI-derived enquiry category
  priority TEXT,                     -- High | Medium | Low
  lead_verdict TEXT,                 -- 'Lead' | 'Not a lead'
  lead_reasoning TEXT,               -- short AI reasoning summary
  estimated_value TEXT,              -- AI rough estimate (range or number, as text)
  suggested_reply TEXT,              -- AI-drafted reply grounded in knowledge base
  stage TEXT NOT NULL DEFAULT 'new', -- new | contacted | interested | paid | lost
  assigned_to INTEGER,               -- user_id
  reminder_at TEXT,                  -- 48h follow-up due time
  escalated INTEGER NOT NULL DEFAULT 0,
  taken_by INTEGER,                  -- user_id who claimed ("Lead taken") this enquiry; distinct from stage
  taken_at TEXT,
  resolved_at TEXT,                  -- set when staff explicitly marks it resolved; distinct from stage too
  coin_status TEXT NOT NULL DEFAULT 'not_eligible',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,              -- 'created' | 'stage_changed' | 'reassigned' | 'escalated' | 'taken' | 'resolved' | 'edited' | 'note'
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS lead_stage_proof (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_mime TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
`);

// Guards for upgrading a database created before taken_by/taken_at/resolved_at
// existed — CREATE TABLE IF NOT EXISTS above is a no-op on an existing table,
// so new columns need an explicit ALTER. Safe to run every startup: SQLite
// errors (harmlessly) if the column is already there, which we swallow.
for (const stmt of [
  "ALTER TABLE leads ADD COLUMN taken_by INTEGER",
  "ALTER TABLE leads ADD COLUMN taken_at TEXT",
  "ALTER TABLE leads ADD COLUMN resolved_at TEXT",
  "ALTER TABLE contacts ADD COLUMN ai_summary TEXT",
  "ALTER TABLE contacts ADD COLUMN hidden_at TEXT",
  // Set when intake only found a same-name, same-channel contact (the
  // weakest matching signal — names repeat, so this is never auto-merged).
  // Surfaced as a heads-up in the UI so staff can ask the sender directly
  // rather than the system silently assuming or revealing prior history.
  "ALTER TABLE leads ADD COLUMN possible_contact_id INTEGER",
  "ALTER TABLE contacts ADD COLUMN person_id TEXT UNIQUE",
  "ALTER TABLE leads ADD COLUMN external_id TEXT UNIQUE",
  "ALTER TABLE leads ADD COLUMN coin_status TEXT NOT NULL DEFAULT 'not_eligible'",
  "ALTER TABLE leads ADD COLUMN person_id TEXT",
  "ALTER TABLE lead_stage_proof ADD COLUMN stage TEXT",
]) {
  try {
    db.exec(stmt);
  } catch {
    // column already exists — fine
  }
}

export default db;
