// Deterministic logic only. No LLM, no database access here.
import { createHash } from "node:crypto";
import { EMISSIONS, POINTS, RULES } from "./config";

export type Entry = {
  id: number; type: string; date: string; odometer: number | null; workshop: string | null;
  evidence_hash: string | null; status: string; is_duplicate: number;
};

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function fingerprint(date: string, odometer: number | null, workshop: string | null) {
  return sha256(`${date}|${odometer ?? ""}|${(workshop ?? "").trim().toLowerCase()}`);
}

export type AlertDraft = { kind: "odometer_conflict" | "missing_inspection" | "implausible_value"; message: string; entry_id?: number };

/** Req 4.1/4.2/4.4: check a newly confirmed entry against the timeline. */
export function checkEntry(entry: Entry, others: Entry[], vehicleOdo: number): AlertDraft[] {
  const alerts: AlertDraft[] = [];
  if (entry.odometer == null) return alerts;
  for (const o of others) {
    if (o.odometer == null || o.id === entry.id || o.status === "rejected") continue;
    if (o.date < entry.date && o.odometer > entry.odometer)
      alerts.push({ kind: "odometer_conflict", entry_id: entry.id,
        message: `Odometer conflict: ${entry.date} shows ${entry.odometer.toLocaleString()} km, but earlier entry ${o.date} (#${o.id}) shows ${o.odometer.toLocaleString()} km.` });
    if (o.date > entry.date && o.odometer < entry.odometer)
      alerts.push({ kind: "odometer_conflict", entry_id: entry.id,
        message: `Odometer conflict: ${entry.date} shows ${entry.odometer.toLocaleString()} km, but later entry ${o.date} (#${o.id}) shows ${o.odometer.toLocaleString()} km.` });
  }
  if (entry.odometer > vehicleOdo + RULES.maxPlausibleOverCurrentKm || entry.odometer > RULES.maxPlausibleKm)
    alerts.push({ kind: "implausible_value", entry_id: entry.id,
      message: `Odometer ${entry.odometer.toLocaleString()} km is far above the vehicle's current ${vehicleOdo.toLocaleString()} km.` });
  return alerts;
}

/** Req 4.3: no inspection/service within interval (12 months or 10,000 km). */
export function missingInspection(entries: Entry[], vehicleOdo: number, today: Date): AlertDraft | null {
  const rel = entries.filter((e) => (e.type === "inspection" || e.type === "service") && e.status !== "rejected");
  if (!rel.length) return { kind: "missing_inspection", message: "No inspection or service on record." };
  const last = rel.reduce((a, b) => (a.date > b.date ? a : b));
  const months = (today.getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const km = last.odometer != null ? vehicleOdo - last.odometer : 0;
  if (months > RULES.inspectionIntervalMonths || km > RULES.inspectionIntervalKm)
    return { kind: "missing_inspection",
      message: `Last inspection/service was ${last.date} (${Math.floor(months)} months, ${km.toLocaleString()} km ago). Interval is ${RULES.inspectionIntervalMonths} months or ${RULES.inspectionIntervalKm.toLocaleString()} km.` };
  return null;
}

/** Req 3.3/3.4: validation status. */
export function validate(e: { date?: string | null; odometer?: number | null; hasEvidence: boolean; isDuplicate: boolean; conflict: boolean }) {
  if (e.isDuplicate) return { status: "rejected", reason: "Duplicate of an existing record." };
  if (!e.date || e.odometer == null) return { status: "needs_review", reason: "Date or odometer is missing." };
  if (e.conflict) return { status: "needs_review", reason: "Odometer conflicts with the timeline." };
  if (!e.hasEvidence) return { status: "needs_review", reason: "No evidence file attached." };
  return { status: "validated", reason: "Evidence attached, required fields present and consistent." };
}

/** Req 9: emissions, all deterministic. Returns kg. */
export const gridFactor = () => EMISSIONS.grid_electricity.value; // kg CO2e/kWh
export const petrolKgPerKm = (kmPerLitre: number) => EMISSIONS.petrol.value / kmPerLitre;
export const chargingKg = (kwh: number) => kwh * gridFactor();
export const avoidedKg = (distanceKm: number, kwh: number, kmPerLitre: number) =>
  distanceKm * petrolKgPerKm(kmPerLitre) - chargingKg(kwh);

/** Req 10: points. Returns 0 with a reason when not eligible. */
export function pointsFor(type: string, opts: { status: string; isDuplicate: boolean; hasEvidence: boolean; usedThisMonth: number }) {
  const rule = POINTS[type];
  if (!rule) return { points: 0, reason: "No points for this activity type." };
  if (opts.isDuplicate) return { points: 0, reason: "Duplicate: zero points." };
  if (opts.status !== "validated") return { points: 0, reason: `Status is ${opts.status}: no points until validated.` };
  if (opts.usedThisMonth >= rule.capPerMonth) return { points: 0, reason: `Monthly cap reached for ${type} (${rule.capPerMonth}).`, capped: true };
  const p = opts.hasEvidence ? rule.evidence : rule.noEvidence;
  return { points: p, reason: `${rule.label}${opts.hasEvidence ? " (verified evidence)" : " (user-entered, no evidence)"}` };
}

export type LedgerRow = { date: string; kind: string; value: number; unit: string; data_source_type: string; session_id: number; note: string };

/** Rows written to the Impact Ledger for one charging session. Derived rows are always model_estimated. */
export function ledgerRowsForCharging(date: string, kwh: number, distanceKm: number, srcType: string, kmPerLitre: number, sessionId: number): LedgerRow[] {
  const rows: LedgerRow[] = [{ date, kind: "energy_kwh", value: kwh, unit: "kWh", data_source_type: srcType, session_id: sessionId, note: "Charging energy" }];
  if (distanceKm > 0) rows.push({ date, kind: "distance_km", value: distanceKm, unit: "km", data_source_type: srcType, session_id: sessionId, note: "Distance driven" });
  rows.push({ date, kind: "charging_emissions_kg", value: +chargingKg(kwh).toFixed(3), unit: "kg CO2e", data_source_type: "model_estimated", session_id: sessionId, note: `kWh x ${gridFactor()} kg/kWh (${EMISSIONS.grid_electricity.data_year} grid average)` });
  if (distanceKm > 0) rows.push({ date, kind: "avoided_kg", value: +avoidedKg(distanceKm, kwh, kmPerLitre).toFixed(3), unit: "kg CO2e", data_source_type: "model_estimated", session_id: sessionId, note: `Versus comparison vehicle at ${kmPerLitre} km/L` });
  return rows;
}
