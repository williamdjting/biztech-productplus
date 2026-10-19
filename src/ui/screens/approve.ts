import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Text.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Tag.js";
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/CardHeader.js";
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/TextArea.js";
import "@ui5/webcomponents-fiori/dist/Timeline.js";
import "@ui5/webcomponents-fiori/dist/TimelineItem.js";
import type Dialog from "@ui5/webcomponents/dist/Dialog.js";
import type TextArea from "@ui5/webcomponents/dist/TextArea.js";

import { productById } from "../../data/catalog";
import { getHeroScenarios } from "../../domain/scenarios";
import { getClassifiedSignals } from "../../domain/classifier";
import { getSignalLevers, simulate } from "../../domain/simulation";
import { RISKS } from "../../domain/risks";
import { activeScenarioId } from "../../store";
import { approvals, latestApprovalForScenario, recordApproval } from "../../store/approvals";
import { showToast } from "../shell";
import { navigate } from "../router";
import type { ApprovalDecision } from "../../domain/types";

const SEVERITY_DESIGN: Record<string, string> = { Low: "Neutral", Medium: "Information", High: "Critical" };

const DECISION_COPY: Record<ApprovalDecision, { verb: string; toast: string }> = {
  approved: { verb: "Approve", toast: "Approved — written back to IBP Consensus Demand." },
  modified: { verb: "Modify", toast: "Modification recorded — forecast left at the planner-adjusted values." },
  rejected: { verb: "Reject", toast: "Rejected — the baseline forecast is unchanged." },
};

export function renderApprove(container: HTMLElement): void {
  const scenarioId = activeScenarioId.get();
  const scenario = scenarioId ? getHeroScenarios().find((s) => s.id === scenarioId) : undefined;

  if (!scenario) {
    container.innerHTML = `
      <p class="placeholder-note">Select a hero scenario from Overview to review and approve its adjustment.</p>
      <ui5-button id="goto-overview-btn" design="Emphasized">Go to Overview</ui5-button>
    `;
    container.querySelector("#goto-overview-btn")!.addEventListener("click", () => navigate("overview"));
    return;
  }

  const productIds = Array.from(new Set(scenario.groups.map((g) => g.productId)));

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
      <ui5-select id="approve-product-select">
        ${productIds.map((id) => `<ui5-option value="${id}">${productById(id)?.name ?? id}</ui5-option>`).join("")}
      </ui5-select>
    </div>
    <ui5-text id="approve-recommendation" style="display:block; margin-bottom:1rem;"></ui5-text>
    <div class="card-grid" id="approve-kpis" style="margin-bottom:1.5rem;"></div>

    <ui5-title level="H5" style="display:block; margin-bottom:0.5rem;">Supporting signals</ui5-title>
    <div id="approve-signals" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1.5rem;"></div>

    <ui5-title level="H5" style="display:block; margin-bottom:0.5rem;">Risks &amp; guardrails</ui5-title>
    <ui5-card style="margin-bottom:1.5rem;">
      <div class="kpi-card-body">
        ${RISKS.map(
          (r) => `
          <div style="display:flex; gap:0.5rem; align-items:flex-start; padding:0.35rem 0; border-bottom:1px solid var(--sapList_BorderColor);">
            <ui5-tag design="${SEVERITY_DESIGN[r.severity]}" style="flex-shrink:0; margin-top:0.1rem;">${r.severity}</ui5-tag>
            <div><strong>${r.risk}</strong><br/><span class="placeholder-note">${r.mitigation}</span></div>
          </div>
        `
        ).join("")}
      </div>
    </ui5-card>

    <div id="approve-status" style="margin-bottom:1rem;"></div>
    <div style="display:flex; gap:0.5rem; margin-bottom:2rem;">
      <ui5-button id="decision-approved" design="Positive" icon="accept">Approve</ui5-button>
      <ui5-button id="decision-modified" design="Default" icon="edit">Modify</ui5-button>
      <ui5-button id="decision-rejected" design="Negative" icon="decline">Reject</ui5-button>
    </div>

    <ui5-title level="H5" style="display:block; margin-bottom:0.5rem;">Change history</ui5-title>
    <ui5-timeline id="approve-timeline"></ui5-timeline>

    <ui5-dialog id="reason-dialog" header-text="Reason">
      <div style="width:24rem; max-width:80vw;">
        <ui5-textarea id="reason-input" placeholder="Why? (required — this becomes part of the audit trail)" rows="4" style="width:100%;"></ui5-textarea>
      </div>
      <div slot="footer" style="display:flex; justify-content:flex-end; gap:0.5rem; width:100%;">
        <ui5-button id="reason-cancel" design="Transparent">Cancel</ui5-button>
        <ui5-button id="reason-confirm" design="Emphasized">Confirm</ui5-button>
      </div>
    </ui5-dialog>
  `;

  const select = container.querySelector<HTMLElement & { value: string }>("#approve-product-select")!;
  const recommendationEl = container.querySelector<HTMLElement>("#approve-recommendation")!;
  const kpisEl = container.querySelector<HTMLElement>("#approve-kpis")!;
  const signalsEl = container.querySelector<HTMLElement>("#approve-signals")!;
  const statusEl = container.querySelector<HTMLElement>("#approve-status")!;
  const timelineEl = container.querySelector<HTMLElement>("#approve-timeline")!;
  const reasonDialog = container.querySelector<Dialog>("#reason-dialog")!;
  const reasonInput = container.querySelector<TextArea>("#reason-input")!;

  let currentProductId = "";
  let currentStoreIds: string[] = [];
  let pendingDecision: ApprovalDecision | null = null;

  function renderStatus() {
    const latest = latestApprovalForScenario(scenario!.id);
    statusEl.innerHTML = latest
      ? `<ui5-tag design="${latest.decision === "approved" ? "Positive" : latest.decision === "rejected" ? "Negative" : "Critical"}">${
          DECISION_COPY[latest.decision].verb
        }d ${new Date(latest.timestamp).toLocaleString()}</ui5-tag> <span class="placeholder-note">"${latest.reason}"</span>`
      : `<span class="placeholder-note">No decision recorded yet for this scenario.</span>`;
  }

  function renderTimeline() {
    const items = approvals.get();
    timelineEl.innerHTML = items.length
      ? [...items]
          .reverse()
          .map((a) => {
            const s = getHeroScenarios().find((sc) => sc.id === a.scenarioId);
            const icon = a.decision === "approved" ? "accept" : a.decision === "rejected" ? "decline" : "edit";
            return `
              <ui5-timeline-item
                icon="${icon}"
                title-text="${DECISION_COPY[a.decision].verb}d — ${s?.name ?? a.scenarioId}"
                subtitle-text="${a.reason.replace(/"/g, "&quot;")}"
                name="${new Date(a.timestamp).toLocaleString()}"
              ></ui5-timeline-item>
            `;
          })
          .join("")
      : `<p class="placeholder-note">No approvals recorded yet.</p>`;
  }

  function renderForProduct(productId: string) {
    currentProductId = productId;
    currentStoreIds = scenario!.groups.filter((g) => g.productId === productId).map((g) => g.storeId);

    const levers = getSignalLevers(productId, currentStoreIds);
    const settings = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: true, intensityPct: 100 }]));
    const result = simulate(productId, currentStoreIds, settings);

    const avgConfidence =
      levers.length === 0
        ? 0
        : Math.round(
            (levers
              .map((l) => getClassifiedSignals().find((s) => s.id === l.signalId)?.confidence ?? 0)
              .reduce((a, b) => a + b, 0) /
              levers.length) *
              100
          );

    recommendationEl.innerHTML =
      levers.length === 0
        ? `No active signals currently affect ${productById(productId)?.name}. Baseline forecast stands.`
        : `Adjusting <strong>${productById(productId)?.name}</strong> across ${currentStoreIds.length} store(s) is projected to cut stockout risk from ` +
          `${result.doNothing.stockoutRiskPct}% to ${result.adjusted.stockoutRiskPct}% and avoid ~$${(
            result.doNothing.projectedLostSalesUsd - result.adjusted.projectedLostSalesUsd
          ).toLocaleString()} in lost sales over the next 6 weeks, at an average confidence of ${avgConfidence}% across ${levers.length} signal(s).`;

    const kpis = [
      { label: "Stockout risk (adjusted)", value: `${result.adjusted.stockoutRiskPct}%` },
      { label: "Service level (adjusted)", value: `${result.adjusted.serviceLevelPct}%` },
      { label: "Lost sales avoided", value: `$${(result.doNothing.projectedLostSalesUsd - result.adjusted.projectedLostSalesUsd).toLocaleString()}` },
      { label: "Overstock cost (adjusted)", value: `$${result.adjusted.overstockCostUsd.toLocaleString()}` },
      { label: "Avg. signal confidence", value: `${avgConfidence}%` },
    ];
    kpisEl.innerHTML = kpis
      .map(
        (k) => `
        <ui5-card><div class="kpi-card-body"><span class="kpi-value">${k.value}</span><span class="kpi-label">${k.label}</span></div></ui5-card>
      `
      )
      .join("");

    signalsEl.innerHTML = levers.length
      ? levers
          .map((l) => {
            const s = getClassifiedSignals().find((sig) => sig.id === l.signalId)!;
            return `
            <ui5-card>
              <div class="kpi-card-body" style="gap:0.25rem;">
                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                  <strong>${s.source}</strong>
                  <ui5-tag design="Neutral">${s.category.replace(/_/g, " ")}</ui5-tag>
                  <ui5-tag design="${s.direction === "up" ? "Positive" : "Negative"}">${s.direction === "up" ? "↑" : "↓"} ${s.magnitudePct.toFixed(1)}%</ui5-tag>
                  <ui5-tag design="${s.confidence < 0.5 ? "Critical" : "Neutral"}">Confidence ${Math.round(s.confidence * 100)}%</ui5-tag>
                </div>
                <span class="placeholder-note">${s.why}</span>
              </div>
            </ui5-card>
          `;
          })
          .join("")
      : `<p class="placeholder-note">No contributing signals for this product.</p>`;

    renderStatus();
  }

  function openReasonDialog(decision: ApprovalDecision) {
    pendingDecision = decision;
    reasonDialog.headerText = `${DECISION_COPY[decision].verb} — reason`;
    reasonInput.value = "";
    reasonDialog.open = true;
  }

  container.querySelector("#decision-approved")!.addEventListener("click", () => openReasonDialog("approved"));
  container.querySelector("#decision-modified")!.addEventListener("click", () => openReasonDialog("modified"));
  container.querySelector("#decision-rejected")!.addEventListener("click", () => openReasonDialog("rejected"));

  container.querySelector("#reason-cancel")!.addEventListener("click", () => {
    reasonDialog.open = false;
  });

  container.querySelector("#reason-confirm")!.addEventListener("click", () => {
    if (!pendingDecision || !reasonInput.value.trim()) {
      reasonInput.valueState = "Negative";
      return;
    }
    const levers = getSignalLevers(currentProductId, currentStoreIds);
    const settings = Object.fromEntries(levers.map((l) => [l.signalId, { enabled: true, intensityPct: 100 }]));
    const result = simulate(currentProductId, currentStoreIds, settings);

    recordApproval(scenario!.id, pendingDecision, reasonInput.value.trim(), result.adjusted);
    showToast(DECISION_COPY[pendingDecision].toast);
    reasonDialog.open = false;
    renderStatus();
    renderTimeline();
  });

  select.addEventListener("change", () => renderForProduct(select.value));
  renderForProduct(productIds[0]);
  renderTimeline();
}
