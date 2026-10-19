import { describe, expect, it } from "vitest";
import { answerQuestion } from "../src/domain/joule";
import { getHeroScenarios } from "../src/domain/scenarios";

describe("joule", () => {
  it("asks for a scenario when none is selected (except the overview question)", () => {
    expect(answerQuestion("why")).toMatch(/select a hero scenario/i);
    expect(answerQuestion("overview")).not.toMatch(/select a hero scenario/i);
  });

  it("grounds its 'why' answer in a real contributing signal for the heat wave scenario", () => {
    const heatWave = getHeroScenarios().find((s) => s.id === "scenario-heat-wave")!;
    const answer = answerQuestion("why", heatWave);
    expect(answer).toMatch(/Environment Canada|CityNews Vancouver|Internal Promotions Calendar/);
  });

  it("includes a numeric confidence and dollar figure in the recommendation answer", () => {
    const heatWave = getHeroScenarios().find((s) => s.id === "scenario-heat-wave")!;
    const answer = answerQuestion("recommendation", heatWave);
    expect(answer).toMatch(/confidence[\s\S]*?\d+%/i);
    expect(answer).toMatch(/\$[\d,]+/);
  });
});
