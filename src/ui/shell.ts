import "@ui5/webcomponents-fiori/dist/ShellBar.js";
import "@ui5/webcomponents-fiori/dist/ShellBarItem.js";
import "@ui5/webcomponents-fiori/dist/SideNavigation.js";
import "@ui5/webcomponents-fiori/dist/SideNavigationItem.js";
import "@ui5/webcomponents/dist/Avatar.js";
import "@ui5/webcomponents/dist/Toast.js";
import "@ui5/webcomponents/dist/Dialog.js";
import "@ui5/webcomponents/dist/Button.js";
import type Toast from "@ui5/webcomponents/dist/Toast.js";
import type Dialog from "@ui5/webcomponents/dist/Dialog.js";

import { theme, toggleTheme, activeScenarioId } from "../store";
import { currentRoute, navigate, onRouteChange, type RouteId } from "./router";
import { renderOverview } from "./screens/overview";
import { renderSignalSense } from "./screens/signal-sense";
import { answerQuestion, SUGGESTED_QUESTIONS } from "../domain/joule";
import { getHeroScenarios } from "../domain/scenarios";

const SCREENS: Record<RouteId, (container: HTMLElement) => void> = {
  overview: renderOverview,
  "signal-sense": renderSignalSense,
};

let appToast: Toast | null = null;

/** Shared app-level toast, available to any screen once the shell has mounted. */
export function showToast(message: string): void {
  if (!appToast) return;
  appToast.textContent = message;
  appToast.open = true;
}

export function mountShell(root: HTMLElement): void {
  root.innerHTML = `
    <ui5-shellbar
      id="app-shellbar"
      primary-title="SAP Integrated Business Planning"
      secondary-title="Signal Sense"
      show-notifications
      notifications-count="4"
    >
      <ui5-avatar slot="profile" initials="P" title="Priya · Demand Planner"></ui5-avatar>
      <ui5-shellbar-item id="joule-item" icon="ai" text="Joule" title="Ask Joule"></ui5-shellbar-item>
      <ui5-shellbar-item id="theme-item" icon="dark-mode" text="Dark mode" title="Toggle dark mode"></ui5-shellbar-item>
    </ui5-shellbar>

    <div class="app-body">
      <ui5-side-navigation class="app-side-nav" id="app-side-nav">
        <ui5-side-navigation-item icon="home" text="Overview" data-route="overview"></ui5-side-navigation-item>
        <ui5-side-navigation-item icon="line-chart" text="Signal Sense" data-route="signal-sense"></ui5-side-navigation-item>
      </ui5-side-navigation>
      <main class="app-content" id="app-content"></main>
    </div>

    <ui5-toast id="app-toast" placement="BottomCenter"></ui5-toast>

    <ui5-dialog id="joule-dialog" header-text="Joule">
      <div style="width:28rem; max-width:80vw;">
        <div id="joule-transcript" style="display:flex; flex-direction:column; gap:0.75rem; max-height:22rem; overflow-y:auto; margin-bottom:0.75rem;"></div>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${SUGGESTED_QUESTIONS.map(
            (q) =>
              `<ui5-button design="Transparent" class="joule-q" data-id="${q.id}" style="justify-content:flex-start;">${q.prompt}</ui5-button>`
          ).join("")}
        </div>
      </div>
      <div slot="footer" style="display:flex; justify-content:flex-end; width:100%;">
        <ui5-button id="joule-close-btn" design="Transparent">Close</ui5-button>
      </div>
    </ui5-dialog>
  `;

  const content = root.querySelector<HTMLElement>("#app-content")!;
  const sideNav = root.querySelector<HTMLElement>("#app-side-nav")!;
  appToast = root.querySelector<Toast>("#app-toast")!;
  const themeItem = root.querySelector<HTMLElement>("#theme-item")!;
  const jouleDialog = root.querySelector<Dialog>("#joule-dialog")!;
  const jouleTranscript = root.querySelector<HTMLElement>("#joule-transcript")!;

  const applySideNavSelection = (route: RouteId) => {
    sideNav.querySelectorAll<HTMLElement>("ui5-side-navigation-item").forEach((item) => {
      item.toggleAttribute("selected", item.dataset.route === route);
    });
  };

  sideNav.querySelectorAll<HTMLElement>("ui5-side-navigation-item").forEach((item) => {
    item.addEventListener("click", () => {
      const route = item.dataset.route as RouteId;
      navigate(route);
    });
  });

  root.querySelector<HTMLElement>("#joule-item")!.addEventListener("click", () => {
    jouleDialog.open = true;
  });
  root.querySelector<HTMLElement>("#joule-close-btn")!.addEventListener("click", () => {
    jouleDialog.open = false;
  });
  root.querySelectorAll<HTMLElement>(".joule-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scenarioId = activeScenarioId.get();
      const scenario = scenarioId ? getHeroScenarios().find((s) => s.id === scenarioId) : undefined;
      const answer = answerQuestion(btn.dataset.id!, scenario);
      jouleTranscript.insertAdjacentHTML(
        "beforeend",
        `
          <div><strong>Priya:</strong> ${btn.textContent}</div>
          <div><strong>Joule:</strong><br/>${answer.replace(/\n/g, "<br/>")}</div>
        `
      );
      jouleTranscript.scrollTop = jouleTranscript.scrollHeight;
    });
  });

  themeItem.addEventListener("click", () => {
    toggleTheme();
  });

  theme.subscribe((value) => {
    themeItem.setAttribute("icon", value === "sap_horizon_dark" ? "light-mode" : "dark-mode");
  });
  themeItem.setAttribute("icon", theme.get() === "sap_horizon_dark" ? "light-mode" : "dark-mode");

  onRouteChange((route) => {
    applySideNavSelection(route);
    SCREENS[route](content);
  });

  applySideNavSelection(currentRoute());
}
