import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { env } from "./config";
import { ledgerRowsForCharging, missingInspection, pointsFor } from "./logic";

type DB = DatabaseSync;
const g = globalThis as unknown as { __db?: DB };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, make TEXT, model TEXT, year INTEGER, plate TEXT,
  battery_kwh REAL, odometer_km INTEGER, cmp_label TEXT, cmp_fuel TEXT, cmp_km_per_litre REAL
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER, type TEXT, date TEXT, odometer INTEGER,
  workshop TEXT, notes TEXT, evidence_receipt_id INTEGER, evidence_hash TEXT,
  source TEXT, data_source_type TEXT, status TEXT, status_reason TEXT, fingerprint TEXT,
  is_duplicate INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, original_name TEXT, stored_path TEXT, mime TEXT, sha256 TEXT,
  status TEXT, is_duplicate_file INTEGER DEFAULT 0, extracted_json TEXT, extraction_source TEXT,
  edited_by_user INTEGER DEFAULT 0, job_id INTEGER, entry_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, payload TEXT, status TEXT DEFAULT 'queued',
  attempts INTEGER DEFAULT 0, report TEXT, error TEXT,
  created_at TEXT DEFAULT (datetime('now')), started_at TEXT, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT DEFAULT (datetime('now')), agent TEXT, action TEXT,
  inputs TEXT, outcome TEXT, job_id INTEGER, model TEXT, edited_by_user INTEGER
);
CREATE TRIGGER IF NOT EXISTS activity_no_update BEFORE UPDATE ON activity_log BEGIN SELECT RAISE(ABORT,'activity_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS activity_no_delete BEFORE DELETE ON activity_log BEGIN SELECT RAISE(ABORT,'activity_log is append-only'); END;
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, message TEXT, entry_id INTEGER, status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS charging_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, kwh REAL, cost REAL, distance_km REAL,
  data_source_type TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, kind TEXT, value REAL, unit TEXT,
  data_source_type TEXT, session_id INTEGER, note TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, points INTEGER, reason TEXT, activity_type TEXT,
  source_kind TEXT, source_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reward_id TEXT, name TEXT, cost INTEGER, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, description TEXT, data_involved TEXT, payload TEXT,
  status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')), decided_at TEXT
);
CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE, revoked INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`;

function seed(db: DB) {
  const defaults: Record<string, string> = {
    paused: "0", perm_documents: "1", perm_charging: "1", perm_location: "0",
    goal_type: "actions", goal_target: "2", last_run: "",
  };
  for (const [k, v] of Object.entries(defaults)) db.prepare("INSERT OR IGNORE INTO settings VALUES (?,?)").run(k, v);

  if (db.prepare("SELECT COUNT(*) c FROM vehicles").get() && (db.prepare("SELECT COUNT(*) c FROM vehicles").get() as { c: number }).c > 0) return;

  db.prepare(`INSERT INTO vehicles (make,model,year,plate,battery_kwh,odometer_km,cmp_label,cmp_fuel,cmp_km_per_litre)
    VALUES ('BYD','Atto 3',2023,'KHI-4821',60.48,62000,'Suzuki Alto 660cc (base comparison)','petrol',18)`).run();

  const ins = db.prepare(`INSERT INTO entries (vehicle_id,type,date,odometer,workshop,notes,source,data_source_type,status,status_reason,fingerprint)
    VALUES (1,?,?,?,?,?, 'seed','user_entered','needs_review',?,?)`);
  // Seed history is older than 12 months, so the demo starts with a "missing inspection" alert.
  ins.run("inspection", "2024-11-20", 28400, "BYD Authorized Service, Karachi", "Initial battery inspection. SoH 99%.", "Seed demo record, no evidence file.", "seed1");
  ins.run("service", "2025-09-12", 38900, "VoltCare Auto Works", "Routine service.", "Seed demo record, no evidence file.", "seed2");

  const cs = db.prepare("INSERT INTO charging_sessions (date,kwh,cost,distance_km,data_source_type) VALUES (?,?,?,?,?)");
  const led = db.prepare("INSERT INTO ledger (date,kind,value,unit,data_source_type,session_id,note) VALUES (@date,@kind,@value,@unit,@data_source_type,@session_id,@note)");
  const pts = db.prepare("INSERT INTO points_ledger (points,reason,activity_type,source_kind,source_id) VALUES (?,?,?,?,?)");
  const today = new Date();
  const d = (back: number) => new Date(today.getTime() - back * 86400000).toISOString().slice(0, 10);
  const rows: [number, number, number, number, string][] = [
    [2, 38.5, 1925, 210, "measured"], [6, 41.2, 2060, 225, "measured"],
    [9, 30.0, 1500, 160, "user_entered"], [13, 44.0, 2200, 240, "measured"], [17, 35.5, 1775, 190, "user_entered"],
  ];
  for (const [back, kwh, cost, km, type] of rows) {
    const r = cs.run(d(back), kwh, cost, km, type);
    const id = Number(r.lastInsertRowid);
    for (const row of ledgerRowsForCharging(d(back), kwh, km, type, 18, id)) led.run(row);
    const p = pointsFor("charging", { status: "validated", isDuplicate: false, hasEvidence: type === "measured", usedThisMonth: 0 });
    pts.run(p.points, p.reason, "charging", "charging_session", id);
  }
  const entries = db.prepare("SELECT * FROM entries").all() as never[];
  const m = missingInspection(entries, 62000, today);
  if (m) db.prepare("INSERT INTO alerts (kind,message) VALUES (?,?)").run(m.kind, m.message);
  db.prepare("INSERT INTO activity_log (agent,action,inputs,outcome) VALUES ('System','Seeded demo data','1 vehicle, 2 timeline entries, 5 charging sessions','ok')").run();
}

export function db(): DB {
  if (g.__db) return g.__db;
  fs.mkdirSync(path.dirname(path.resolve(env.dbPath)), { recursive: true });
  fs.mkdirSync(path.resolve(env.uploadDir), { recursive: true });
  const d = new DatabaseSync(path.resolve(env.dbPath));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  d.exec(SCHEMA);
  seed(d);
  g.__db = d;
  return d;
}

export const getSetting = (k: string) => (db().prepare("SELECT value FROM settings WHERE key=?").get(k) as { value: string } | undefined)?.value ?? "";
export const setSetting = (k: string, v: string) => db().prepare("INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);

export function log(agent: string, action: string, inputs: string, outcome: string, jobId?: number | null, model?: string | null, edited?: boolean) {
  db().prepare("INSERT INTO activity_log (agent,action,inputs,outcome,job_id,model,edited_by_user) VALUES (?,?,?,?,?,?,?)")
    .run(agent, action, inputs, outcome, jobId ?? null, model ?? null, edited == null ? null : edited ? 1 : 0);
}
