import { describe, expect, it } from "vitest";
import { getSignalLevers, simulate } from "../src/domain/simulation";
import { getHeroScenarios } from "../src/domain/scenarios";

function heatWaveStoreIds(productId: string): string[] {
  const scenario = getHeroScenarios().find((s) => s.id === "scenario-heat-wave")!;
  return scenario.groups.filter((g) => g.productId === productId).map((g) => g.storeId);
}

describe("simulation", () => {
  it("fully adjusted (all levers at 100%) tracks true demand better than doing nothing", () => {
    const productId = "hero-bottled-water-500";
    const storeIds = heatWaveStoreIds(productId);
    const levers = getSignalLevers(productId, storeIds);
    const settings = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: true, intensityPct: 100 }]));

    const result = simulate(productId, storeIds, settings);
    expect(result.adjusted.stockoutRiskPct).toBeLessThan(result.doNothing.stockoutRiskPct);
    expect(result.adjusted.mape).toBeLessThan(result.doNothing.mape);
  });

  it("turning every lever off reproduces the do-nothing plan", () => {
    const productId = "hero-bottled-water-500";
    const storeIds = heatWaveStoreIds(productId);
    const levers = getSignalLevers(productId, storeIds);
    const allOff = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: false, intensityPct: 100 }]));

    const result = simulate(productId, storeIds, allOff);
    expect(result.adjustedPlanUnits).toBe(result.doNothingPlanUnits);
    expect(result.adjusted).toEqual(result.doNothing);
  });

  it("is deterministic for the same settings", () => {
    const productId = "hero-cottage-cheese";
    const scenario = getHeroScenarios().find((s) => s.id === "scenario-viral-trend")!;
    const storeIds = scenario.groups.filter((g) => g.productId === productId).map((g) => g.storeId);
    const settings = Object.fromEntries(
      getSignalLevers(productId, storeIds).map((l) => [l.signalId, { enabled: true, intensityPct: 60 }])
    );
    expect(simulate(productId, storeIds, settings)).toEqual(simulate(productId, storeIds, settings));
  });
});
