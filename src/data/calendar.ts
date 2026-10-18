// Shared "now" anchor for every generator, so the whole prototype's calendar is
// internally consistent and fully deterministic regardless of the real system date.
export const ANCHOR_DATE = new Date(Date.UTC(2026, 9, 19)); // a Monday ("this week" in the demo)

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + days);
  return next;
}

export function isoDaysFromAnchor(days: number): string {
  return isoDate(addDays(ANCHOR_DATE, days));
}
