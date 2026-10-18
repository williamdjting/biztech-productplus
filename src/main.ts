// Theme (Horizon + Horizon Dark) and i18n assets, bundled statically so the app
// works fully offline with no runtime fetch of package-internal files.
import "@ui5/webcomponents/dist/Assets.js";
import "@ui5/webcomponents-fiori/dist/Assets.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// Icons used anywhere in the app, imported once and explicitly (no AllIcons bulk import).
import "@ui5/webcomponents-icons/dist/home.js";
import "@ui5/webcomponents-icons/dist/line-chart.js";
import "@ui5/webcomponents-icons/dist/inbox.js";
import "@ui5/webcomponents-icons/dist/tag.js";
import "@ui5/webcomponents-icons/dist/simulate.js";
import "@ui5/webcomponents-icons/dist/accept.js";
import "@ui5/webcomponents-icons/dist/ai.js";
import "@ui5/webcomponents-icons/dist/dark-mode.js";
import "@ui5/webcomponents-icons/dist/light-mode.js";
import "@ui5/webcomponents-icons/dist/bell.js";
import "@ui5/webcomponents-icons/dist/decline.js";
import "@ui5/webcomponents-icons/dist/process.js";

import "./styles.css";
import { theme } from "./store";
import { mountShell } from "./ui/shell";

theme.subscribe((value) => {
  setTheme(value);
});
setTheme(theme.get());

const root = document.getElementById("app");
if (root) {
  mountShell(root);
}
