import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createState } from "../src/game/engine";
import type { GameData } from "../src/game/engine";
import { useMediaState } from "../src/game/useMediaState";

const data: GameData = { schemaVersion: 1, revision: "qa", entry: 1, title: "QA", sourceSha256: "qa", scope: "qa",
  scripts: { 1: { id: 1, offset: 0, size: 0, instructions: [] } }, music: {}, terms: {},
  backgrounds: { 1: "../tests/animation-white.svg?gate-a", 2: "../tests/animation-white.svg?gate-b", 3: "../tests/animation-white.svg?gate-c" } };
const state = (id: number) => ({ ...createState(data), mode: "input" as const, layers: { 0: { asset: id, alpha: 1 } } });
const initial = state(1);
let commits = 0;
let fail = true;
let release: (() => void) | undefined;
const fetchOriginal = window.fetch;
window.fetch = async (input, init) => {
  if (String(input).includes("gate-b")) {
    await new Promise<void>(resolve => { release = resolve; });
    if (fail) throw new TypeError("Injected transition failure");
  }
  return fetchOriginal(input, init);
};
export function Probe() {
  const media = useMediaState(data, initial);
  return <><span id="state">{media.state?.layers[0]?.asset ?? "none"}</span>
    <span id="busy">{String(media.mediaLoading)}</span><span id="error">{media.mediaError}</span>
    <button id="next" onClick={() => void media.setState(state(2), () => { commits++; })}>Next</button>
    <button id="duplicate" onClick={() => void media.setState(state(3))}>Duplicate</button>
    <button id="retry" onClick={() => void media.retryMedia()}>Retry</button></>;
}
const root = createRoot(document.querySelector("#root")!);
root.render(<StrictMode><Probe /></StrictMode>);
const text = (id: string) => document.querySelector(`#${id}`)?.textContent;
const click = (id: string) => (document.querySelector(`#${id}`) as HTMLButtonElement).click();
async function until(check: () => boolean) {
  const start = performance.now();
  while (!check()) {
    if (performance.now() - start > 5000) throw new Error("Timed out waiting for transition");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
const results: string[] = [];
function check(condition: boolean, name: string) { if (!condition) throw new Error(name); results.push(name); }
try {
  await until(() => text("state") === "1" && text("busy") === "false");
  check(text("state") === "1", "Initial state is prepared under StrictMode");
  click("next");
  await until(() => !!release);
  click("duplicate");
  check(text("state") === "1" && commits === 0, "Pending load keeps the old state and rejects duplicate progression");
  release!(); release = undefined;
  await until(() => !!text("error"));
  check(text("state") === "1" && commits === 0, "Failed load never publishes progress or runs restore completion");
  fail = false;
  click("retry");
  await until(() => !!release);
  release!(); release = undefined;
  await until(() => text("state") === "2" && text("busy") === "false");
  check(Number(commits) === 1 && !text("error"), "Retry publishes the exact target and runs restore completion exactly once");
  document.querySelector("#result")!.textContent = JSON.stringify({ passed: results.length, results }, null, 2);
} catch (error) {
  document.querySelector("#result")!.textContent = JSON.stringify({ passed: results.length, error: String(error), results }, null, 2);
  throw error;
} finally {
  window.fetch = fetchOriginal;
  root.unmount();
}
