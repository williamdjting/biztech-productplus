// What-if simulation: lets a planner dial each contributing signal's strength up/down (or
// off) and see stockout risk, lost sales, overstock cost, service level and forecast error
// recalculated live, compared side by side against doing nothing.
// Production note: "true" future demand is unknowable ahead of time in a real deployment —
// here, since this is a closed mock dataset, Signal Adjustment at 100% intensity stands in
// for what actually happens, so Do-nothing-vs-Adjust has a concrete, explainable answer.
import { getAdjustedSeries } from "../forecast";
import { CURRENT_WEEK_INDEX } from "../../data/history";
import type { ScenarioKpis } from "../types";

const FUTURE_WEEKS = 6;
const MARKDOWN_FACTOR = 0.35; // overstock cost is a fraction of unit price, not full price
const DEFAULT_UNIT_PRICE = 5;

const UNIT_PRICE_USD: Record<string, number> = {
  "hero-bottled-water-500": 6.49,
  "hero-bottled-water-alt": 6.29,
  "hero-portable-fan": 24.99,
  "hero-sunscreen-spf50": 12.49,
  "hero-bbq-charcoal": 14.99,
  "hero-cottage-cheese": 4.99,
  "hero-canned-beans": 8.49,
  "hero-bread-loaf": 3.49,
  "hero-snow-shovel": 19.99,
};

export interface SignalLever {
  signalId: string;
  source: string;
  category: string;
  direction: "up" | "down";
}

export interface SignalSetting {
  enabled: boolean;
  intensityPct: number; // 0-150, 100 = as classified
}

export interface SimulationResult {
  doNothing: ScenarioKpis;
  adjusted: ScenarioKpis;
  trueDemandUnits: number;
  doNothingPlanUnits: number;
  adjustedPlanUnits: number;
  unitPrice: number;
}

function futureWeeksOf(productId: string, storeIds: string[]) {
  return getAdjustedSeries(productId, storeIds).weeks.slice(CURRENT_WEEK_INDEX, CURRENT_WEEK_INDEX + FUTURE_WEEKS);
}

/** The distinct signals touching this product's future horizon — one lever per signal. */
export function getSignalLevers(productId: string, storeIds: string[]): SignalLever[] {
  const series = getAdjustedSeries(productId, storeIds);
  const weeks = futureWeeksOf(productId, storeIds);
  const levers = new Map<string, SignalLever>();
  weeks.forEach((week) => {
    (series.contributionsByWeek[week.weekStart] ?? []).forEach((c) => {
      if (!levers.has(c.signalId)) {
        levers.set(c.signalId, {
          signalId: c.signalId,
          source: c.source,
          category: c.category,
          direction: c.deltaUnits >= 0 ? "up" : "down",
        });
      }
    });
  });
  return [...levers.values()];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeKpis(trueDemand: number, plan: number, unitPrice: number): ScenarioKpis {
  if (trueDemand <= 0) {
    return { stockoutRiskPct: 0, projectedLostSalesUsd: 0, overstockCostUsd: 0, serviceLevelPct: 100, mape: 0, bias: 0 };
  }
  const shortfall = Math.max(0, trueDemand - plan);
  const excess = Math.max(0, plan - trueDemand);
  const stockoutRiskPct = Math.min(100, (shortfall / trueDemand) * 100);
  return {
    stockoutRiskPct: round1(stockoutRiskPct),
    projectedLostSalesUsd: Math.round(shortfall * unitPrice),
    overstockCostUsd: Math.round(excess * unitPrice * MARKDOWN_FACTOR),
    serviceLevelPct: round1(100 - stockoutRiskPct),
    mape: round1((Math.abs(plan - trueDemand) / trueDemand) * 100),
    bias: round1(((plan - trueDemand) / trueDemand) * 100),
  };
}

export function simulate(
  productId: string,
  storeIds: string[],
  settings: Record<string, SignalSetting>
): SimulationResult {
  const series = getAdjustedSeries(productId, storeIds);
  const weeks = futureWeeksOf(productId, storeIds);

  let trueDemand = 0;
  let doNothingPlan = 0;
  let adjustedPlan = 0;

  weeks.forEach((week) => {
    trueDemand += week.finalDemand;
    doNothingPlan += week.demandSensingForecast;
    const contributions = series.contributionsByWeek[week.weekStart] ?? [];
    const simulatedAdjustment = contributions.reduce((sum, c) => {
      const setting = settings[c.signalId] ?? { enabled: true, intensityPct: 100 };
      return sum + (setting.enabled ? c.deltaUnits * (setting.intensityPct / 100) : 0);
    }, 0);
    adjustedPlan += Math.max(0, week.demandSensingForecast + simulatedAdjustment);
  });

  const unitPrice = UNIT_PRICE_USD[productId] ?? DEFAULT_UNIT_PRICE;
  return {
    doNothing: computeKpis(trueDemand, doNothingPlan, unitPrice),
    adjusted: computeKpis(trueDemand, adjustedPlan, unitPrice),
    trueDemandUnits: Math.round(trueDemand),
    doNothingPlanUnits: Math.round(doNothingPlan),
    adjustedPlanUnits: Math.round(adjustedPlan),
    unitPrice,
  };
}
