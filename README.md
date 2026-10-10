# Kivora EV EcoPilot (Climate & Sustainability)

Next.js 16 + TypeScript + Tailwind + SQLite (built-in node:sqlite, needs Node 22.13+; no compiler needed). The AI part (Ollama) is a stub: the 3 demo receipts use cached extraction, anything else is entered manually.

## Run (3 commands)
    npm install
    cp .env.example .env      # Windows: copy .env.example .env
    npm run dev:all           # web (http://localhost:3000) + background worker

The database (data/app.db) is created and seeded automatically on first open.

## Demo path (under 2 minutes)
1. Dashboard: seeded BYD Atto 3, agent status, "missing inspection" alert.
2. Upload samples/receipt-1-battery-health-inspection.png -> review -> Confirm.
3. Agent page: Coordinator report and activity log. Dashboard shows points; alert resolved.
4. Upload receipt-2 (validated, +50 pts), then receipt-3 (odometer conflict -> needs review, 0 pts).
5. Upload receipt-1 again -> duplicate banner -> 0 points.
6. Ledger: measured / user entered / model estimated figures with factor source and data year.
7. Report -> Request share link -> Agent page -> Approve -> open link -> Revoke.

To reset: stop the app, delete data/ and uploads/, start again.

## Where things are
- src/lib/logic.ts   deterministic checks, emissions, points (no AI)
- src/lib/agents.ts  worker, coordinator, specialist agents, approvals
- src/lib/ai.ts      Ollama hook (TODO phase 2), cached samples, health check
- src/lib/db.ts      schema and seed
- config/emission-factors.json and src/lib/config.ts (rules, points, rewards)
- docs-requirements.md  original requirements

## Phase 2 (AI)
Implement the TODO in `extractFromReceipt` in src/lib/ai.ts (Ollama vision call, zod validation, one retry), then set USE_CACHED_EXTRACTION=false.
