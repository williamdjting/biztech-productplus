// Minimal typed pub-sub store. No framework needed for this prototype's state surface
// (theme, selected scenario, wizard step) — plain subscribe/notify is enough.
type Listener<T> = (value: T) => void;

export class Observable<T> {
  private listeners = new Set<Listener<T>>();
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    this.value = next;
    this.listeners.forEach((listener) => listener(next));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export type Theme = "sap_horizon" | "sap_horizon_dark";

const THEME_KEY = "signal-sense:theme";

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "sap_horizon" || saved === "sap_horizon_dark") return saved;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default.
  }
  return "sap_horizon";
}

export const theme = new Observable<Theme>(loadTheme());

theme.subscribe((value) => {
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch {
    // ignore persistence failure; theme still applies for this session
  }
});

export function toggleTheme(): void {
  theme.set(theme.get() === "sap_horizon" ? "sap_horizon_dark" : "sap_horizon");
}

/** Currently active hero scenario id, selected from the Overview/launchpad. */
export const activeScenarioId = new Observable<string | null>(null);
