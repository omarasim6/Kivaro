// Background worker: polls the jobs table. Run with `npm run worker` (or `npm run dev:all`).
import { runOnce } from "../lib/agents";
import { env } from "../lib/config";

console.log(`[worker] started, polling every ${env.pollMs} ms`);
async function tick() {
  try {
    const r = await runOnce(false);
    if (r.ran) console.log(`[worker] ${r.message}`);
  } catch (e) {
    console.error("[worker] error", e);
  }
}
void tick();
setInterval(tick, env.pollMs);
