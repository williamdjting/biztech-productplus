// Shared domain types for IBP Signal Sense.
// Production note: Product/Store would be read from SAP IBP master data
// (planning object IDPRDID/LOCID) via the IBP OData/Planning Area API, not generated.

export type Region = "BC" | "AB" | "SK" | "MB";

export interface Store {
  id: string;
  name: string;
  city: string;
  region: Region;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  /** Marks the small set of named products used in hero scenarios/storytelling. */
  isHero?: boolean;
}

export type SignalCategory =
  | "promo_cannibalization"
  | "weather"
  | "viral_trend"
  | "seasonality"
  | "geopolitics"
  | "local_event"
  | "competitor_action"
  | "market_shift"
  | "panic_buying";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export interface Signal {
  id: string;
  source: string;
  timestamp: string; // ISO date
  regions: Region[];
  storeIds: string[];
  categoryHint?: SignalCategory;
  productCategories: string[];
  rawSnippet: string;
  severity: Severity;
}

export type SignalDirection = "up" | "down";
export type SignalStatus = "active" | "merged" | "dismissed" | "low_confidence";

export interface ClassifiedSignal extends Signal {
  category: SignalCategory;
  direction: SignalDirection;
  magnitudePct: number;
  /** 0-1 */
  confidence: number;
  timeWindow: { start: string; end: string };
  affectedProductIds: string[];
  affectedStoreIds: string[];
  why: string;
  status: SignalStatus;
}

export interface KeyFigureWeek {
  weekStart: string; // ISO date, Monday of the week
  actual?: number;
  statisticalForecast: number;
  demandSensingForecast: number;
  signalAdjustment: number;
  finalDemand: number;
}

export interface KeyFigureSeries {
  productId: string;
  storeId: string;
  weeks: KeyFigureWeek[];
}

export interface SignalContribution {
  signalId: string;
  weekStart: string;
  deltaUnits: number;
}

export interface ScenarioKpis {
  stockoutRiskPct: number;
  projectedLostSalesUsd: number;
  overstockCostUsd: number;
  serviceLevelPct: number;
  mape: number;
  bias: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  regions: Region[];
  signalIds: string[];
  /** Product x store pairs this scenario's adjustment applies to. */
  groups: { productId: string; storeId: string }[];
}

export type ApprovalDecision = "approved" | "modified" | "rejected";

export interface Approval {
  id: string;
  scenarioId: string;
  decision: ApprovalDecision;
  reason: string;
  timestamp: string;
  kpiSnapshot: ScenarioKpis;
}

export interface RiskFlag {
  risk: string;
  mitigation: string;
  severity: Severity;
}
