# IBP Signal Sense

**UBC BizTech Product+ 2026 — SAP case: "Sensing the Shift"**

An anomaly-aware add-on for SAP IBP for Demand. It doesn't replace IBP's statistical forecasting or ML-based demand sensing — it layers on top: detects and explains external signals (weather, viral trends, panic buying, promo cannibalization, competitor action, local events, geopolitics, market shifts, seasonality breaks), quantifies their impact per product × store, lets a planner simulate the outcome, and requires human approval before anything writes back to the plan.

Runs entirely locally against seeded, deterministic mock data — no backend, no API keys, no external calls.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # production build (tsc + vite build)
npm test             # vitest — 21 tests across the domain modules
```

Built with Vite + vanilla TypeScript and native [`@ui5/webcomponents`](https://sap.github.io/ui5-webcomponents/) (Fiori Horizon theme, light/dark toggle) — no React, no component framework. Domain logic (`src/domain/*`) is pure, typed, and unit-tested; UI code (`src/ui/*`) is thin rendering over it.

## The 5-stage flow

**Capture → Classify → Adjust forecast → Simulate → Approve**, built as a single `ui5-wizard` per scenario, reachable from the Overview page. Three hero scenarios are fully worked end to end:

- **Heat wave** (Okanagan / Metro Vancouver) — the primary demo scenario
- **Viral trend** (cottage cheese) — includes a deliberate confidence-decay/fizzle signal
- **Panic buying** (Calgary/Edmonton storm) — staples spike ahead of a forecast snowstorm

Every number on screen — magnitude, confidence, KPI deltas, waterfall contributions — comes from a domain function over the seeded mock data (`src/data/catalog.ts`, `src/data/history.ts`), not hardcoded text.

## Demo mode

Click **"Run demo (~45s)"** on the Overview page. It auto-selects the heat-wave scenario and walks all 5 stages, asks Joule one grounded question, and approves the adjustment — hands-off, for screen recording.

## 5-line demo script (manual walkthrough)

1. **Overview** — point at the KPI tiles (15,000 SKUs, 80 stores, 4 regions) and the three hero scenario cards; click "Open in Signal Sense" on the heat wave card.
2. **Capture → Classify** — show the live signal feed, then flip to Classify: point out the duplicate-signal merge banner and the low-confidence flag that excludes a signal from auto-adjustment.
3. **Adjust forecast** — show the key-figure table and the contribution waterfall: Demand Sensing baseline → each signal's +/- contribution → Final Demand.
4. **Simulate** — drag a signal's intensity slider and toggle one off; watch stockout risk, lost sales, and service level recalculate live, Do-nothing vs. Adjust.
5. **Approve** — show the Risks & Guardrails card, click Approve with a reason, and point at the Change History timeline entry (`written back to IBP Consensus Demand`) — then open Joule and ask "Why is demand shifting for this scenario?" for a grounded, data-backed answer.

## Known simplifications (by design, for a prototype)

- Classify-stage edits (dismiss/merge/reclassify) don't currently feed back into Adjust's forecast — Adjust/Simulate/Approve always use the original rule-based classification.
- Adjust/Simulate/Approve aggregate across *all* of a scenario's stores for the selected product — no per-store drill-down.
- Only approvals (and the audit trail) persist to `localStorage`; everything else resets to its deterministic baseline on reload.
- Joule answers 4 fixed, scripted questions via buttons (no free-text input) — grounded in real computed numbers, not an LLM.
