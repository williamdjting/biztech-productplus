// The one piece of state that's actually durable: approval decisions + audit trail.
// Persisted to localStorage (wrapped in try/catch) per the product spec — everything else
// in the prototype resets to its deterministic baseline on reload, this doesn't.
import { Observable } from "./index";
import type { Approval, ApprovalDecision, ScenarioKpis } from "../domain/types";

const STORAGE_KEY = "signal-sense:approvals";

function load(): Approval[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Approval[]) : [];
  } catch {
    return [];
  }
}

function persist(list: Approval[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore persistence failure; decisions still apply for this session
  }
}

export const approvals = new Observable<Approval[]>(load());
approvals.subscribe(persist);

export function recordApproval(
  scenarioId: string,
  decision: ApprovalDecision,
  reason: string,
  kpiSnapshot: ScenarioKpis
): Approval {
  const approval: Approval = {
    id: `appr-${approvals.get().length + 1}-${scenarioId}`,
    scenarioId,
    decision,
    reason,
    timestamp: new Date().toISOString(),
    kpiSnapshot,
  };
  approvals.set([...approvals.get(), approval]);
  return approval;
}

/** Most recent decision recorded for a scenario, if any. */
export function latestApprovalForScenario(scenarioId: string): Approval | undefined {
  const list = approvals.get();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].scenarioId === scenarioId) return list[i];
  }
  return undefined;
}
