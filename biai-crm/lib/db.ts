import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "biai-crm.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
  escalated_at TEXT,
  next_escalation_at TEXT,
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
  approval_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS lead_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT UNIQUE NOT NULL,
  lead_id INTEGER NOT NULL,
  channel TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
`);

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Idempotent migrations for databases created by earlier app versions.
ensureColumn("contacts", "person_id", "TEXT");
ensureColumn("contacts", "ai_summary", "TEXT");
ensureColumn("contacts", "hidden_at", "TEXT");
ensureColumn("leads", "external_id", "TEXT");
ensureColumn("leads", "person_id", "TEXT");
ensureColumn("leads", "possible_contact_id", "INTEGER");
ensureColumn("leads", "taken_by", "INTEGER");
ensureColumn("leads", "taken_at", "TEXT");
ensureColumn("leads", "resolved_at", "TEXT");
ensureColumn("leads", "last_seen_at", "TEXT");
ensureColumn("leads", "coin_status", "TEXT NOT NULL DEFAULT 'not_eligible'");
ensureColumn("leads", "escalated_at", "TEXT");
ensureColumn("leads", "next_escalation_at", "TEXT");
ensureColumn("lead_stage_proof", "approval_status", "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn("lead_stage_proof", "reviewed_by", "INTEGER");
ensureColumn("lead_stage_proof", "reviewed_at", "TEXT");

// Backfill public-safe opaque identifiers without changing numeric internal PKs.
const backfillContacts = db.prepare("UPDATE contacts SET person_id = ? WHERE id = ? AND person_id IS NULL");
for (const row of db.prepare("SELECT id FROM contacts WHERE person_id IS NULL").all() as Array<{ id: number }>) {
  backfillContacts.run(`P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, row.id);
}
const backfillLeads = db.prepare("UPDATE leads SET external_id = ?, person_id = (SELECT person_id FROM contacts WHERE contacts.id = leads.contact_id) WHERE id = ? AND (external_id IS NULL OR person_id IS NULL)");
for (const row of db.prepare("SELECT id FROM leads WHERE external_id IS NULL OR person_id IS NULL").all() as Array<{ id: number }>) {
  backfillLeads.run(`E-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, row.id);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_person_id ON contacts(person_id)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_id ON leads(external_id)");

export default db;
