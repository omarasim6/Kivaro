// Worker + Coordinator + specialist agents. Agents never send, pay, book or delete: they only create approvals.
import fs from "node:fs";
import path from "node:path";
import { db, getSetting, setSetting, log } from "./db";
import { env, EMISSIONS, DISCLAIMER } from "./config";
import { checkEntry, missingInspection, validate, pointsFor, type Entry } from "./logic";
import { extractFromReceipt } from "./ai";

type Job = { id: number; type: string; payload: string; attempts: number };
const vehicle = () => db().prepare("SELECT * FROM vehicles LIMIT 1").get() as { id: number; odometer_km: number; cmp_km_per_litre: number };
const monthOf = (d: string) => d.slice(0, 7);

export function enqueue(type: string, payload: object) {
  const r = db().prepare("INSERT INTO jobs (type,payload) VALUES (?,?)").run(type, JSON.stringify(payload));
  return Number(r.lastInsertRowid);
}

/** Req 4.3 + 4.5: recompute the missing-inspection alert. */
export function refreshInspectionAlert() {
  const v = vehicle();
  const entries = db().prepare("SELECT * FROM entries WHERE vehicle_id=?").all(v.id) as Entry[];
  const m = missingInspection(entries, v.odometer_km, new Date());
  const active = db().prepare("SELECT id FROM alerts WHERE kind='missing_inspection' AND status='active'").get() as { id: number } | undefined;
  if (m && !active) db().prepare("INSERT INTO alerts (kind,message) VALUES (?,?)").run(m.kind, m.message);
  if (!m && active) db().prepare("UPDATE alerts SET status='resolved' WHERE id=?").run(active.id);
}

// ---- Step 1: Document Agent -------------------------------------------------
async function stepExtract(job: Job, receiptId: number) {
  if (getSetting("perm_documents") !== "1") {
    log("Document Agent", "Extract receipt", `receipt #${receiptId}`, "Blocked: document access is disabled in Agent Controls", job.id);
    return { status: "needs_review", report: "Document access is turned off. Enable it in Agent Controls, then run again." };
  }
  const r = db().prepare("SELECT * FROM receipts WHERE id=?").get(receiptId) as { sha256: string; stored_path: string; is_duplicate_file: number } | undefined;
  if (!r) return { status: "failed", report: "Receipt not found." };
  const out = await extractFromReceipt(r.sha256, r.stored_path);
  db().prepare("UPDATE receipts SET extracted_json=?, extraction_source=?, status='awaiting_review' WHERE id=?")
    .run(out.data ? JSON.stringify(out.data) : null, out.source, receiptId);
  log("Document Agent", "Extract receipt fields", `receipt #${receiptId}${r.is_duplicate_file ? " (duplicate file hash)" : ""}`, out.message, job.id, out.model);
  return { status: "needs_review", report: `${out.message} Waiting for you to review and confirm the fields. Nothing is saved to the timeline until you confirm.` };
}

// ---- Coordinator: process a confirmed entry (checks -> ledger -> points -> summary) ----
function stepProcessEntry(job: Job, entryId: number) {
  const v = vehicle();
  const e = db().prepare("SELECT * FROM entries WHERE id=?").get(entryId) as Entry & { evidence_hash: string | null; fingerprint: string; source: string };
  if (!e) return { status: "failed", report: "Entry not found." };
  const steps: string[] = [];
  const sources: string[] = [];

  // Step 2: Battery-care Agent
  const others = db().prepare("SELECT * FROM entries WHERE vehicle_id=? AND id<>?").all(v.id, entryId) as Entry[];
  const alerts = checkEntry(e, others, v.odometer_km);
  for (const a of alerts) db().prepare("INSERT INTO alerts (kind,message,entry_id) VALUES (?,?,?)").run(a.kind, a.message, entryId);
  const conflict = alerts.some((a) => a.kind === "odometer_conflict" || a.kind === "implausible_value");
  const val = validate({ date: e.date, odometer: e.odometer, hasEvidence: !!e.evidence_hash, isDuplicate: !!e.is_duplicate, conflict });
  db().prepare("UPDATE entries SET status=?, status_reason=? WHERE id=?").run(val.status, val.reason, entryId);
  log("Battery-care Agent", "Timeline check", `entry #${entryId} ${e.date} @ ${e.odometer} km`, `${alerts.length} alert(s). Status: ${val.status}. ${val.reason}`, job.id);
  steps.push(`Checked the timeline: ${alerts.length ? alerts.map((a) => a.message).join(" ") : "no conflicts found"}. Entry marked ${val.status} (${val.reason})`);
  sources.push("Your battery timeline", "Configured plausibility ranges");
  refreshInspectionAlert();

  // Coordinator gate: stop if the check needs review (Req 5.5)
  if (conflict) {
    log("Coordinator", "Stopped before ledger/points", `entry #${entryId}`, "Needs review: timeline conflict", job.id);
    return { status: "needs_review", report: `${steps.join("\n")}\nI stopped here: this entry needs your review before the ledger or points are touched. No points awarded.\nSources: ${sources.join(", ")}.` };
  }

  // Step 3: Sustainability Agent updates the ledger
  const ledgerOk = val.status === "validated";
  if (ledgerOk) {
    db().prepare("INSERT INTO ledger (date,kind,value,unit,data_source_type,session_id,note) VALUES (?,?,?,?,?,?,?)")
      .run(e.date, "maintenance_action", 1, "action", "user_entered", entryId, `${e.type} record with evidence`);
    log("Sustainability Agent", "Update Impact Ledger", `entry #${entryId}`, "Added 1 maintenance action (user_entered)", job.id);
    steps.push("Updated the Impact Ledger with 1 maintenance action (user entered).");
  } else {
    steps.push("Ledger not updated because the entry is not validated.");
  }

  // Step 4: Points (deterministic)
  const used = (db().prepare("SELECT COUNT(*) c FROM points_ledger WHERE activity_type=? AND points>0 AND substr(created_at,1,7)=?").get(e.type, new Date().toISOString().slice(0, 7)) as { c: number }).c;
  const p = pointsFor(e.type, { status: val.status, isDuplicate: !!e.is_duplicate, hasEvidence: !!e.evidence_hash, usedThisMonth: used });
  db().prepare("INSERT INTO points_ledger (points,reason,activity_type,source_kind,source_id) VALUES (?,?,?,?,?)").run(p.points, p.reason, e.type, "entry", entryId);
  log("Sustainability Agent", "Evaluate EcoPoints", `entry #${entryId}`, `${p.points} points. ${p.reason}`, job.id);
  steps.push(`EcoPoints: ${p.points}. ${p.reason}`);
  sources.push("Points rules (config)");

  // Step 5: summary
  const report = `${steps.join("\n")}\nSources: ${sources.join(", ")}.\n${DISCLAIMER}.`;
  log("Coordinator", "Summary prepared", `job #${job.id}`, "Done", job.id);
  return { status: "succeeded", report };
}

// ---- Worker ----------------------------------------------------------------
export async function runOnce(manual = false): Promise<{ ran: number; message: string }> {
  if (getSetting("paused") === "1") return { ran: 0, message: "Agent is paused. Resume it to process jobs." };
  const recent = (db().prepare("SELECT COUNT(*) c FROM jobs WHERE started_at > datetime('now','-1 minute')").get() as { c: number }).c;
  if (recent >= env.maxJobsPerMin) return { ran: 0, message: "Rate limit reached for this minute." };
  setSetting("last_run", new Date().toISOString());
  refreshInspectionAlert();
  let ran = 0;
  for (let i = 0; i < Math.max(1, env.maxJobsPerMin - recent); i++) {
    const job = db().prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").get() as Job | undefined;
    if (!job) break;
    db().prepare("UPDATE jobs SET status='running', started_at=datetime('now'), attempts=attempts+1 WHERE id=?").run(job.id);
    job.attempts += 1;
    try {
      const payload = JSON.parse(job.payload);
      const res = job.type === "extract_receipt" ? await stepExtract(job, payload.receiptId)
        : job.type === "process_entry" ? stepProcessEntry(job, payload.entryId)
        : { status: "failed", report: `Unknown job type ${job.type}` };
      db().prepare("UPDATE jobs SET status=?, report=?, finished_at=datetime('now') WHERE id=?").run(res.status, res.report, job.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retry = job.attempts <= env.maxRetries;
      db().prepare("UPDATE jobs SET status=?, error=?, finished_at=datetime('now') WHERE id=?").run(retry ? "queued" : "failed", msg, job.id);
      log("Coordinator", retry ? "Job failed, will retry" : "Job failed", `job #${job.id}`, msg, job.id);
    }
    ran++;
  }
  return { ran, message: ran ? `Processed ${ran} job(s).` : manual ? "No queued jobs. Everything is up to date." : "idle" };
}

// ---- Approvals (Req 7) -----------------------------------------------------
export function propose(action: string, description: string, dataInvolved: string, payload: object = {}) {
  const r = db().prepare("INSERT INTO approvals (action,description,data_involved,payload) VALUES (?,?,?,?)").run(action, description, dataInvolved, JSON.stringify(payload));
  log("Coordinator", "Approval requested", description, "pending");
  return Number(r.lastInsertRowid);
}

export function decide(id: number, approve: boolean) {
  const a = db().prepare("SELECT * FROM approvals WHERE id=? AND status='pending'").get(id) as { action: string; description: string; payload: string } | undefined;
  if (!a) return;
  db().prepare("UPDATE approvals SET status=?, decided_at=datetime('now') WHERE id=?").run(approve ? "approved" : "rejected", id);
  if (approve) {
    const p = JSON.parse(a.payload);
    if (a.action === "share_report") {
      const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      db().prepare("INSERT INTO shares (token) VALUES (?)").run(token);
    }
    if (a.action === "delete_entry") {
      const e = db().prepare("SELECT evidence_receipt_id FROM entries WHERE id=?").get(p.entryId) as { evidence_receipt_id: number | null } | undefined;
      db().prepare("DELETE FROM entries WHERE id=?").run(p.entryId);
      db().prepare("UPDATE alerts SET status='resolved' WHERE entry_id=?").run(p.entryId);
      void e;
      refreshInspectionAlert();
    }
  }
  log("User", approve ? "Approved" : "Rejected", a.description, approve ? "Action performed" : "Action cancelled");
}

export function saveUpload(buf: Buffer, name: string) {
  const dir = path.resolve(env.uploadDir);
  fs.mkdirSync(dir, { recursive: true });
  const stored = path.join(dir, `${Date.now()}-${name.replace(/[^\w.\-]/g, "_")}`);
  fs.writeFileSync(stored, buf);
  return stored;
}
export { EMISSIONS, monthOf };
