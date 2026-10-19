import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Switch.js";
import "@ui5/webcomponents/dist/Slider.js";

import { productById } from "../../data/catalog";
import { getHeroScenarios } from "../../domain/scenarios";
import { activeScenarioId } from "../../store";
import { getSignalLevers, simulate, type SignalSetting } from "../../domain/simulation";
import { navigate } from "../router";
import type { ScenarioKpis } from "../../domain/types";

const CATEGORY_LABELS: Record<string, string> = {
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

const KPI_ROWS: { key: keyof ScenarioKpis; label: string; suffix: string; lowerIsBetter: boolean }[] = [
  { key: "stockoutRiskPct", label: "Stockout risk", suffix: "%", lowerIsBetter: true },
  { key: "projectedLostSalesUsd", label: "Projected lost sales", suffix: "$", lowerIsBetter: true },
  { key: "overstockCostUsd", label: "Overstock / markdown cost", suffix: "$", lowerIsBetter: true },
  { key: "serviceLevelPct", label: "Service level (on-shelf availability)", suffix: "%", lowerIsBetter: false },
  { key: "mape", label: "Forecast error (MAPE)", suffix: "%", lowerIsBetter: true },
];

const fmt = (n: number, suffix: string) => (suffix === "$" ? `$${n.toLocaleString()}` : `${n}${suffix}`);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function renderSimulate(container: HTMLElement): void {
  const scenarioId = activeScenarioId.get();
  const scenario = scenarioId ? getHeroScenarios().find((s) => s.id === scenarioId) : undefined;

  if (!scenario) {
    container.innerHTML = `
      <p class="placeholder-note">Select a hero scenario from Overview to run a what-if simulation.</p>
      <ui5-button id="goto-overview-btn" design="Emphasized">Go to Overview</ui5-button>
    `;
    container.querySelector("#goto-overview-btn")!.addEventListener("click", () => navigate("overview"));
    return;
  }

  const productIds = Array.from(new Set(scenario.groups.map((g) => g.productId)));

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
      <ui5-select id="sim-product-select">
        ${productIds.map((id) => `<ui5-option value="${id}">${productById(id)?.name ?? id}</ui5-option>`).join("")}
      </ui5-select>
    </div>
    <ui5-title level="H5" style="display:block; margin-bottom:0.5rem;">Signal levers</ui5-title>
    <div id="sim-levers" style="display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1.5rem;"></div>
    <ui5-title level="H5" style="display:block; margin-bottom:0.5rem;">Do nothing vs. Adjust — next 6 weeks</ui5-title>
    <table class="kf-table" id="sim-kpi-table"></table>
  `;

  const select = container.querySelector<HTMLElement & { value: string }>("#sim-product-select")!;
  const leversEl = container.querySelector<HTMLElement>("#sim-levers")!;
  const kpiTable = container.querySelector<HTMLElement>("#sim-kpi-table")!;

  let currentProductId = "";
  let storeIds: string[] = [];
  let settings: Record<string, SignalSetting> = {};

  function renderKpis() {
    const result = simulate(currentProductId, storeIds, settings);
    kpiTable.innerHTML = `
      <thead>
        <tr><th>KPI</th><th>Do nothing</th><th>Adjust (simulated)</th><th>Δ</th></tr>
      </thead>
      <tbody>
        ${KPI_ROWS.map((row) => {
          const before = result.doNothing[row.key] as number;
          const after = result.adjusted[row.key] as number;
          const delta = row.suffix === "$" ? after - before : round1(after - before);
          const improved = row.lowerIsBetter ? delta < 0 : delta > 0;
          const deltaClass = delta === 0 ? "" : improved ? "kf-up" : "kf-down";
          return `
            <tr>
              <td>${row.label}</td>
              <td>${fmt(before, row.suffix)}</td>
              <td><strong>${fmt(after, row.suffix)}</strong></td>
              <td class="${deltaClass}">${delta > 0 ? "+" : ""}${fmt(delta, row.suffix)}</td>
            </tr>
          `;
        }).join("")}
        <tr>
          <td>Planned units (vs. ${result.trueDemandUnits.toLocaleString()} actual demand)</td>
          <td>${result.doNothingPlanUnits.toLocaleString()}</td>
          <td><strong>${result.adjustedPlanUnits.toLocaleString()}</strong></td>
          <td></td>
        </tr>
      </tbody>
    `;
  }

  function renderLevers() {
    const levers = getSignalLevers(currentProductId, storeIds);
    settings = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: true, intensityPct: 100 }]));

    leversEl.innerHTML = levers.length
      ? levers
          .map(
            (lever) => `
          <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;" data-lever="${lever.signalId}">
            <ui5-switch class="lever-switch" data-id="${lever.signalId}" checked></ui5-switch>
            <span style="min-width:260px;">${lever.source} — ${CATEGORY_LABELS[lever.category] ?? lever.category} (${
              lever.direction === "up" ? "↑" : "↓"
            })</span>
            <ui5-slider class="lever-slider" data-id="${lever.signalId}" min="0" max="150" step="10" value="100" style="width:200px;"></ui5-slider>
            <span class="lever-pct" data-id="${lever.signalId}" style="min-width:3rem;">100%</span>
          </div>
        `
          )
          .join("")
      : `<p class="placeholder-note">No active signals affect this product in the next 6 weeks.</p>`;

    leversEl.querySelectorAll<HTMLElement & { checked: boolean }>(".lever-switch").forEach((sw) => {
      sw.addEventListener("change", () => {
        settings[sw.dataset.id!] = { ...settings[sw.dataset.id!], enabled: sw.checked };
        renderKpis();
      });
    });
    leversEl.querySelectorAll<HTMLElement & { value: number }>(".lever-slider").forEach((slider) => {
      slider.addEventListener("input", () => {
        const id = slider.dataset.id!;
        settings[id] = { ...settings[id], intensityPct: slider.value };
        leversEl.querySelector(`.lever-pct[data-id="${id}"]`)!.textContent = `${slider.value}%`;
        renderKpis();
      });
    });

    renderKpis();
  }

  function renderForProduct(productId: string) {
    currentProductId = productId;
    storeIds = scenario!.groups.filter((g) => g.productId === productId).map((g) => g.storeId);
    renderLevers();
  }

  select.addEventListener("change", () => renderForProduct(select.value));
  renderForProduct(productIds[0]);
}
