import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advance,
  createState,
  parseGameData,
  run,
  submitName,
  validateSave,
  visibleBackground,
} from "../src/game/engine.ts";
const data = parseGameData(
  JSON.parse(
    readFileSync(
      new URL("../public/game/prologue.json", import.meta.url),
      "utf8",
    ),
  ),
);
function next(s) {
  return s.mode === "input"
    ? submitName(data, s, s.input.field === 0 ? "林" : "小雨")
    : advance(data, s);
}
function traverse(initial) {
  let state = run(data, initial),
    count = 0;
  const states = [];
  while (state.mode !== "ended" && count++ < 300) {
    assert.notEqual(state.mode, "error", state.error);
    states.push(state);
    state = next(state);
  }
  assert.equal(state.mode, "ended");
  states.push(state);
  return states;
}
test("actual prologue completes with Unicode names, backgrounds, music, terms and flags", () => {
  const states = traverse(createState(data));
  const end = states.at(-1);
  assert.deepEqual([...new Set(states.map((s) => s.script))], [1, 2, 3]);
  assert.equal(states.filter((s) => s.mode === "input").length, 2);
  assert.ok(end.history.some((p) => p.text.includes("林小雨")));
  assert.ok(end.flags.includes(3150));
  assert.deepEqual(
    [...end.unlocked].sort((a, b) => a - b),
    [1, 2, 3, 4, 108],
  );
  assert.deepEqual(
    [...new Set(states.map(visibleBackground).filter(Boolean))].sort(),
    [196, 515],
  );
  assert.ok(states.some((s) => s.music === 6));
  assert.ok(states.some((s) => s.music === 8));
  assert.ok(states.some((s) => s.music === 9));
  assert.ok(end.history.every((p) => p.text && !p.text.includes("\ufffd")));
  console.log(
    `Normal prologue: ${end.history.length} pages, ${states.length} save points`,
  );
});
test("every wait point can be serialized, validated and resumed identically", () => {
  for (const s of traverse(createState(data))) {
    const restored = validateSave(data, JSON.parse(JSON.stringify(s)));
    assert.deepEqual(restored, s);
    assert.deepEqual(next(restored), next(s));
  }
});
test("original flag 2490 takes alternate script 4", () => {
  const state = createState(data);
  state.script = 2;
  state.pc = data.scripts[2].instructions.findIndex(
    (t) => t.op === 106 && t.args[0] === 1 && t.args[1] === 2490,
  );
  state.flags = [2490];
  const states = traverse(state);
  assert.ok(states.some((s) => s.script === 4));
  assert.ok(!states.some((s) => s.script === 3));
});
test("rejects incompatible or malformed saves and invalid Unicode names", () => {
  const states = traverse(createState(data));
  const page = states[0];
  for (const patch of [
    { revision: "other" },
    { pc: 99999 },
    { names: ["", "a"] },
    { mode: "running" },
    { layers: { 0: { asset: 999, alpha: 1 } } },
    { history: [{}] },
  ])
    assert.throws(() => validateSave(data, { ...page, ...patch }));
  const input = states.find((s) => s.mode === "input");
  for (const name of ["", "a".repeat(33), "a\u0000", "a\u202e"])
    assert.throws(() => submitName(data, input, name));
  assert.equal(submitName(data, input, "林😀").names[0], "林😀");
});
const token = (op, args = [], offset = 100) => ({
  op,
  args,
  offset,
  length: 4,
});
function fixture(instructions) {
  return {
    ...data,
    entry: 99,
    scripts: { 99: { id: 99, offset: 100, size: 100, instructions } },
  };
}
test("nested false conditions skip correctly; unknown operations fail with source offset", () => {
  let d = fixture([
    token(106, [1, 7]),
    token(106, [256, 8]),
    token(801, [1, 9]),
    token(107),
    token(107),
    token(801, [1, 10]),
    token(2),
  ]);
  let s = run(d, createState(d));
  assert.deepEqual(s.flags, [10]);
  d = fixture([token(65535, [], 1234)]);
  s = run(d, createState(d));
  assert.equal(s.mode, "error");
  assert.match(s.error, /0x4d2/);
});
test("invalid targets and infinite loops fail explicitly", () => {
  for (const tokens of [
    [token(101, [999])],
    [token(101, [99])],
    [token(106, [1, 7])],
  ]) {
    const d = fixture(tokens);
    assert.equal(run(d, createState(d)).mode, "error");
  }
});
