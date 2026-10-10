import { db, getSetting } from "./db";

export const getVehicle = () => db().prepare("SELECT * FROM vehicles LIMIT 1").get() as {
  id: number; make: string; model: string; year: number; plate: string; battery_kwh: number; odometer_km: number; cmp_label: string; cmp_fuel: string; cmp_km_per_litre: number };

export type EntryRow = { id: number; type: string; date: string; odometer: number | null; workshop: string | null; notes: string | null; evidence_receipt_id: number | null; source: string; data_source_type: string; status: string; status_reason: string; is_duplicate: number };
export const getEntries = (limit = 500) => db().prepare("SELECT * FROM entries ORDER BY date DESC, id DESC LIMIT ?").all(limit) as EntryRow[];

export const pointsBalance = () => (db().prepare("SELECT COALESCE(SUM(points),0) b FROM points_ledger").get() as { b: number }).b;

/** Ledger totals grouped by data source type for a month (YYYY-MM) or all time. */
export function ledgerSummary(month?: string) {
  const rows = db().prepare(`SELECT kind, data_source_type t, SUM(value) v, unit FROM ledger WHERE (? IS NULL OR substr(date,1,7)=?) GROUP BY kind, data_source_type, unit`).all(month ?? null, month ?? null) as { kind: string; t: string; v: number; unit: string }[];
  const get = (kind: string, t?: string) => rows.filter((r) => r.kind === kind && (!t || r.t === t)).reduce((a, r) => a + r.v, 0);
  return { rows, get };
}

export function goalProgress(month: string) {
  const type = getSetting("goal_type"); const target = Number(getSetting("goal_target")) || 0;
  if (type === "intensity") {
    const s = ledgerSummary(month);
    const km = s.get("distance_km"); const kg = s.get("charging_emissions_kg");
    const gPerKm = km > 0 ? (kg / km) * 1000 : null;
    return { type, target, label: `Keep estimated charging emissions at or below ${target} g CO2e/km`, current: gPerKm, text: gPerKm == null ? "No distance logged this month" : `${gPerKm.toFixed(0)} g/km this month (estimate)`, pct: gPerKm == null ? 0 : Math.min(100, Math.round((target / Math.max(gPerKm, 1)) * 100)) };
  }
  const n = (db().prepare("SELECT COUNT(*) c FROM entries WHERE status='validated' AND substr(date,1,7)=?").get(month) as { c: number }).c;
  return { type, target, label: `Log ${target} validated maintenance actions this month`, current: n, text: `${n} of ${target} validated this month`, pct: target ? Math.min(100, Math.round((n / target) * 100)) : 0 };
}

export const thisMonth = () => new Date().toISOString().slice(0, 7);
