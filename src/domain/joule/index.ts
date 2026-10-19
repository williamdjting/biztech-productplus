// Joule panel: scripted, data-grounded answers over the mock data — no LLM involved.
// Production note: a real deployment would route these through Joule's actual NL interface,
// backed by the same IBP planning-area data; the "model" here is a template over domain
// functions so every answer is traceable to a number already shown elsewhere in the UI.
import { getClassifiedSignals } from "../classifier";
import { getAdjustedSeries, peakWeek } from "../forecast";
import { simulate, getSignalLevers } from "../simulation";
import { RISKS } from "../risks";
import type { Scenario } from "../types";

export interface SuggestedQuestion {
  id: string;
  prompt: string;
}

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { id: "why", prompt: "Why is demand shifting for this scenario?" },
  { id: "recommendation", prompt: "What's the recommended adjustment, and how confident are we?" },
  { id: "risks", prompt: "What should I watch out for before approving?" },
  { id: "overview", prompt: "How many signals are active right now?" },
];

function primaryProductAndStores(scenario: Scenario): { productId: string; storeIds: string[] } {
  const productId = scenario.groups[0].productId;
  const storeIds = scenario.groups.filter((g) => g.productId === productId).map((g) => g.storeId);
  return { productId, storeIds };
}

function answerWhy(scenario: Scenario): string {
  const { productId, storeIds } = primaryProductAndStores(scenario);
  const series = getAdjustedSeries(productId, storeIds);
  const peak = peakWeek(series);
  const contributions = series.contributionsByWeek[peak.weekStart] ?? [];
  if (contributions.length === 0) {
    return `No signal is currently moving the forecast for ${scenario.name}. Final Demand matches the baseline Demand Sensing Forecast.`;
  }
  const signals = getClassifiedSignals();
  const lines = contributions.map((c) => {
    const signal = signals.find((s) => s.id === c.signalId);
    return `• ${c.source} (${Math.round((signal?.confidence ?? 0) * 100)}% confidence): ${signal?.why ?? ""}`;
  });
  return `In the week of ${peak.weekStart}, ${contributions.length} signal(s) move the forecast by a net ${
    peak.signalAdjustment > 0 ? "+" : ""
  }${peak.signalAdjustment.toLocaleString()} units:\n${lines.join("\n")}`;
}

function answerRecommendation(scenario: Scenario): string {
  const { productId, storeIds } = primaryProductAndStores(scenario);
  const levers = getSignalLevers(productId, storeIds);
  const settings = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: true, intensityPct: 100 }]));
  const result = simulate(productId, storeIds, settings);
  const avgConfidence =
    levers.length === 0
      ? 0
      : Math.round(
          (levers
            .map((l) => getClassifiedSignals().find((s) => s.id === l.signalId)?.confidence ?? 0)
            .reduce((a, b) => a + b, 0) /
            levers.length) *
            100
        );
  return (
    `Adjusting the forecast for ${scenario.name} is projected to cut stockout risk from ` +
    `${result.doNothing.stockoutRiskPct}% to ${result.adjusted.stockoutRiskPct}%, avoiding roughly ` +
    `$${(result.doNothing.projectedLostSalesUsd - result.adjusted.projectedLostSalesUsd).toLocaleString()} in lost sales ` +
    `over the next 6 weeks. Average confidence across the ${levers.length} contributing signal(s): ${avgConfidence}%.`
  );
}

function answerRisks(): string {
  return `Top things to watch before approving:\n${RISKS.slice(0, 3)
    .map((r) => `• ${r.risk} — mitigated by: ${r.mitigation}`)
    .join("\n")}\nFull list is in the Risks & guardrails card on this page.`;
}

function answerOverview(): string {
  const signals = getClassifiedSignals();
  const active = signals.filter((s) => s.status === "active");
  const lowConfidence = signals.filter((s) => s.status === "low_confidence");
  return `${active.length} signals are active right now (plus ${lowConfidence.length} flagged low-confidence and excluded from auto-suggestions), across ${
    new Set(signals.map((s) => s.category)).size
  } categories.`;
}

export function answerQuestion(questionId: string, scenario?: Scenario): string {
  if (questionId === "overview") return answerOverview();
  if (!scenario) return "Select a hero scenario from Overview first so Joule has a planning view to ground its answer in.";
  switch (questionId) {
    case "why":
      return answerWhy(scenario);
    case "recommendation":
      return answerRecommendation(scenario);
    case "risks":
      return answerRisks();
    default:
      return "I don't have a scripted answer for that yet in this prototype.";
  }
}
