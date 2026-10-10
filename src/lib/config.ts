import factors from "../../config/emission-factors.json";

export const env = {
  ollamaUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "gemma3:4b",
  ollamaTimeout: Number(process.env.OLLAMA_TIMEOUT_MS ?? 90000),
  useCached: (process.env.USE_CACHED_EXTRACTION ?? "true") === "true",
  dbPath: process.env.DATABASE_PATH ?? "./data/app.db",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  pollMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 10000),
  maxRetries: Number(process.env.WORKER_MAX_RETRIES ?? 2),
  maxJobsPerMin: Number(process.env.WORKER_MAX_JOBS_PER_MIN ?? 10),
};

export const EMISSIONS = factors;
export const DISCLAIMER = "Estimates only, not certified carbon savings";

// Business rules (configurable here)
export const RULES = {
  inspectionIntervalMonths: 12,
  inspectionIntervalKm: 10000,
  maxPlausibleOverCurrentKm: 5000, // odometer far above vehicle's current reading
  maxPlausibleKm: 1_000_000,
};

// EcoPoints: [with verified evidence, without evidence]
export const POINTS: Record<string, { evidence: number; noEvidence: number; capPerMonth: number; label: string }> = {
  service: { evidence: 50, noEvidence: 0, capPerMonth: 2, label: "Validated service record" },
  inspection: { evidence: 80, noEvidence: 0, capPerMonth: 2, label: "Completed battery inspection" },
  repair: { evidence: 50, noEvidence: 0, capPerMonth: 2, label: "Validated repair record" },
  recycling: { evidence: 120, noEvidence: 30, capPerMonth: 2, label: "Verified recycling / community activity" },
  charging: { evidence: 8, noEvidence: 4, capPerMonth: 10, label: "Charging session with usable energy data" },
};

export const ENTRY_TYPES = ["service", "inspection", "repair", "recycling"] as const;

export const REWARDS = [
  { id: "badge-first", name: "Battery Guardian badge", cost: 100, kind: "Badge" },
  { id: "badge-green", name: "Green Charger badge", cost: 60, kind: "Badge" },
  { id: "disc-wash", name: "10% off EV car wash", cost: 150, kind: "Discount" },
  { id: "disc-service", name: "PKR 1,000 off next battery scan", cost: 250, kind: "Discount" },
];
