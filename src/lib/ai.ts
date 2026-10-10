// AI layer. The real Ollama call is NOT built yet (phase 2). Everything here is safe without it.
import fs from "node:fs";
import path from "node:path";
import { env } from "./config";

export type Extracted = {
  service_date: string | null; odometer_km: number | null; workshop_name: string | null;
  service_type: string | null; battery_notes: string | null; total_amount: number | null;
  confidence: Record<string, number>;
};

// Cached sample extractions for the 3 demo receipts, keyed by file SHA-256 (works even if renamed).
export const SAMPLES: Record<string, Extracted> = {
  b9b65096425f554deb9120146190ee49dc8cd7d43c054d1a235e91dba27094e7: {
    service_date: "2026-03-14", odometer_km: 47850, workshop_name: "VoltCare Auto Works", service_type: "inspection",
    battery_notes: "State of health 95%, no faults", total_amount: 11000,
    confidence: { service_date: 0.98, odometer_km: 0.97, workshop_name: 0.98, service_type: 0.9, battery_notes: 0.95, total_amount: 0.97 },
  },
  bd38cf57198871d093077204458952e2f75ba7a3f76db485722f830c69c649b3: {
    service_date: "2026-08-22", odometer_km: 61300, workshop_name: "GreenCell EV Service Centre", service_type: "service",
    battery_notes: "Battery cooling system service. State of health 94%, no faults", total_amount: 16000,
    confidence: { service_date: 0.98, odometer_km: 0.97, workshop_name: 0.97, service_type: 0.88, battery_notes: 0.93, total_amount: 0.97 },
  },
  e0be9b9bf971a4589b2c40d0aefedeb02d60267fc9aa1373df23fca44f23407f: {
    service_date: "2026-10-05", odometer_km: 52100, workshop_name: "Metro EV Garage", service_type: "inspection",
    battery_notes: "State of health 94%, no faults", total_amount: 11000,
    confidence: { service_date: 0.98, odometer_km: 0.96, workshop_name: 0.97, service_type: 0.9, battery_notes: 0.95, total_amount: 0.97 },
  },
};

/** Document Agent hook. Phase 2: replace the TODO with a real Ollama vision call + zod validation. */
export async function extractFromReceipt(sha: string, _filePath: string): Promise<{ data: Extracted | null; source: "cached_sample" | "manual"; model: string | null; message: string }> {
  if (env.useCached && SAMPLES[sha]) return { data: SAMPLES[sha], source: "cached_sample", model: "cached-sample", message: "Used cached sample extraction." };
  // TODO(phase 2): POST `${env.ollamaUrl}/api/chat` with env.ollamaModel and the image, request JSON, validate with zod, retry once.
  return { data: null, source: "manual", model: null, message: "AI extraction is not connected yet. Please enter the fields manually." };
}

export async function ollamaHealth(): Promise<{ reachable: boolean; modelLoaded: boolean; model: string }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`${env.ollamaUrl}/api/tags`, { signal: ctl.signal });
    clearTimeout(t);
    const j = (await r.json()) as { models?: { name: string }[] };
    return { reachable: true, modelLoaded: !!j.models?.some((m) => m.name.startsWith(env.ollamaModel.split(":")[0])), model: env.ollamaModel };
  } catch {
    return { reachable: false, modelLoaded: false, model: env.ollamaModel };
  }
}

export const fileExists = (p: string) => fs.existsSync(path.resolve(p));
