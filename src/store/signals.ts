// In-memory working state for the Classify stage: dismiss / reclassify / merge.
// Not persisted — only approvals and the audit trail are durable per the product spec;
// the triage queue resets to the deterministic classifier output on reload.
import { getClassifiedSignals } from "../domain/classifier";
import type { ClassifiedSignal, SignalCategory } from "../domain/types";
import { Observable } from "./index";

export const classifiedSignals = new Observable<ClassifiedSignal[]>(getClassifiedSignals().map((s) => ({ ...s })));

function update(id: string, patch: Partial<ClassifiedSignal>): void {
  classifiedSignals.set(classifiedSignals.get().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function dismissSignal(id: string): void {
  update(id, { status: "dismissed" });
}

export function reclassifySignal(id: string, category: SignalCategory): void {
  const signal = classifiedSignals.get().find((s) => s.id === id);
  if (!signal) return;
  update(id, {
    category,
    why: `${signal.why} (Reclassified by planner from ${signal.category} to ${category}.)`,
  });
}

/** Keeps the highest-confidence signal in a duplicate group active; marks the rest merged. */
export function mergeSignals(ids: string[]): void {
  const all = classifiedSignals.get();
  const group = all.filter((s) => ids.includes(s.id));
  if (group.length < 2) return;
  const keeper = group.reduce((best, s) => (s.confidence > best.confidence ? s : best));
  classifiedSignals.set(
    all.map((s) => {
      if (s.id === keeper.id) {
        return { ...s, why: `${s.why} (Merged with ${group.length - 1} duplicate signal(s).)` };
      }
      if (ids.includes(s.id)) {
        return { ...s, status: "merged" };
      }
      return s;
    })
  );
}
