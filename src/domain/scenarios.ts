// Hero scenario skeletons: which products x stores each scenario touches.
// Stage 2 attaches the actual Signal/ClassifiedSignal objects via signalIds.
import { storesInCities } from "../data/catalog";
import { getClassifiedSignals } from "./classifier";
import type { Scenario, Store } from "./types";

function crossGroups(productIds: string[], stores: Store[]) {
  return productIds.flatMap((productId) => stores.map((store) => ({ productId, storeId: store.id })));
}

/** Signals generated for a scenario use this id prefix, so the join stays a plain convention. */
function signalIdsFor(prefix: string): string[] {
  return getClassifiedSignals()
    .filter((s) => s.id.startsWith(prefix))
    .map((s) => s.id);
}

let cached: Scenario[] | null = null;

export function getHeroScenarios(): Scenario[] {
  if (cached) return cached;

  const heatWaveStores = storesInCities(["Kelowna", "Vancouver"]);
  const heatWave: Scenario = {
    id: "scenario-heat-wave",
    name: "Okanagan / Metro Vancouver heat wave",
    description:
      "A forecast heat wave across the Okanagan and Metro Vancouver is expected to spike demand for bottled water, fans, sunscreen and BBQ supplies, partly offset by cannibalization of a competing water brand.",
    regions: ["BC"],
    signalIds: signalIdsFor("sig-heatwave-"),
    groups: crossGroups(
      [
        "hero-bottled-water-500",
        "hero-bottled-water-alt",
        "hero-portable-fan",
        "hero-sunscreen-spf50",
        "hero-bbq-charcoal",
      ],
      heatWaveStores
    ),
  };

  const viralTrendStores = storesInCities(["Vancouver", "Calgary", "Edmonton", "Winnipeg"]);
  const viralTrend: Scenario = {
    id: "scenario-viral-trend",
    name: "Cottage cheese social trend",
    description:
      "A viral social-media trend is driving a sudden spike in cottage cheese demand in urban stores, with meaningful risk that interest fizzles before supply catches up.",
    regions: ["BC", "AB", "MB"],
    signalIds: signalIdsFor("sig-viral-"),
    groups: crossGroups(["hero-cottage-cheese"], viralTrendStores),
  };

  const panicBuyingStores = storesInCities(["Calgary", "Edmonton"]);
  const panicBuying: Scenario = {
    id: "scenario-panic-buying",
    name: "Calgary / Edmonton storm panic-buying",
    description:
      "A forecast snowstorm and supply-disruption headline are expected to trigger a short, sharp spike in staples in Calgary and Edmonton, followed by a post-event dip.",
    regions: ["AB"],
    signalIds: signalIdsFor("sig-panic-"),
    groups: crossGroups(
      ["hero-canned-beans", "hero-bread-loaf", "hero-snow-shovel", "hero-bottled-water-500"],
      panicBuyingStores
    ),
  };

  cached = [heatWave, viralTrend, panicBuying];
  return cached;
}
