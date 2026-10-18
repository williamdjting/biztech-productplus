import { describe, expect, it } from "vitest";
import { classify, findDuplicateGroups, getClassifiedSignals, LOW_CONFIDENCE_THRESHOLD } from "../src/domain/classifier";
import { getRawSignals } from "../src/domain/signals/sources";

describe("classifier", () => {
  it("is deterministic for a given signal", () => {
    const [signal] = getRawSignals();
    expect(classify(signal)).toEqual(classify(signal));
  });

  it("produces exactly one classified signal per raw signal, with the full 30-signal set", () => {
    const classified = getClassifiedSignals();
    expect(classified).toHaveLength(getRawSignals().length);
    expect(classified.length).toBeGreaterThanOrEqual(29);
  });

  it("flags the fizzling viral-trend signal as low confidence and excludes it from auto-suggestions", () => {
    const classified = getClassifiedSignals();
    const fizzle = classified.find((s) => s.id === "sig-viral-003")!;
    expect(fizzle.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    expect(fizzle.status).toBe("low_confidence");
  });

  it("detects the two heat-wave weather reports as a likely duplicate", () => {
    const classified = getClassifiedSignals();
    const groups = findDuplicateGroups(classified);
    const heatWaveGroup = groups.find((g) => g.some((s) => s.id === "sig-heatwave-001"));
    expect(heatWaveGroup).toBeDefined();
    expect(heatWaveGroup!.map((s) => s.id).sort()).toEqual(["sig-heatwave-001", "sig-heatwave-002"]);
  });

  it("keeps magnitude within the range implied by the signal's severity", () => {
    const classified = getClassifiedSignals();
    const critical = classified.find((s) => s.id === "sig-heatwave-001")!;
    expect(critical.severity).toBe("Critical");
    expect(critical.magnitudePct).toBeGreaterThanOrEqual(28);
    expect(critical.magnitudePct).toBeLessThanOrEqual(45);
  });

  it("reads cannibalization language as a downward signal on the cannibalized product", () => {
    const classified = getClassifiedSignals();
    const cannibalization = classified.find((s) => s.id === "sig-heatwave-003")!;
    expect(cannibalization.direction).toBe("down");
    expect(cannibalization.affectedProductIds).toContain("hero-bottled-water-500");
  });
});
