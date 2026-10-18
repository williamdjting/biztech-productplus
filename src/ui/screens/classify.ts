import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/MessageStrip.js";

import { findDuplicateGroups, LOW_CONFIDENCE_THRESHOLD } from "../../domain/classifier";
import { classifiedSignals, dismissSignal, mergeSignals, reclassifySignal } from "../../store/signals";
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
const CATEGORIES = Object.keys(CATEGORY_LABELS) as SignalCategory[];

function directionTag(s: ClassifiedSignal): string {
  const arrow = s.direction === "up" ? "↑" : "↓";
  const design = s.direction === "up" ? "Positive" : "Negative";
  return `<ui5-tag design="${design}">${arrow} ${s.magnitudePct.toFixed(1)}%</ui5-tag>`;
}

function confidenceTag(s: ClassifiedSignal): string {
  const pct = Math.round(s.confidence * 100);
  const design = s.confidence < LOW_CONFIDENCE_THRESHOLD ? "Critical" : s.confidence > 0.75 ? "Positive" : "Neutral";
  return `<ui5-tag design="${design}">Confidence ${pct}%</ui5-tag>`;
}

export function renderClassify(container: HTMLElement): void {
  container.innerHTML = `
    <p class="page-subtitle">
      Category, direction, magnitude and confidence for each signal, with a plain-language why.
      Low-confidence signals are flagged and excluded from auto-suggested adjustments by default.
    </p>
    <div id="duplicate-banners"></div>
    <div id="classify-list" style="display:flex; flex-direction:column; gap:0.75rem;"></div>
  `;

  const duplicateBanners = container.querySelector<HTMLElement>("#duplicate-banners")!;
  const list = container.querySelector<HTMLElement>("#classify-list")!;

  function render() {
    const all = classifiedSignals.get();
    const visible = all.filter((s) => s.status === "active" || s.status === "low_confidence");
    const resolvedCount = all.length - visible.length;
    const duplicateGroups = findDuplicateGroups(all);

    duplicateBanners.innerHTML = duplicateGroups
      .map(
        (group, i) => `
        <ui5-message-strip design="Warning" data-group="${i}" style="margin-bottom:0.5rem;">
          Possible duplicate: ${group.map((s) => s.source).join(" & ")} report the same ${CATEGORY_LABELS[group[0].category].toLowerCase()} event.
          <ui5-button design="Transparent" icon="process" class="merge-btn" data-group="${i}" style="margin-left:0.5rem;">Merge</ui5-button>
        </ui5-message-strip>
      `
      )
      .join("");

    duplicateBanners.querySelectorAll<HTMLElement>(".merge-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = duplicateGroups[Number(btn.dataset.group)];
        mergeSignals(group.map((s) => s.id));
      });
    });

    list.innerHTML =
      visible
        .map(
          (s) => `
        <ui5-card data-id="${s.id}">
          <div class="kpi-card-body" style="gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <ui5-select class="category-select" data-id="${s.id}">
                  ${CATEGORIES.map(
                    (c) => `<ui5-option value="${c}" ${c === s.category ? "selected" : ""}>${CATEGORY_LABELS[c]}</ui5-option>`
                  ).join("")}
                </ui5-select>
                ${directionTag(s)}
                ${confidenceTag(s)}
                ${s.status === "low_confidence" ? `<ui5-tag design="Critical">Excluded from auto-adjust</ui5-tag>` : ""}
              </div>
              <ui5-button design="Transparent" class="dismiss-btn" data-id="${s.id}" icon="decline">Dismiss</ui5-button>
            </div>
            <ui5-text>${s.why}</ui5-text>
            <div style="color:var(--sapContent_LabelColor); font-size:var(--sapFontSmallSize);">
              Window ${s.timeWindow.start} → ${s.timeWindow.end} · ${s.affectedProductIds.length} SKU(s) ×
              ${s.affectedStoreIds.length} store(s) · source: ${s.source}
            </div>
          </div>
        </ui5-card>
      `
        )
        .join("") +
      (resolvedCount > 0
        ? `<p class="placeholder-note">${resolvedCount} signal(s) dismissed or merged — hidden from this queue.</p>`
        : "");

    list.querySelectorAll<HTMLElement>(".dismiss-btn").forEach((btn) => {
      btn.addEventListener("click", () => dismissSignal(btn.dataset.id!));
    });
    list.querySelectorAll<HTMLElement & { value: string }>(".category-select").forEach((select) => {
      select.addEventListener("change", () => {
        reclassifySignal(select.dataset.id!, select.value as SignalCategory);
      });
    });
  }

  classifiedSignals.subscribe(render);
  render();
}
