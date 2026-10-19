// Demo mode: auto-walks the heat-wave hero scenario through all 5 stages, asks Joule one
// question, and approves — tuned to land under ~45s for the pitch recording.
import { activeScenarioId } from "../store";
import { navigate } from "./router";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollContentToTop() {
  document.querySelector("#app-content")?.scrollTo({ top: 0, behavior: "smooth" });
}

let running = false;
export function isDemoRunning(): boolean {
  return running;
}

export async function runDemo(onDone?: () => void): Promise<void> {
  if (running) return;
  running = true;

  activeScenarioId.set("scenario-heat-wave");
  navigate("signal-sense");
  await wait(400);

  const wizard = document.querySelector<HTMLElement & { selectedStepIndex: number }>("#signal-sense-wizard");
  const setStep = (i: number) => {
    if (wizard) wizard.selectedStepIndex = i;
    scrollContentToTop();
  };

  setStep(0); // Capture
  await wait(5500);

  setStep(1); // Classify
  await wait(5500);

  setStep(2); // Adjust forecast
  await wait(6500);

  setStep(3); // Simulate
  await wait(6500);

  // Ask Joule the "why" question
  document.querySelector<HTMLElement>("#joule-item")?.click();
  await wait(500);
  document.querySelector<HTMLElement>(".joule-q")?.click();
  await wait(5500);
  document.querySelector<HTMLElement>("#joule-close-btn")?.click();
  await wait(400);

  setStep(4); // Approve
  await wait(4500);

  document.querySelector<HTMLElement>("#decision-approved")?.click();
  await wait(400);
  const reasonInput = document.querySelector<HTMLElement & { value: string }>("#reason-input");
  if (reasonInput) reasonInput.value = "Two independent weather sources confirm the heat wave — approving ahead of the weekend.";
  await wait(600);
  document.querySelector<HTMLElement>("#reason-confirm")?.click();
  await wait(1800);

  running = false;
  onDone?.();
}
