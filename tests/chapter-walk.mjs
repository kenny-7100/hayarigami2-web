import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createState,
  run,
  advance,
  choose,
  finishLogic,
  setAnswer,
  logicCondition,
  confirmResult,
} from "../src/game/engine.ts";
const originalData = JSON.parse(readFileSync("public/game/chapter-zero.json"));
export const chapterCoverage = new Set();
const data = {
  ...originalData,
  scripts: new Proxy(originalData.scripts, {
    get(target, key) {
      if (target[key]) chapterCoverage.add(Number(key));
      return target[key];
    },
  }),
};
const correct = {
  0: 4620,
  1: 4670,
  2: 4660,
  3: 4623,
  4: 4606,
  5: 4640,
  6: 4654,
  7: 4614,
  8: 4613,
  9: 4611,
  10: 4607,
  11: 4668,
  12: 4636,
  13: 4662,
  14: 4613,
  15: 4660,
};
export function walk(route, { bad = false, inspect = () => {}, bundle = data } = {}) {
  const trace = JSON.parse(
    readFileSync(`tests/fixtures/route-${route}.json`),
  ).trace;
  let state = run(bundle, { ...createState(bundle), script: 10001 }),
    index = 0,
    steps = 0;
  const visited = new Set();
  while (state.mode !== "ended" && steps++ < 16000) {
    assert.notEqual(state.mode, "error", state.error);
    visited.add(state.script);
    inspect(state);
    if (state.mode === "page") state = advance(bundle, state);
    else if (state.mode === "choice") {
      const entry = trace[index++];
      assert.ok(entry, `Missing choice ${state.script}:${state.pc}`);
      assert.deepEqual(entry.slice(0, 2), [state.script, state.pc]);
      state = choose(bundle, state, entry[2]);
    } else if (state.mode === "logic") {
      for (const f of (bundle.logics?.[2] ?? bundle.logic).fields.filter((f) =>
        logicCondition(state, f),
      )) {
        const choices = f.choices.filter(
          (c) => c.id && state.flags.includes(c.id),
        );
        const expected =
          f.id === 13 && state.flags.includes(640) ? 4661 : correct[f.id];
        const choice = bad
          ? choices.find((c) => c.id !== expected)
          : (choices.find((c) => c.id === expected) ?? choices[0]);
        if (choice) state = setAnswer(bundle, state, f.id, choice.id);
      }
      state = finishLogic(bundle, state);
    } else if (state.mode === "confirm")
      state = confirmResult(bundle, state, true);
    else assert.fail(state.mode);
  }
  assert.equal(state.mode, "ended");
  assert.equal(state.script, bad ? 18402 : 18401);
  return { state, visited, steps };
}
