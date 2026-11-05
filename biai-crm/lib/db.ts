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
  role TEXT NOT NULL DEFAULT 'staff',
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
  channel TEXT,
  ai_summary TEXT,
  hidden_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  person_id TEXT,
  contact_id INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  channel TEXT,
  category TEXT,
  priority TEXT,
  lead_verdict TEXT,
  lead_reasoning TEXT,
  estimated_value TEXT,
  suggested_reply TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  assigned_to INTEGER,
  reminder_at TEXT,
  escalated INTEGER NOT NULL DEFAULT 0,
  taken_by INTEGER,
  taken_at TEXT,
  resolved_at TEXT,
  last_seen_at TEXT,
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
  action TEXT NOT NULL,
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

for (const stmt of [
  "ALTER TABLE leads ADD COLUMN taken_by INTEGER",
  "ALTER TABLE leads ADD COLUMN taken_at TEXT",
  "ALTER TABLE leads ADD COLUMN resolved_at TEXT",
  "ALTER TABLE contacts ADD COLUMN ai_summary TEXT",
  "ALTER TABLE contacts ADD COLUMN hidden_at TEXT",
  "ALTER TABLE leads ADD COLUMN possible_contact_id INTEGER",
  "ALTER TABLE contacts ADD COLUMN person_id TEXT UNIQUE",
  "ALTER TABLE leads ADD COLUMN external_id TEXT UNIQUE",
  "ALTER TABLE leads ADD COLUMN coin_status TEXT NOT NULL DEFAULT 'not_eligible'",
  "ALTER TABLE leads ADD COLUMN person_id TEXT",
  "ALTER TABLE leads ADD COLUMN last_seen_at TEXT",
  "ALTER TABLE lead_stage_proof ADD COLUMN stage TEXT",
]) {
  try {
    db.exec(stmt);
  } catch {
    // column already exists — safe no-op
  }
}

export default db;
