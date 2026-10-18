import { describe, expect, it } from "vitest";
import { CURRENT_WEEK_INDEX, generateHistory } from "../src/data/history";

describe("history generator", () => {
  it("is deterministic for a given product x store pair", () => {
    const a = generateHistory("hero-bottled-water-500", "ST-001");
    const b = generateHistory("hero-bottled-water-500", "ST-001");
    expect(a).toEqual(b);
  });

  it("differs across store/product pairs (not a shared static series)", () => {
    const a = generateHistory("hero-bottled-water-500", "ST-001");
    const c = generateHistory("hero-bottled-water-500", "ST-002");
    expect(a).not.toEqual(c);
  });

  it("has 104 weeks, with actuals only in the past and none in the forecast horizon", () => {
    const weeks = generateHistory("hero-cottage-cheese", "ST-010");
    expect(weeks).toHaveLength(104);
    weeks.forEach((week, index) => {
      if (index < CURRENT_WEEK_INDEX) {
        expect(week.actual).toBeTypeOf("number");
      } else {
        expect(week.actual).toBeUndefined();
      }
      expect(week.signalAdjustment).toBe(0);
      expect(week.finalDemand).toBe(week.demandSensingForecast);
    });
  });
});
