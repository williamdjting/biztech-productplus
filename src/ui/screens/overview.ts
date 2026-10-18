import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Tag.js";

import { getCatalog } from "../../data/catalog";
import { getHeroScenarios } from "../../domain/scenarios";
import { activeScenarioId } from "../../store";
import { navigate } from "../router";

export function renderOverview(container: HTMLElement): void {
  const catalog = getCatalog();
  const scenarios = getHeroScenarios();
  const regions = new Set(catalog.stores.map((s) => s.region));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <ui5-title level="H2">Signal Sense — Overview</ui5-title>
        <p class="page-subtitle">Anomaly-aware add-on for SAP IBP for Demand &middot; Western Canada retail planning area</p>
      </div>
    </div>

    <div class="card-grid" id="kpi-cards"></div>

    <ui5-title level="H4" style="display:block; margin-top:1.75rem;">Hero scenarios</ui5-title>
    <p class="page-subtitle">Fully worked examples, ready to walk through Capture &rarr; Classify &rarr; Adjust &rarr; Simulate &rarr; Approve.</p>
    <div class="card-grid" id="scenario-cards"></div>
  `;

  const kpis: { label: string; value: string }[] = [
    { label: "SKUs in planning area", value: catalog.totalProducts.toLocaleString() },
    { label: "Stores across Western Canada", value: catalog.totalStores.toLocaleString() },
    { label: "Regions covered", value: String(regions.size) },
    { label: "Hero scenarios ready", value: String(scenarios.length) },
  ];

  const kpiContainer = container.querySelector<HTMLElement>("#kpi-cards")!;
  kpiContainer.innerHTML = kpis
    .map(
      (kpi) => `
      <ui5-card>
        <div class="kpi-card-body">
          <span class="kpi-value">${kpi.value}</span>
          <span class="kpi-label">${kpi.label}</span>
        </div>
      </ui5-card>
    `
    )
    .join("");

  const scenarioContainer = container.querySelector<HTMLElement>("#scenario-cards")!;
  scenarioContainer.innerHTML = scenarios
    .map(
      (scenario) => `
      <ui5-card data-scenario-id="${scenario.id}">
        <ui5-card-header title-text="${scenario.name}" subtitle-text="${scenario.regions.join(', ')}"></ui5-card-header>
        <div class="kpi-card-body">
          <ui5-text>${scenario.description}</ui5-text>
          <div style="margin-top:0.5rem;">
            ${scenario.regions.map((r) => `<ui5-tag design="Information">${r}</ui5-tag>`).join(" ")}
          </div>
          <ui5-button design="Emphasized" class="open-scenario-btn" style="margin-top:0.75rem; align-self:flex-start;">
            Open in Signal Sense
          </ui5-button>
        </div>
      </ui5-card>
    `
    )
    .join("");

  scenarioContainer.querySelectorAll<HTMLElement>(".open-scenario-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const card = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-scenario-id]");
      const scenarioId = card?.dataset.scenarioId ?? null;
      activeScenarioId.set(scenarioId);
      navigate("signal-sense");
    });
  });
}
