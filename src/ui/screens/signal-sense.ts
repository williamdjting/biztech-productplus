import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Tag.js";

import { getHeroScenarios } from "../../domain/scenarios";
import { activeScenarioId } from "../../store";
import { renderCapture } from "./capture";
import { renderClassify } from "./classify";
import { renderAdjust } from "./adjust";
import { renderSimulate } from "./simulate";
import { renderApprove } from "./approve";

const STAGES = [
  { key: "capture", title: "Capture", icon: "inbox" },
  { key: "classify", title: "Classify", icon: "tag" },
  { key: "adjust", title: "Adjust forecast", icon: "line-chart" },
  { key: "simulate", title: "Simulate", icon: "simulate" },
  { key: "approve", title: "Approve", icon: "accept" },
] as const;

export function renderSignalSense(container: HTMLElement): void {
  const scenarioId = activeScenarioId.get();
  const scenario = scenarioId ? getHeroScenarios().find((s) => s.id === scenarioId) : undefined;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <ui5-title level="H2">Signal Sense</ui5-title>
        <p class="page-subtitle">
          ${
            scenario
              ? `Scenario: <strong>${scenario.name}</strong> &middot; ${scenario.groups.length} product &times; store combinations`
              : "Select a scenario from Overview, or step through the flow with sample data."
          }
        </p>
      </div>
    </div>

    <ui5-wizard id="signal-sense-wizard" selected-step-index="0">
      ${STAGES.map(
        (stage, index) => `
        <ui5-wizard-step
          title-text="${stage.title}"
          icon="${stage.icon}"
          ${index === 0 ? "selected" : ""}
        >
          <div class="wizard-step-body">
            <ui5-title level="H4">${index + 1}. ${stage.title}</ui5-title>
            <div id="stage-body-${stage.key}">
              ${"blurb" in stage ? `<p class="placeholder-note">${stage.blurb}</p>` : ""}
            </div>
          </div>
        </ui5-wizard-step>
      `
      ).join("")}
    </ui5-wizard>
  `;

  renderCapture(container.querySelector<HTMLElement>("#stage-body-capture")!);
  renderClassify(container.querySelector<HTMLElement>("#stage-body-classify")!);
  renderAdjust(container.querySelector<HTMLElement>("#stage-body-adjust")!);
  renderSimulate(container.querySelector<HTMLElement>("#stage-body-simulate")!);
  renderApprove(container.querySelector<HTMLElement>("#stage-body-approve")!);
}
