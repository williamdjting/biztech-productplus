import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/ToggleButton.js";

import { getClassifiedSignals } from "../../domain/classifier";
import { storeById } from "../../data/catalog";
import type { ClassifiedSignal, SignalCategory } from "../../domain/types";

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  promo_cannibalization: "Promo cannibalization",
  weather: "Weather",
  viral_trend: "Viral trend",
  seasonality: "Seasonality",
  geopolitics: "Geopolitics",
  local_event: "Local event",
  competitor_action: "Competitor action",
  market_shift: "Market shift",
  panic_buying: "Panic buying",
};

const SEVERITY_DESIGN: Record<ClassifiedSignal["severity"], string> = {
  Low: "Neutral",
  Medium: "Information",
  High: "Critical",
  Critical: "Negative",
};

function regionStoreSummary(signal: ClassifiedSignal): string {
  const storeNames = signal.storeIds.slice(0, 2).map((id) => storeById(id)?.name ?? id);
  const extra = signal.storeIds.length - storeNames.length;
  return `${signal.regions.join("/")} · ${storeNames.join(", ")}${extra > 0 ? ` +${extra} more` : ""}`;
}

export function renderCapture(container: HTMLElement): void {
  const signals = getClassifiedSignals();
  const categories = Object.keys(CATEGORY_LABELS) as SignalCategory[];
  let activeFilter: SignalCategory | null = null;

  container.innerHTML = `
    <p class="page-subtitle">
      Live signal feed from Environment Canada, social trend monitoring, municipal events calendars,
      competitor flyer watch, news wire and internal POS — ${signals.length} signals captured.
    </p>
    <div id="capture-filters" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <ui5-toggle-button data-filter="all" pressed>All (${signals.length})</ui5-toggle-button>
      ${categories
        .map((c) => {
          const count = signals.filter((s) => s.category === c).length;
          return count > 0
            ? `<ui5-toggle-button data-filter="${c}">${CATEGORY_LABELS[c]} (${count})</ui5-toggle-button>`
            : "";
        })
        .join("")}
    </div>
    <div class="card-grid" id="capture-feed"></div>
  `;

  const feed = container.querySelector<HTMLElement>("#capture-feed")!;
  const filterBar = container.querySelector<HTMLElement>("#capture-filters")!;

  function renderFeed() {
    const visible = activeFilter ? signals.filter((s) => s.category === activeFilter) : signals;
    feed.innerHTML = visible
      .map(
        (s) => `
        <ui5-card>
          <ui5-card-header title-text="${s.source}" subtitle-text="${s.timestamp}"></ui5-card-header>
          <div class="kpi-card-body">
            <ui5-text>${s.rawSnippet}</ui5-text>
            <div style="margin-top:0.5rem; color:var(--sapContent_LabelColor); font-size:var(--sapFontSmallSize);">
              ${regionStoreSummary(s)}
            </div>
            <div style="margin-top:0.5rem; display:flex; flex-wrap:wrap; gap:0.25rem;">
              <ui5-tag design="${SEVERITY_DESIGN[s.severity]}">${s.severity}</ui5-tag>
              <ui5-tag design="Neutral">${CATEGORY_LABELS[s.category]}</ui5-tag>
              ${s.productCategories.map((c) => `<ui5-tag design="Neutral">${c}</ui5-tag>`).join("")}
            </div>
          </div>
        </ui5-card>
      `
      )
      .join("");
  }

  filterBar.querySelectorAll<HTMLElement>("ui5-toggle-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBar
        .querySelectorAll<HTMLElement>("ui5-toggle-button")
        .forEach((b) => b.toggleAttribute("pressed", b === btn));
      activeFilter = btn.dataset.filter === "all" ? null : (btn.dataset.filter as SignalCategory);
      renderFeed();
    });
  });

  renderFeed();
}
