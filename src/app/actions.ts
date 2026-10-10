"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getSetting, setSetting, log } from "../lib/db";
import { sha256, fingerprint, ledgerRowsForCharging, pointsFor } from "../lib/logic";
import { enqueue, runOnce, saveUpload, propose, decide } from "../lib/agents";
import type { Extracted } from "../lib/ai";

const str = (f: FormData, k: string) => ((f.get(k) as string | null) ?? "").trim();
const num = (f: FormData, k: string) => { const v = str(f, k); return v === "" ? null : Number(v.replace(/,/g, "")); };
const refresh = () => revalidatePath("/", "layout");

// ---------- Receipts ----------
export async function uploadReceipt(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect("/upload?error=Please choose a file (JPG, PNG or PDF).");
  const okType = /\.(jpe?g|png|pdf)$/i.test(file.name);
  if (!okType) redirect("/upload?error=Only JPG, PNG or PDF files are allowed.");
  const buf = Buffer.from(await file.arrayBuffer());
  const sha = sha256(buf);
  const dup = db().prepare("SELECT id FROM receipts WHERE sha256=? LIMIT 1").get(sha);
  const stored = saveUpload(buf, file.name);
  const r = db().prepare("INSERT INTO receipts (original_name,stored_path,mime,sha256,status,is_duplicate_file) VALUES (?,?,?,?, 'uploaded', ?)")
    .run(file.name, stored, file.type, sha, dup ? 1 : 0);
  const id = Number(r.lastInsertRowid);
  const jobId = enqueue("extract_receipt", { receiptId: id });
  db().prepare("UPDATE receipts SET job_id=? WHERE id=?").run(jobId, id);
  log("System", "Receipt uploaded", `${file.name} (sha256 ${sha.slice(0, 12)}...)`, dup ? "FLAGGED: identical file already uploaded" : "Stored, extraction job queued", jobId);
  await runOnce(true);
  refresh();
  redirect(`/upload/${id}`);
}

type EntryInput = { type: string; date: string; odometer: number | null; workshop: string | null; notes: string | null; receiptId: number | null; source: string };

function createEntry(i: EntryInput) {
  const v = db().prepare("SELECT id FROM vehicles LIMIT 1").get() as { id: number };
  const rec = i.receiptId ? (db().prepare("SELECT sha256,is_duplicate_file FROM receipts WHERE id=?").get(i.receiptId) as { sha256: string; is_duplicate_file: number }) : null;
  const fp = fingerprint(i.date, i.odometer, i.workshop);
  const dupFp = db().prepare("SELECT id FROM entries WHERE fingerprint=? LIMIT 1").get(fp);
  const isDup = !!dupFp || !!rec?.is_duplicate_file;
  const r = db().prepare(`INSERT INTO entries (vehicle_id,type,date,odometer,workshop,notes,evidence_receipt_id,evidence_hash,source,data_source_type,status,status_reason,fingerprint,is_duplicate)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'processing', 'Waiting for the agent to check the timeline', ?, ?)`)
    .run(v.id, i.type, i.date, i.odometer, i.workshop, i.notes, i.receiptId, rec?.sha256 ?? null, i.source, "user_entered", fp, isDup ? 1 : 0);
  const entryId = Number(r.lastInsertRowid);
  if (i.receiptId) db().prepare("UPDATE receipts SET entry_id=?, status='confirmed' WHERE id=?").run(entryId, i.receiptId);
  const jobId = enqueue("process_entry", { entryId });
  return { entryId, jobId, isDup };
}

export async function confirmReceipt(formData: FormData) {
  const receiptId = Number(str(formData, "receiptId"));
  const date = str(formData, "date");
  if (!date) redirect(`/upload/${receiptId}?error=Service date is required.`);
  const rec = db().prepare("SELECT extracted_json, extraction_source FROM receipts WHERE id=?").get(receiptId) as { extracted_json: string | null; extraction_source: string | null };
  const orig = rec.extracted_json ? (JSON.parse(rec.extracted_json) as Extracted) : null;
  const odo = num(formData, "odometer");
  const workshop = str(formData, "workshop") || null;
  const type = str(formData, "type") || "service";
  const notes = str(formData, "notes") || null;
  const edited = !orig || orig.service_date !== date || orig.odometer_km !== odo || (orig.workshop_name ?? null) !== workshop || orig.service_type !== type || (orig.battery_notes ?? null) !== notes;
  db().prepare("UPDATE receipts SET edited_by_user=? WHERE id=?").run(edited ? 1 : 0, receiptId);
  const { entryId, jobId } = createEntry({ type, date, odometer: odo, workshop, notes, receiptId, source: "receipt" });
  log("User", "Confirmed extracted fields", `receipt #${receiptId} -> entry #${entryId}`, edited ? "Confirmed with edits" : "Confirmed as extracted", jobId, rec.extraction_source === "cached_sample" ? "cached-sample" : null, edited);
  await runOnce(true);
  refresh();
  redirect(`/agent?job=${jobId}`);
}

export async function addManualEntry(formData: FormData) {
  const date = str(formData, "date");
  if (!date) redirect("/passport?error=Date is required.");
  let receiptId: number | null = null;
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const sha = sha256(buf);
    const dup = db().prepare("SELECT id FROM receipts WHERE sha256=? LIMIT 1").get(sha);
    const stored = saveUpload(buf, file.name);
    const r = db().prepare("INSERT INTO receipts (original_name,stored_path,mime,sha256,status,is_duplicate_file,extraction_source) VALUES (?,?,?,?,'attached',?, 'manual')")
      .run(file.name, stored, file.type, sha, dup ? 1 : 0);
    receiptId = Number(r.lastInsertRowid);
  }
  const { entryId, jobId } = createEntry({ type: str(formData, "type") || "service", date, odometer: num(formData, "odometer"), workshop: str(formData, "workshop") || null, notes: str(formData, "notes") || null, receiptId, source: "manual" });
  log("User", "Added manual timeline entry", `entry #${entryId}`, receiptId ? "With evidence file" : "No evidence file", jobId);
  await runOnce(true);
  refresh();
  redirect(`/agent?job=${jobId}`);
}

// ---------- Charging / ledger ----------
export async function addCharging(formData: FormData) {
  const date = str(formData, "date");
  const kwh = num(formData, "kwh");
  if (!date || !kwh || kwh <= 0) redirect("/ledger?error=Date and a positive kWh are required.");
  const dist = num(formData, "distance_km") ?? 0;
  const cost = num(formData, "cost");
  const src = str(formData, "source") === "measured" ? "measured" : "user_entered";
  const v = db().prepare("SELECT cmp_km_per_litre FROM vehicles LIMIT 1").get() as { cmp_km_per_litre: number };
  const r = db().prepare("INSERT INTO charging_sessions (date,kwh,cost,distance_km,data_source_type) VALUES (?,?,?,?,?)").run(date, kwh, cost, dist, src);
  const id = Number(r.lastInsertRowid);
  const ins = db().prepare("INSERT INTO ledger (date,kind,value,unit,data_source_type,session_id,note) VALUES (@date,@kind,@value,@unit,@data_source_type,@session_id,@note)");
  for (const row of ledgerRowsForCharging(date, kwh, dist, src, v.cmp_km_per_litre, id)) ins.run(row);
  const used = (db().prepare("SELECT COUNT(*) c FROM points_ledger WHERE activity_type='charging' AND points>0 AND substr(created_at,1,7)=?").get(new Date().toISOString().slice(0, 7)) as { c: number }).c;
  const p = pointsFor("charging", { status: "validated", isDuplicate: false, hasEvidence: src === "measured", usedThisMonth: used });
  db().prepare("INSERT INTO points_ledger (points,reason,activity_type,source_kind,source_id) VALUES (?,?,?,?,?)").run(p.points, p.reason, "charging", "charging_session", id);
  log("Sustainability Agent", "Logged charging session", `${kwh} kWh on ${date} (${src})`, `Ledger updated. ${p.points} points. ${p.reason}`);
  refresh();
  redirect("/ledger");
}

export async function setGoal(formData: FormData) {
  setSetting("goal_type", str(formData, "goal_type") === "intensity" ? "intensity" : "actions");
  setSetting("goal_target", String(num(formData, "goal_target") ?? 2));
  refresh(); redirect("/ledger");
}

// ---------- Vehicle ----------
export async function saveVehicle(formData: FormData) {
  db().prepare("UPDATE vehicles SET make=?,model=?,year=?,plate=?,battery_kwh=?,odometer_km=?,cmp_label=?,cmp_fuel=?,cmp_km_per_litre=? WHERE id=1")
    .run(str(formData, "make"), str(formData, "model"), num(formData, "year"), str(formData, "plate"), num(formData, "battery_kwh"), num(formData, "odometer_km"), str(formData, "cmp_label"), str(formData, "cmp_fuel"), num(formData, "cmp_km_per_litre"));
  log("User", "Updated vehicle", `${str(formData, "make")} ${str(formData, "model")}`, "Saved");
  refresh(); redirect("/settings?saved=1");
}

// ---------- Agent controls ----------
export async function togglePause() {
  const p = getSetting("paused") === "1";
  setSetting("paused", p ? "0" : "1");
  log("User", p ? "Resumed agent" : "Paused agent", "", "ok");
  refresh();
}
export async function setPerm(formData: FormData) {
  const k = str(formData, "key");
  if (!["perm_documents", "perm_charging", "perm_location"].includes(k)) return;
  setSetting(k, getSetting(k) === "1" ? "0" : "1");
  log("User", "Changed agent permission", k, getSetting(k) === "1" ? "enabled" : "disabled");
  refresh();
}
export async function runNow() { await runOnce(true); refresh(); }

// ---------- Alerts ----------
export async function setAlert(formData: FormData) {
  const st = str(formData, "status") === "resolved" ? "resolved" : "dismissed";
  db().prepare("UPDATE alerts SET status=? WHERE id=?").run(st, Number(str(formData, "id")));
  log("User", `Alert ${st}`, `alert #${str(formData, "id")}`, "ok");
  refresh();
}

// ---------- Approvals / sharing ----------
export async function decideApproval(formData: FormData) {
  decide(Number(str(formData, "id")), str(formData, "decision") === "approve");
  refresh();
}
export async function requestShare() {
  propose("share_report", "Generate a public share link for your Battery Passport report", "Timeline entries, evidence file links, Impact Ledger summary");
  refresh(); redirect("/agent#approvals");
}
export async function revokeShare(formData: FormData) {
  db().prepare("UPDATE shares SET revoked=1 WHERE id=?").run(Number(str(formData, "id")));
  log("User", "Revoked share link", `share #${str(formData, "id")}`, "ok");
  refresh();
}
export async function requestDelete(formData: FormData) {
  const id = Number(str(formData, "id"));
  propose("delete_entry", `Delete timeline entry #${id}`, `Timeline entry #${id} and its record (evidence file stays on disk)`, { entryId: id });
  refresh(); redirect("/agent#approvals");
}

// ---------- Rewards ----------
export async function redeem(formData: FormData) {
  const { REWARDS } = await import("../lib/config");
  const rw = REWARDS.find((r) => r.id === str(formData, "id"));
  if (!rw) return;
  const bal = (db().prepare("SELECT COALESCE(SUM(points),0) b FROM points_ledger").get() as { b: number }).b;
  if (bal < rw.cost) redirect("/rewards?error=Not enough EcoPoints.");
  db().prepare("INSERT INTO redemptions (reward_id,name,cost) VALUES (?,?,?)").run(rw.id, rw.name, rw.cost);
  db().prepare("INSERT INTO points_ledger (points,reason,activity_type,source_kind,source_id) VALUES (?,?,?,?,?)").run(-rw.cost, `Redeemed: ${rw.name} (Demo reward - simulated)`, "redeem", "redemption", 0);
  log("User", "Redeemed demo reward", rw.name, "Demo reward - simulated");
  refresh(); redirect("/rewards?ok=1");
}
