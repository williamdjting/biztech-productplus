// Deterministic synthetic sales history + baseline forecast key figures.
// Production note: Statistical Forecast and Demand Sensing Forecast would come from
// SAP IBP's forecasting engines (statistical forecast model + ML-based demand sensing);
// here they're approximated from the same synthetic series so the UI has something
// realistic to layer Signal Adjustment on top of in later stages.
import { gaussian, hashSeed, mulberry32 } from "./rng";
import { ANCHOR_DATE, isoDate } from "./calendar";
import type { KeyFigureWeek } from "../domain/types";

const WEEKS_TOTAL = 104;
const FUTURE_WEEKS = 14; // forecast horizon with no actuals yet
export const CURRENT_WEEK_INDEX = WEEKS_TOTAL - FUTURE_WEEKS;

export interface HistoryParams {
  baseLevel: number;
  trendPerWeek: number;
  seasonalAmplitude: number;
  noiseStd: number;
}

const DEFAULT_PARAMS: HistoryParams = {
  baseLevel: 120,
  trendPerWeek: 0.15,
  seasonalAmplitude: 15,
  noiseStd: 8,
};

function mondayWeeksAgo(weeksFromStart: number): string {
  // Anchor so week CURRENT_WEEK_INDEX lands on ANCHOR_DATE, keeping output fully
  // deterministic regardless of the real current date.
  const offsetWeeks = weeksFromStart - CURRENT_WEEK_INDEX;
  const date = new Date(ANCHOR_DATE);
  date.setUTCDate(ANCHOR_DATE.getUTCDate() + offsetWeeks * 7);
  return isoDate(date);
}

/**
 * Generates a deterministic 104-week baseline series for one product x store pair.
 * signalAdjustment is 0 and finalDemand === demandSensingForecast here; the classifier/
 * forecast-adjustment modules (Stage 3) populate real adjustments on top of this baseline.
 */
export function generateHistory(
  productId: string,
  storeId: string,
  params: Partial<HistoryParams> = {}
): KeyFigureWeek[] {
  const p = { ...DEFAULT_PARAMS, ...params };
  const rng = mulberry32(hashSeed(`${productId}::${storeId}`));
  const phase = rng() * Math.PI * 2;

  const weeks: KeyFigureWeek[] = [];
  let recentActualAvg = p.baseLevel;

  for (let t = 0; t < WEEKS_TOTAL; t++) {
    const level = p.baseLevel + p.trendPerWeek * t;
    const seasonal = p.seasonalAmplitude * Math.sin((2 * Math.PI * (t % 52)) / 52 + phase);
    const statisticalForecast = Math.max(0, Math.round(level + seasonal));

    const isPast = t < CURRENT_WEEK_INDEX;
    const actual = isPast
      ? Math.max(0, Math.round(level + seasonal + gaussian(rng, 0, p.noiseStd)))
      : undefined;

    if (actual !== undefined) {
      recentActualAvg = recentActualAvg * 0.7 + actual * 0.3;
    }

    const demandSensingForecast = isPast
      ? Math.max(0, Math.round(statisticalForecast * 0.6 + recentActualAvg * 0.4))
      : Math.max(0, Math.round(statisticalForecast * 0.7 + recentActualAvg * 0.3));

    weeks.push({
      weekStart: mondayWeeksAgo(t),
      actual,
      statisticalForecast,
      demandSensingForecast,
      signalAdjustment: 0,
      finalDemand: demandSensingForecast,
    });
  }

  return weeks;
}
