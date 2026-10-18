export type RouteId = "overview" | "signal-sense";

const DEFAULT_ROUTE: RouteId = "overview";
const VALID_ROUTES: RouteId[] = ["overview", "signal-sense"];

function parseHash(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return VALID_ROUTES.includes(hash as RouteId) ? (hash as RouteId) : DEFAULT_ROUTE;
}

export function currentRoute(): RouteId {
  return parseHash();
}

export function navigate(route: RouteId): void {
  window.location.hash = `/${route}`;
}

export function onRouteChange(listener: (route: RouteId) => void): void {
  window.addEventListener("hashchange", () => listener(parseHash()));
  if (!window.location.hash) {
    window.location.hash = `/${DEFAULT_ROUTE}`;
  }
  listener(parseHash());
}
