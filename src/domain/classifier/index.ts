// Rule-based classifier: turns a raw Signal into a ClassifiedSignal with a category,
// direction, magnitude, confidence, impact window and a plain-language "why".
// Production note: this is where a real deployment would plug in SAP's signal-classification
// model (or a Joule-backed extraction skill); every rule here is intentionally simple and
// inspectable so a planner (and a judge) can see exactly why a number came out the way it did.
import { hashSeed, mulberry32 } from "../../data/rng";
import { addDays, isoDate } from "../../data/calendar";
import { getRawSignals, sampleProductIdsForCategories } from "../signals/sources";
import type { ClassifiedSignal, Severity, Signal, SignalCategory, SignalDirection } from "../types";

export const LOW_CONFIDENCE_THRESHOLD = 0.5;

const UP_KEYWORDS = [
  "spike", "surge", "increase", "shortage", "sold out", "panic", "rush", "demand for",
  "stocking up", "stock-up", "stock up", "booked out", "climb", "above seasonal norms", "ahead of",
];
const DOWN_KEYWORDS = [
  "decline", "drop", "curb", "pull demand away", "divert demand away", "divert", "pulling demand away",
  "trailing", "cooler", "closure", "clearance", "cancel", "recall",
];
const FIZZLE_KEYWORDS = ["slowed sharply", "fizzle", "fizzled", "losing steam", "cooling off", "leveling off"];

const CATEGORY_CONFIDENCE_RANGE: Record<SignalCategory, [number, number]> = {
  weather: [0.75, 0.92],
  geopolitics: [0.55, 0.75],
  local_event: [0.8, 0.95],
  competitor_action: [0.6, 0.8],
  promo_cannibalization: [0.65, 0.85],
  seasonality: [0.5, 0.7],
  market_shift: [0.45, 0.65],
  viral_trend: [0.35, 0.7],
  panic_buying: [0.55, 0.8],
};

const SEVERITY_MAGNITUDE_RANGE: Record<Severity, [number, number]> = {
  Low: [3, 8],
  Medium: [8, 18],
  High: [18, 30],
  Critical: [28, 45],
};

const SEVERITY_CONFIDENCE_BONUS: Record<Severity, number> = {
  Low: -0.05,
  Medium: 0,
  High: 0.04,
  Critical: 0.08,
};

const CATEGORY_WINDOW: Record<SignalCategory, { leadDays: number; durationDays: number }> = {
  weather: { leadDays: 2, durationDays: 6 },
  local_event: { leadDays: 2, durationDays: 3 },
  panic_buying: { leadDays: 1, durationDays: 6 },
  promo_cannibalization: { leadDays: 3, durationDays: 10 },
  viral_trend: { leadDays: 1, durationDays: 10 },
  competitor_action: { leadDays: 7, durationDays: 60 },
  geopolitics: { leadDays: 10, durationDays: 30 },
  seasonality: { leadDays: 7, durationDays: 45 },
  market_shift: { leadDays: 14, durationDays: 60 },
};

/**
 * For hero-scenario signals we know the exact SKUs a planner would care about; background
 * signals fall back to a representative sample from the named product categories.
 */
const HERO_SIGNAL_PRODUCT_IDS: Record<string, string[]> = {
  "sig-heatwave-001": ["hero-bottled-water-500", "hero-portable-fan", "hero-sunscreen-spf50", "hero-bbq-charcoal"],
  "sig-heatwave-002": ["hero-bottled-water-500", "hero-portable-fan", "hero-sunscreen-spf50", "hero-bbq-charcoal"],
  "sig-heatwave-003": ["hero-bottled-water-500"],
  "sig-heatwave-004": ["hero-bbq-charcoal"],
  "sig-viral-001": ["hero-cottage-cheese"],
  "sig-viral-002": ["hero-cottage-cheese"],
  "sig-viral-003": ["hero-cottage-cheese"],
  "sig-panic-001": ["hero-canned-beans", "hero-bread-loaf", "hero-bottled-water-500"],
  "sig-panic-002": ["hero-canned-beans", "hero-bread-loaf"],
  "sig-panic-003": ["hero-snow-shovel"],
};

function pickInRange(rng: () => number, [min, max]: [number, number]): number {
  return min + rng() * (max - min);
}

function detectDirection(text: string): SignalDirection {
  const upHits = UP_KEYWORDS.filter((k) => text.includes(k)).length;
  const downHits = DOWN_KEYWORDS.filter((k) => text.includes(k)).length;
  return downHits > upHits ? "down" : "up";
}

function buildWhy(
  signal: Signal,
  direction: SignalDirection,
  magnitudePct: number,
  confidence: number,
  timeWindow: { start: string; end: string }
): string {
  const verb = direction === "up" ? "increase" : "decrease";
  const regionsText = signal.regions.join("/");
  const categoriesText = signal.productCategories.join(", ");
  return `${signal.rawSnippet} Modeled to ${verb} demand for ${categoriesText} in ${regionsText} by ~${magnitudePct.toFixed(
    1
  )}% from ${timeWindow.start} to ${timeWindow.end} (confidence ${Math.round(confidence * 100)}%).`;
}

export function classify(signal: Signal): ClassifiedSignal {
  const category = signal.categoryHint ?? "market_shift";
  const rng = mulberry32(hashSeed(signal.id));
  const text = signal.rawSnippet.toLowerCase();

  const direction = detectDirection(text);
  const magnitudePct = Math.round(pickInRange(rng, SEVERITY_MAGNITUDE_RANGE[signal.severity]) * 10) / 10;

  let confidence = pickInRange(rng, CATEGORY_CONFIDENCE_RANGE[category]) + SEVERITY_CONFIDENCE_BONUS[signal.severity];
  if (FIZZLE_KEYWORDS.some((k) => text.includes(k))) confidence *= 0.55;
  confidence = Math.round(Math.min(0.97, Math.max(0.05, confidence)) * 100) / 100;

  const { leadDays, durationDays } = CATEGORY_WINDOW[category];
  const captureDate = new Date(`${signal.timestamp}T00:00:00Z`);
  const start = isoDate(addDays(captureDate, leadDays));
  const end = isoDate(addDays(captureDate, leadDays + durationDays));

  const affectedProductIds = HERO_SIGNAL_PRODUCT_IDS[signal.id] ?? sampleProductIdsForCategories(signal.productCategories);

  return {
    ...signal,
    category,
    direction,
    magnitudePct,
    confidence,
    timeWindow: { start, end },
    affectedProductIds,
    affectedStoreIds: signal.storeIds,
    why: buildWhy(signal, direction, magnitudePct, confidence, { start, end }),
    status: confidence < LOW_CONFIDENCE_THRESHOLD ? "low_confidence" : "active",
  };
}

let cachedClassified: ClassifiedSignal[] | null = null;

export function getClassifiedSignals(): ClassifiedSignal[] {
  if (!cachedClassified) {
    cachedClassified = getRawSignals().map(classify);
  }
  return cachedClassified;
}

// Require a materially similar store footprint (not just one incidental shared store) so
// two region-wide background signals don't get flagged as duplicates by chance.
function storesOverlap(a: ClassifiedSignal, b: ClassifiedSignal): boolean {
  const setB = new Set(b.affectedStoreIds);
  const sharedCount = a.affectedStoreIds.filter((id) => setB.has(id)).length;
  const smaller = Math.min(a.affectedStoreIds.length, b.affectedStoreIds.length);
  return smaller > 0 && sharedCount / smaller >= 0.5;
}

function daysBetween(isoA: string, isoB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(new Date(`${isoA}T00:00:00Z`).getTime() - new Date(`${isoB}T00:00:00Z`).getTime()) / msPerDay;
}

function productCategoriesOverlap(a: ClassifiedSignal, b: ClassifiedSignal): boolean {
  return a.productCategories.some((c) => b.productCategories.includes(c));
}

function isLikelyDuplicate(a: ClassifiedSignal, b: ClassifiedSignal): boolean {
  return (
    a.category === b.category &&
    a.direction === b.direction &&
    storesOverlap(a, b) &&
    productCategoriesOverlap(a, b) &&
    daysBetween(a.timeWindow.start, b.timeWindow.start) <= 4
  );
}

/** Connected components of likely-duplicate active signals, for the Classify screen's merge prompt. */
export function findDuplicateGroups(signals: ClassifiedSignal[]): ClassifiedSignal[][] {
  const active = signals.filter((s) => s.status === "active" || s.status === "low_confidence");
  const visited = new Set<string>();
  const groups: ClassifiedSignal[][] = [];

  for (const signal of active) {
    if (visited.has(signal.id)) continue;
    const group = [signal];
    visited.add(signal.id);
    for (const other of active) {
      if (visited.has(other.id)) continue;
      if (isLikelyDuplicate(signal, other)) {
        group.push(other);
        visited.add(other.id);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}
