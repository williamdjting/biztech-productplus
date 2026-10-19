// Layers classified signals onto the baseline IBP-style forecast (Statistical Forecast /
// Demand Sensing Forecast) to produce Signal Adjustment and Final Demand per week.
// Production note: in SAP IBP this would write a Signal Adjustment key figure into the
// planning area; here it's a pure function over the same mock data so every number in the
// UI traces back to a specific signal.
import { generateHistory } from "../../data/history";
import { getClassifiedSignals } from "../classifier";
import type { ClassifiedSignal, KeyFigureWeek } from "../types";

export interface SignalContribution {
  signalId: string;
  source: string;
  category: ClassifiedSignal["category"];
  deltaUnits: number;
}

export interface AdjustedSeries {
  weeks: KeyFigureWeek[];
  contributionsByWeek: Record<string, SignalContribution[]>;
}

function sumAcrossStores(productId: string, storeIds: string[]): KeyFigureWeek[] {
  const perStore = storeIds.map((storeId) => generateHistory(productId, storeId));
  const weekCount = perStore[0]?.length ?? 0;
  return Array.from({ length: weekCount }, (_, i) => {
    const weekStart = perStore[0][i].weekStart;
    const hasActual = perStore[0][i].actual !== undefined;
    return {
      weekStart,
      actual: hasActual ? perStore.reduce((sum, s) => sum + (s[i].actual ?? 0), 0) : undefined,
      statisticalForecast: perStore.reduce((sum, s) => sum + s[i].statisticalForecast, 0),
      demandSensingForecast: perStore.reduce((sum, s) => sum + s[i].demandSensingForecast, 0),
      signalAdjustment: 0,
      finalDemand: perStore.reduce((sum, s) => sum + s[i].demandSensingForecast, 0),
    };
  });
}

function isWithinWindow(weekStart: string, window: { start: string; end: string }): boolean {
  return weekStart >= window.start && weekStart <= window.end;
}

const cache = new Map<string, AdjustedSeries>();

export function getAdjustedSeries(productId: string, storeIds: string[]): AdjustedSeries {
  const cacheKey = `${productId}::${[...storeIds].sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const baseline = sumAcrossStores(productId, storeIds);
  const storeIdSet = new Set(storeIds);
  const relevantSignals = getClassifiedSignals().filter(
    (s) =>
      s.status === "active" &&
      s.affectedProductIds.includes(productId) &&
      s.affectedStoreIds.some((id) => storeIdSet.has(id))
  );

  const contributionsByWeek: Record<string, SignalContribution[]> = {};
  const weeks = baseline.map((week) => {
    const contributions = relevantSignals
      .filter((s) => isWithinWindow(week.weekStart, s.timeWindow))
      .map((s) => ({
        signalId: s.id,
        source: s.source,
        category: s.category,
        deltaUnits: Math.round(week.demandSensingForecast * (s.direction === "up" ? 1 : -1) * (s.magnitudePct / 100)),
      }));
    contributionsByWeek[week.weekStart] = contributions;
    const signalAdjustment = contributions.reduce((sum, c) => sum + c.deltaUnits, 0);
    return { ...week, signalAdjustment, finalDemand: Math.max(0, week.demandSensingForecast + signalAdjustment) };
  });

  const result = { weeks, contributionsByWeek };
  cache.set(cacheKey, result);
  return result;
}

/** The week with the largest absolute signal adjustment — the one worth explaining in a waterfall. */
export function peakWeek(series: AdjustedSeries): KeyFigureWeek {
  return series.weeks.reduce((max, w) => (Math.abs(w.signalAdjustment) > Math.abs(max.signalAdjustment) ? w : max));
}
