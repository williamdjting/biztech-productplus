import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Button.js";

import { CURRENT_WEEK_INDEX } from "../../data/history";
import { productById } from "../../data/catalog";
import { getAdjustedSeries, peakWeek, type SignalContribution } from "../../domain/forecast";
import { getHeroScenarios } from "../../domain/scenarios";
import { activeScenarioId } from "../../store";
import { navigate } from "../router";
import type { KeyFigureWeek } from "../../domain/types";

const PAST_WEEKS = 3;
const FUTURE_WEEKS = 6;

const fmt = (n: number) => n.toLocaleString();

function tableHtml(weeks: KeyFigureWeek[]): string {
  return `
    <table class="kf-table">
      <thead>
        <tr>
          <th>Week</th><th>Actual</th><th>Statistical Forecast</th><th>Demand Sensing Forecast</th>
          <th>Signal Adjustment</th><th>Final Demand</th>
        </tr>
      </thead>
      <tbody>
        ${weeks
          .map((w, i) => {
            const isCurrent = i === PAST_WEEKS;
            const adjClass = w.signalAdjustment > 0 ? "kf-up" : w.signalAdjustment < 0 ? "kf-down" : "";
            return `
            <tr class="${isCurrent ? "kf-current" : ""}">
              <td>${w.weekStart}${isCurrent ? " (this week)" : ""}</td>
              <td>${w.actual !== undefined ? fmt(w.actual) : "—"}</td>
              <td>${fmt(w.statisticalForecast)}</td>
              <td>${fmt(w.demandSensingForecast)}</td>
              <td class="${adjClass}">${w.signalAdjustment > 0 ? "+" : ""}${fmt(w.signalAdjustment)}</td>
              <td><strong>${fmt(w.finalDemand)}</strong></td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function chartSvg(weeks: KeyFigureWeek[]): string {
  const width = 760;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const allValues = weeks.flatMap((w) => [w.statisticalForecast, w.demandSensingForecast, w.finalDemand, w.actual ?? 0]);
  const maxY = Math.max(...allValues) * 1.15;
  const x = (i: number) => padding.left + (i / (weeks.length - 1)) * plotW;
  const y = (v: number) => padding.top + plotH - (v / maxY) * plotH;

  const line = (key: "statisticalForecast" | "demandSensingForecast" | "finalDemand") =>
    weeks.map((w, i) => `${x(i)},${y(w[key])}`).join(" ");

  const actualDots = weeks
    .map((w, i) => (w.actual !== undefined ? `<circle cx="${x(i)}" cy="${y(w.actual)}" r="3" fill="var(--sapNeutralColor)" />` : ""))
    .join("");

  const signalBands = weeks
    .map((w, i) => (w.signalAdjustment !== 0 ? `<rect x="${x(i) - plotW / weeks.length / 2}" y="${padding.top}" width="${plotW / weeks.length}" height="${plotH}" fill="var(--sapIndicationColor_3)" opacity="0.12" />` : ""))
    .join("");

  const weekLabels = weeks
    .map((w, i) => `<text x="${x(i)}" y="${height - 4}" font-size="9" text-anchor="middle" fill="var(--sapContent_LabelColor)">${w.weekStart.slice(5)}</text>`)
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="adjust-chart" role="img" aria-label="Forecast chart">
      ${signalBands}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" stroke="var(--sapList_BorderColor)" />
      <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" stroke="var(--sapList_BorderColor)" />
      <polyline points="${line("statisticalForecast")}" fill="none" stroke="var(--sapContent_LabelColor)" stroke-width="1.5" stroke-dasharray="4 3" />
      <polyline points="${line("demandSensingForecast")}" fill="none" stroke="var(--sapBrandColor)" stroke-width="2" />
      <polyline points="${line("finalDemand")}" fill="none" stroke="var(--sapPositiveColor)" stroke-width="2.5" />
      ${actualDots}
      ${weekLabels}
    </svg>
    <div class="chart-legend">
      <span><i class="legend-swatch" style="background:var(--sapContent_LabelColor);"></i>Statistical Forecast</span>
      <span><i class="legend-swatch" style="background:var(--sapBrandColor);"></i>Demand Sensing Forecast</span>
      <span><i class="legend-swatch" style="background:var(--sapPositiveColor);"></i>Final Demand (with Signal Adjustment)</span>
      <span><i class="legend-swatch" style="background:var(--sapNeutralColor); border-radius:50%;"></i>Actual</span>
      <span><i class="legend-swatch" style="background:var(--sapIndicationColor_3); opacity:0.3;"></i>Week with active signal</span>
    </div>
  `;
}

function waterfallHtml(weekLabel: string, baseline: number, contributions: SignalContribution[], final: number): string {
  const items: { label: string; value: number; kind: "base" | "up" | "down" }[] = [
    { label: "Demand Sensing Forecast", value: baseline, kind: "base" },
    ...contributions.map((c) => ({
      label: c.source,
      value: c.deltaUnits,
      kind: (c.deltaUnits >= 0 ? "up" : "down") as "up" | "down",
    })),
    { label: "Final Demand", value: final, kind: "base" },
  ];
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  return `
    <div class="waterfall">
      ${items
        .map((item) => {
          const heightPct = Math.max(4, (Math.abs(item.value) / maxAbs) * 100);
          const colorClass = item.kind === "up" ? "wf-up" : item.kind === "down" ? "wf-down" : "wf-base";
          return `
          <div class="wf-col">
            <div class="wf-value">${item.value > 0 && item.kind !== "base" ? "+" : ""}${fmt(item.value)}</div>
            <div class="wf-bar-track"><div class="wf-bar ${colorClass}" style="height:${heightPct}%;"></div></div>
            <div class="wf-label" title="${item.label}">${item.label}</div>
          </div>
        `;
        })
        .join("")}
    </div>
    <p class="placeholder-note">Waterfall for week of ${weekLabel} — the week with the largest total signal impact.</p>
  `;
}

export function renderAdjust(container: HTMLElement): void {
  const scenarioId = activeScenarioId.get();
  const scenario = scenarioId ? getHeroScenarios().find((s) => s.id === scenarioId) : undefined;

  if (!scenario) {
    container.innerHTML = `
      <p class="placeholder-note">Select a hero scenario from Overview to see its adjusted forecast.</p>
      <ui5-button id="goto-overview-btn" design="Emphasized">Go to Overview</ui5-button>
    `;
    container.querySelector("#goto-overview-btn")!.addEventListener("click", () => navigate("overview"));
    return;
  }

  const productIds = Array.from(new Set(scenario.groups.map((g) => g.productId)));

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
      <ui5-select id="adjust-product-select">
        ${productIds.map((id) => `<ui5-option value="${id}">${productById(id)?.name ?? id}</ui5-option>`).join("")}
      </ui5-select>
      <ui5-text id="adjust-store-count"></ui5-text>
    </div>
    <ui5-title level="H5" style="display:block; margin-top:0.5rem;">Key figures</ui5-title>
    <div id="adjust-table"></div>
    <ui5-title level="H5" style="display:block; margin-top:1.25rem;">Forecast chart</ui5-title>
    <div id="adjust-chart"></div>
    <ui5-title level="H5" style="display:block; margin-top:1.25rem;">Signal contribution waterfall</ui5-title>
    <div id="adjust-waterfall"></div>
  `;

  const tableEl = container.querySelector<HTMLElement>("#adjust-table")!;
  const chartEl = container.querySelector<HTMLElement>("#adjust-chart")!;
  const waterfallEl = container.querySelector<HTMLElement>("#adjust-waterfall")!;
  const storeCountEl = container.querySelector<HTMLElement>("#adjust-store-count")!;
  const select = container.querySelector<HTMLElement & { value: string }>("#adjust-product-select")!;

  function renderForProduct(productId: string) {
    const storeIds = scenario!.groups.filter((g) => g.productId === productId).map((g) => g.storeId);
    const series = getAdjustedSeries(productId, storeIds);
    const windowStart = CURRENT_WEEK_INDEX - PAST_WEEKS;
    const windowEnd = CURRENT_WEEK_INDEX + FUTURE_WEEKS + 1;
    const windowWeeks = series.weeks.slice(windowStart, windowEnd);

    storeCountEl.textContent = `Aggregated across ${storeIds.length} store(s)`;
    tableEl.innerHTML = tableHtml(windowWeeks);
    chartEl.innerHTML = chartSvg(windowWeeks);

    const peak = peakWeek(series);
    waterfallEl.innerHTML = waterfallHtml(
      peak.weekStart,
      peak.demandSensingForecast,
      series.contributionsByWeek[peak.weekStart] ?? [],
      peak.finalDemand
    );
  }

  select.addEventListener("change", () => renderForProduct(select.value));
  renderForProduct(productIds[0]);
}
