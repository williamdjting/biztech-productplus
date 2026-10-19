import { describe, expect, it } from "vitest";
import { getAdjustedSeries, peakWeek } from "../src/domain/forecast";
import { getHeroScenarios } from "../src/domain/scenarios";
import { getClassifiedSignals } from "../src/domain/classifier";
import { getCatalog } from "../src/data/catalog";

describe("forecast adjustment", () => {
  it("is deterministic for a given product x store group", () => {
    const a = getAdjustedSeries("hero-bottled-water-500", ["ST-001", "ST-002"]);
    const b = getAdjustedSeries("hero-bottled-water-500", ["ST-001", "ST-002"]);
    expect(a).toEqual(b);
  });

  it("applies the heat wave signals as a positive adjustment on bottled water in its scenario stores", () => {
    const heatWave = getHeroScenarios().find((s) => s.id === "scenario-heat-wave")!;
    const storeIds = heatWave.groups.filter((g) => g.productId === "hero-bottled-water-500").map((g) => g.storeId);
    const series = getAdjustedSeries("hero-bottled-water-500", storeIds);
    const peak = peakWeek(series);
    expect(peak.signalAdjustment).not.toBe(0);
    const contributions = series.contributionsByWeek[peak.weekStart];
    expect(contributions.length).toBeGreaterThan(0);
    // Demand Sensing Forecast + signal deltas should reconcile to Final Demand.
    const total = contributions.reduce((sum, c) => sum + c.deltaUnits, 0);
    expect(peak.finalDemand).toBe(Math.max(0, peak.demandSensingForecast + total));
  });

  it("leaves an unaffected product's forecast untouched (no matching signals)", () => {
    const namedByAnySignal = new Set(getClassifiedSignals().flatMap((s) => s.affectedProductIds));
    const unaffected = getCatalog().products.find((p) => !namedByAnySignal.has(p.id))!;
    const series = getAdjustedSeries(unaffected.id, ["ST-001"]);
    expect(series.weeks.every((w) => w.signalAdjustment === 0)).toBe(true);
    expect(series.weeks.every((w) => w.finalDemand === w.demandSensingForecast)).toBe(true);
  });
});
