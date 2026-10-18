import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGame } from "../scripts/check_game.mjs";
import { replayRoute } from "../scripts/replay_route.mjs";
function game(tokens) {
  return {
    schemaVersion: 1,
    revision: "test",
    sourceSha256: "test",
    entry: 1,
    title: "test",
    scope: "test",
    backgrounds: {},
    music: {},
    terms: {},
    scripts: {
      1: {
        id: 1,
        offset: 0,
        size: 100,
        instructions: tokens.map((t, i) => ({
          ...t,
          offset: i * 4,
          length: 4,
        })),
      },
    },
  };
}
const choiceGame = () =>
  game([
    { op: 3, args: [] },
    { text: "问题" },
    { op: 102, args: [] },
    { op: 116, args: [0, 0] },
    { text: "选择" },
    { op: 117, args: [] },
    { op: 103, args: [] },
    { op: 2, args: [] },
  ]);
test("strict replay rejects missing/drifted/unused choices and wrong ending", () => {
  const data = choiceGame(),
    route = { entry: 1, end: 1, trace: [[1, 7, 0]] };
  assert.equal(replayRoute(data, route, { checkSaves: true }).choices, 1);
  assert.throws(
    () => replayRoute(data, { ...route, trace: [] }),
    /Missing recorded choice/,
  );
  assert.throws(
    () => replayRoute(data, { ...route, trace: [[1, 6, 0]] }),
    /Route trace drift/,
  );
  assert.throws(
    () =>
      replayRoute(data, {
        ...route,
        trace: [
          [1, 7, 0],
          [1, 7, 0],
        ],
      }),
    /Unused recorded choices/,
  );
  assert.throws(
    () => replayRoute(data, { ...route, end: 2 }),
    /Unexpected ending/,
  );
});
test("strict replay enforces stop budget and explicit input", () => {
  const data = game([
    { op: 3, args: [] },
    { text: "hello" },
    { op: 4, args: [] },
    { op: 101, args: [1, 0] },
  ]);
  assert.throws(
    () => replayRoute(data, { entry: 1, end: 1, trace: [] }, { maxSteps: 3 }),
    /exceeded/,
  );
  assert.throws(
    () =>
      replayRoute(game([{ op: 1001, args: [0, 4] }]), {
        entry: 1,
        end: 1,
        trace: [],
      }),
    /Name input requires/,
  );
});
test("package audit rejects missing resources, missing dimensions and unsafe paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "hs2-check-"));
  try {
    const data = game([
      { op: 401, args: [1, 0] },
      { op: 2403, args: [600, 1] },
      { op: 914, args: [70] },
    ]);
    data.backgrounds = { 1: "missing.png", 2: "../escape.png" };
    data.silentEffects = [70];
    const errors = checkGame(data, dir).errors.join("\n");
    assert.match(errors, /Missing asset/);
    assert.match(errors, /escapes package/);
    assert.match(errors, /native background dimensions/);
    assert.match(errors, /animation 600:1/);
    assert.doesNotMatch(errors, /effects:70/);
    data.backgrounds = { 1: "bad.png" };
    writeFileSync(join(dir, "bad.png"), "bad");
    assert.match(checkGame(data, dir).errors.join("\n"), /Invalid PNG/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("package audit treats 32-bit targets and missing text as evidence, never truncates IDs", () => {
  const data = game([
    { op: 101, args: [70001 % 65536, 1] },
    { text: "\ufffd" },
  ]);
  const errors = checkGame(data, tmpdir()).errors.join("\n");
  assert.match(errors, /missing jump target 70001/);
  assert.doesNotMatch(errors, /missing jump target 4465/);
  assert.match(errors, /replacement character/);
});
