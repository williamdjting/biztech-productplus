// Static risk/mitigation pairs for the Approve stage's "Risks & guardrails" card and for
// Joule's scripted answer about risk. Content, not computed data — shared so both read one copy.
import type { RiskFlag } from "./types";

export const RISKS: RiskFlag[] = [
  {
    risk: "False-positive or noisy signals (e.g. a viral trend that fizzles before it reaches the shelf)",
    mitigation: "Confidence thresholds: signals below 50% confidence are flagged and excluded from auto-suggested adjustments by default.",
    severity: "Medium",
  },
  {
    risk: "Double-counting overlapping signals reporting the same underlying event",
    mitigation: "Signal de-duplication in Classify detects likely duplicates by category, timing and store overlap and lets the planner merge them before they reach the forecast.",
    severity: "Medium",
  },
  {
    risk: "Over-reaction to a signal, causing overstock and markdown cost",
    mitigation: "Per-signal intensity sliders and on/off switches in Simulate let the planner dial down or disable any signal's influence before committing.",
    severity: "High",
  },
  {
    risk: "Data or source bias skewing coverage toward some regions or categories over others",
    mitigation: "Source attribution is shown on every signal, and manual reclassification in Classify keeps a human in the loop on coverage gaps.",
    severity: "Low",
  },
  {
    risk: "Model / signal-accuracy drift over time",
    mitigation: "A post-event accuracy review compares Final Demand to Actuals once each event window closes, tracked as a signal-accuracy score per category.",
    severity: "Medium",
  },
];
