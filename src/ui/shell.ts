import "@ui5/webcomponents-fiori/dist/ShellBar.js";
import "@ui5/webcomponents-fiori/dist/ShellBarItem.js";
import "@ui5/webcomponents-fiori/dist/SideNavigation.js";
import "@ui5/webcomponents-fiori/dist/SideNavigationItem.js";
import "@ui5/webcomponents/dist/Avatar.js";
import "@ui5/webcomponents/dist/Toast.js";
import type Toast from "@ui5/webcomponents/dist/Toast.js";

import { theme, toggleTheme } from "../store";
import { currentRoute, navigate, onRouteChange, type RouteId } from "./router";
import { renderOverview } from "./screens/overview";
import { renderSignalSense } from "./screens/signal-sense";

const SCREENS: Record<RouteId, (container: HTMLElement) => void> = {
  overview: renderOverview,
  "signal-sense": renderSignalSense,
};

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
  `;

  const content = root.querySelector<HTMLElement>("#app-content")!;
  const sideNav = root.querySelector<HTMLElement>("#app-side-nav")!;
  const toast = root.querySelector<Toast>("#app-toast")!;
  const themeItem = root.querySelector<HTMLElement>("#theme-item")!;

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
    toast.textContent = "Joule panel — coming in Stage 5.";
    toast.open = true;
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
