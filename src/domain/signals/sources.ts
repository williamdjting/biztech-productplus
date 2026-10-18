// Raw signal generator: the "sense" layer before classification.
// Production note: this module stands in for ingestion connectors SAP IBP would plug in —
// POS/weather/social feeds, a municipal events calendar, a news wire — normalized to one
// shape. Capture only reads these fields; Classify is what turns them into a decision input.
import { hashSeed, mulberry32 } from "../../data/rng";
import { getCatalog, storesInCities, storesInRegion } from "../../data/catalog";
import { isoDaysFromAnchor } from "../../data/calendar";
import type { Region, Severity, Signal, SignalCategory } from "../types";

function pickStoreIds(pool: { id: string }[], count: number, seed: string): string[] {
  const rng = mulberry32(hashSeed(seed));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((s) => s.id);
}

function productIdsInCategory(category: string, count: number): string[] {
  return getCatalog()
    .products.filter((p) => p.category === category && !p.isHero)
    .slice(0, count)
    .map((p) => p.id);
}

interface SignalDef {
  id: string;
  source: string;
  daysAgo: number; // capture date, relative to the shared "now" anchor
  regions: Region[];
  storeIds: string[];
  categoryHint: SignalCategory;
  productCategories: string[];
  rawSnippet: string;
  severity: Severity;
}

function toSignal(def: SignalDef): Signal {
  return {
    id: def.id,
    source: def.source,
    timestamp: isoDaysFromAnchor(-def.daysAgo),
    regions: def.regions,
    storeIds: def.storeIds,
    categoryHint: def.categoryHint,
    productCategories: def.productCategories,
    rawSnippet: def.rawSnippet,
    severity: def.severity,
  };
}

// --- Background signals: ~20 across all 9 categories, so the Capture feed looks alive. ---
const BACKGROUND_DEFS: Omit<SignalDef, "storeIds">[] = [
  {
    id: "sig-bg-001", source: "Internal Promotions Calendar", daysAgo: 2, regions: ["SK"],
    categoryHint: "promo_cannibalization", productCategories: ["Pantry Staples"], severity: "Medium",
    rawSnippet: "A 20%-off promotion on store-brand pasta sauce launches in Saskatoon next week, expected to pull demand away from name-brand pasta sauce.",
  },
  {
    id: "sig-bg-002", source: "Internal Promotions Calendar", daysAgo: 1, regions: ["MB"],
    categoryHint: "promo_cannibalization", productCategories: ["Frozen Foods"], severity: "Low",
    rawSnippet: "A buy-one-get-one promotion on frozen pizza in Winnipeg stores is expected to divert demand away from private-label frozen entrees.",
  },
  {
    id: "sig-bg-003", source: "Environment Canada", daysAgo: 3, regions: ["AB"],
    categoryHint: "weather", productCategories: ["Beverages"], severity: "Medium",
    rawSnippet: "Environment Canada forecasts an early-season Chinook warm spell across central Alberta, with temperatures expected to spike demand for cold beverages.",
  },
  {
    id: "sig-bg-004", source: "Environment Canada", daysAgo: 4, regions: ["SK"],
    categoryHint: "weather", productCategories: ["Outdoor & Seasonal"], severity: "Low",
    rawSnippet: "Environment Canada issues a frost advisory for southern Saskatchewan; an early cold snap is likely to curb patio and outdoor product sales.",
  },
  {
    id: "sig-bg-005", source: "Social Trend Monitor", daysAgo: 5, regions: ["BC"],
    categoryHint: "viral_trend", productCategories: ["Frozen Foods"], severity: "Medium",
    rawSnippet: "A recipe video using air-fryer frozen appetizers has crossed 2M views this week, with early mentions from Vancouver shoppers.",
  },
  {
    id: "sig-bg-006", source: "Social Trend Monitor", daysAgo: 2, regions: ["MB"],
    categoryHint: "viral_trend", productCategories: ["Beverages"], severity: "Low",
    rawSnippet: "Social listening shows rising mentions of a protein-coffee recipe trend among Winnipeg-area accounts.",
  },
  {
    id: "sig-bg-007", source: "Internal POS Analytics", daysAgo: 6, regions: ["BC"],
    categoryHint: "seasonality", productCategories: ["Bakery"], severity: "Low",
    rawSnippet: "October sales of pumpkin-spice bakery items in Victoria are running 15% ahead of the same week last year.",
  },
  {
    id: "sig-bg-008", source: "Internal POS Analytics", daysAgo: 7, regions: ["AB"],
    categoryHint: "seasonality", productCategories: ["Personal Care"], severity: "Low",
    rawSnippet: "Back-to-school backpack and lunch-kit sales in Edmonton are trailing the prior three-year average for this week.",
  },
  {
    id: "sig-bg-009", source: "News Wire", daysAgo: 8, regions: ["BC", "AB", "SK", "MB"],
    categoryHint: "geopolitics", productCategories: ["Pantry Staples"], severity: "High",
    rawSnippet: "A new round of tariffs on imported canned goods takes effect next month; distributors are warning of a potential shortage, and early signs point to shoppers stocking up.",
  },
  {
    id: "sig-bg-010", source: "News Wire", daysAgo: 9, regions: ["BC"],
    categoryHint: "geopolitics", productCategories: ["Electronics & Accessories"], severity: "Medium",
    rawSnippet: "A labour disruption at a major Pacific port is delaying inbound shipments of small kitchen electronics, with nearby stores already seeing stock-up buying ahead of anticipated shortages.",
  },
  {
    id: "sig-bg-011", source: "Municipal Events & Advisories — Calgary", daysAgo: 4, regions: ["AB"],
    categoryHint: "local_event", productCategories: ["Snacks"], severity: "Medium",
    rawSnippet: "An added October concert weekend at the Calgary Stampede grounds, expected to draw 40,000 visitors, is expected to spike downtown demand for snacks and beverages.",
  },
  {
    id: "sig-bg-012", source: "Municipal Events & Advisories — Winnipeg", daysAgo: 3, regions: ["MB"],
    categoryHint: "local_event", productCategories: ["Snacks"], severity: "Low",
    rawSnippet: "A Winnipeg Jets home playoff game is scheduled for next Friday, historically correlated with a spike in snack sales near the arena.",
  },
  {
    id: "sig-bg-013", source: "Competitor Flyer Watch", daysAgo: 5, regions: ["BC"],
    categoryHint: "competitor_action", productCategories: ["Household & Cleaning"], severity: "Medium",
    rawSnippet: "A major competitor announced a new store opening in Surrey next month, expected to divert foot traffic and category demand away from two nearby stores.",
  },
  {
    id: "sig-bg-014", source: "Competitor Flyer Watch", daysAgo: 6, regions: ["AB"],
    categoryHint: "competitor_action", productCategories: ["Dairy"], severity: "Low",
    rawSnippet: "A competing grocer has closed its Edmonton location, with early POS data showing a demand increase at our two nearest stores.",
  },
  {
    id: "sig-bg-015", source: "Competitor Flyer Watch", daysAgo: 1, regions: ["SK"],
    categoryHint: "competitor_action", productCategories: ["Household & Cleaning"], severity: "Low",
    rawSnippet: "A regional competitor has launched an aggressive price-match guarantee across Regina stores, expected to divert some category demand away.",
  },
  {
    id: "sig-bg-016", source: "Internal POS Analytics", daysAgo: 10, regions: ["BC"],
    categoryHint: "market_shift", productCategories: ["Dairy"], severity: "Medium",
    rawSnippet: "Category data shows a broader consumer shift toward plant-based dairy alternatives across Metro Vancouver.",
  },
  {
    id: "sig-bg-017", source: "Internal POS Analytics", daysAgo: 11, regions: ["SK"],
    categoryHint: "market_shift", productCategories: ["Pantry Staples"], severity: "Low",
    rawSnippet: "Private-label grocery penetration in Saskatoon is rising faster than the national average, per internal basket analysis.",
  },
  {
    id: "sig-bg-018", source: "News Wire", daysAgo: 2, regions: ["SK"],
    categoryHint: "panic_buying", productCategories: ["Pantry Staples"], severity: "Medium",
    rawSnippet: "Local news coverage of a potential rail strike is prompting early stock-up buying of shelf-stable goods in Saskatoon.",
  },
  {
    id: "sig-bg-019", source: "News Wire", daysAgo: 1, regions: ["MB"],
    categoryHint: "panic_buying", productCategories: ["Beverages"], severity: "High",
    rawSnippet: "A boil-water advisory in parts of Winnipeg has triggered a run on bottled water at nearby stores.",
  },
  {
    id: "sig-bg-020", source: "Environment Canada", daysAgo: 3, regions: ["BC"],
    categoryHint: "weather", productCategories: ["Health & Wellness"], severity: "Medium",
    rawSnippet: "Environment Canada has issued an air quality advisory for the Kamloops region due to nearby wildfire smoke, expected to spike demand for masks and air purifiers.",
  },
];

// --- Hero scenario (a): Okanagan / Metro Vancouver heat wave. sig-heatwave- prefix. ---
function heatWaveDefs(): SignalDef[] {
  const stores = storesInCities(["Kelowna", "Vancouver"]);
  const kelownaOnly = storesInCities(["Kelowna"]);
  return [
    {
      id: "sig-heatwave-001", source: "Environment Canada", daysAgo: 1,
      regions: ["BC"], storeIds: stores.map((s) => s.id),
      categoryHint: "weather", productCategories: ["Beverages", "Outdoor & Seasonal", "Personal Care", "BBQ & Grilling"],
      severity: "Critical",
      rawSnippet: "Environment Canada forecasts a 6-day heat wave across the Okanagan and Metro Vancouver, with daytime highs expected to spike 8-12°C above seasonal norms starting this weekend.",
    },
    {
      // Deliberate near-duplicate of 001 from a second source, to demonstrate dedupe/merge in Classify.
      id: "sig-heatwave-002", source: "CityNews Vancouver — Weather Desk", daysAgo: 0,
      regions: ["BC"], storeIds: stores.map((s) => s.id),
      categoryHint: "weather", productCategories: ["Beverages", "Outdoor & Seasonal", "Personal Care", "BBQ & Grilling"],
      severity: "High",
      rawSnippet: "CityNews Vancouver's weather desk confirms an extended heat wave is expected to spike temperatures across the Lower Mainland and Okanagan this weekend, well above seasonal norms.",
    },
    {
      id: "sig-heatwave-003", source: "Internal Promotions Calendar", daysAgo: 1,
      regions: ["BC"], storeIds: stores.map((s) => s.id),
      categoryHint: "promo_cannibalization", productCategories: ["Beverages"], severity: "Medium",
      rawSnippet: "A 15%-off promotion on Competing Spring Water Brand launches in BC stores this weekend, expected to divert demand away from Bottled Water 500mL.",
    },
    {
      id: "sig-heatwave-004", source: "Municipal Events & Advisories — Kelowna", daysAgo: 2,
      regions: ["BC"], storeIds: kelownaOnly.map((s) => s.id),
      categoryHint: "local_event", productCategories: ["BBQ & Grilling"], severity: "Low",
      rawSnippet: "A BC Summer Concert Series outdoor weekend show in Kelowna is expected to spike nearby BBQ and grilling demand.",
    },
  ];
}

// --- Hero scenario (b): cottage cheese viral trend, with a built-in confidence decay. sig-viral- prefix. ---
function viralTrendDefs(): SignalDef[] {
  const stores = storesInCities(["Vancouver", "Calgary", "Edmonton", "Winnipeg"]);
  const storeIds = stores.map((s) => s.id);
  return [
    {
      id: "sig-viral-001", source: "Social Trend Monitor", daysAgo: 6,
      regions: ["BC", "AB"], storeIds,
      categoryHint: "viral_trend", productCategories: ["Dairy"], severity: "Medium",
      rawSnippet: "Social Trend Monitor flags a recipe video featuring cottage-cheese \"ice cream\" crossing 500K views, with early mentions spiking in Vancouver and Calgary.",
    },
    {
      id: "sig-viral-002", source: "Social Trend Monitor", daysAgo: 3,
      regions: ["BC", "AB", "MB"], storeIds,
      categoryHint: "viral_trend", productCategories: ["Dairy"], severity: "Medium",
      rawSnippet: "Social Trend Monitor reports the cottage-cheese recipe trend has crossed 3M views nationally, with mention volume continuing to climb across Western Canada.",
    },
    {
      id: "sig-viral-003", source: "Social Trend Monitor", daysAgo: 1,
      regions: ["BC", "AB", "MB"], storeIds,
      categoryHint: "viral_trend", productCategories: ["Dairy"], severity: "Low",
      rawSnippet: "Social Trend Monitor notes mention growth for the cottage-cheese trend has slowed sharply over the past 48 hours, a pattern consistent with past trends that fizzled before retail impact materialized.",
    },
  ];
}

// --- Hero scenario (c): Calgary/Edmonton storm panic-buying. sig-panic- prefix. ---
function panicBuyingDefs(): SignalDef[] {
  const stores = storesInCities(["Calgary", "Edmonton"]);
  const storeIds = stores.map((s) => s.id);
  return [
    {
      id: "sig-panic-001", source: "Environment Canada", daysAgo: 1,
      regions: ["AB"], storeIds,
      categoryHint: "panic_buying", productCategories: ["Pantry Staples", "Beverages"], severity: "High",
      rawSnippet: "Environment Canada issues a winter storm watch for Calgary and Edmonton, forecasting 25-35cm of snow and highway closures beginning midweek; early signs point to shoppers stocking up.",
    },
    {
      id: "sig-panic-002", source: "Local News Wire", daysAgo: 1,
      regions: ["AB"], storeIds,
      categoryHint: "panic_buying", productCategories: ["Pantry Staples", "Bakery"], severity: "Medium",
      rawSnippet: "Local news coverage of the incoming storm is prompting early stock-up buying of shelf-stable staples at Calgary and Edmonton grocery stores.",
    },
    {
      id: "sig-panic-003", source: "Municipal Events & Advisories — Edmonton", daysAgo: 0,
      regions: ["AB"], storeIds,
      categoryHint: "local_event", productCategories: ["Outdoor & Seasonal"], severity: "Low",
      rawSnippet: "The City of Edmonton has issued a snow-route parking ban ahead of the storm, with residents advised to prepare for reduced mobility and stock up on winter gear.",
    },
  ];
}

let cachedSignals: Signal[] | null = null;

export function getRawSignals(): Signal[] {
  if (cachedSignals) return cachedSignals;

  const backgroundSignals = BACKGROUND_DEFS.map((def) =>
    toSignal({
      ...def,
      storeIds: pickStoreIds(
        def.regions.length === 1 ? storesInRegion(def.regions[0]) : storesInRegion(def.regions[0]),
        3 + (hashSeed(def.id) % 4),
        def.id
      ),
    })
  );

  const heroSignals = [...heatWaveDefs(), ...viralTrendDefs(), ...panicBuyingDefs()].map(toSignal);

  cachedSignals = [...backgroundSignals, ...heroSignals].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return cachedSignals;
}

/** Maps the product categories a signal names to concrete SKU ids, for background (non-hero) signals. */
export function sampleProductIdsForCategories(categories: string[], perCategory = 3): string[] {
  return categories.flatMap((c) => productIdsInCategory(c, perCategory));
}
