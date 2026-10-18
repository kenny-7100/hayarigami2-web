import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createState,
  run,
  advance,
  choose,
  readVariable,
  finishLogic,
  setAnswer,
  logicCondition,
  confirmResult,
  getLogic,
} from "../src/game/engine.ts";
export const chapterOneCoverage = new Set();
const original = JSON.parse(readFileSync("public/game/game.json"));
export const oneData = {
  ...original,
  scripts: new Proxy(original.scripts, {
    get(target, key) {
      if (target[key]) chapterOneCoverage.add(Number(key));
      return target[key];
    },
  }),
};
export function walkOne(
  route,
  { bad = false, inspect = () => {}, record = false, fullHistory = true } = {},
) {
  const fixture = JSON.parse(
    readFileSync(`tests/fixtures/chapter-one-${route}.json`),
  );
  let state = run(oneData, { ...createState(oneData), script: 20001 }),
    step = 0,
    index = 0;
  const trace = [],
    visited = new Set();
  while (state.mode !== "ended" && step++ < 18000) {
    assert.notEqual(state.mode, "error", state.error);
    visited.add(state.script);
    inspect(state);
    if (!fullHistory) state.history = [];
    if (state.mode === "page") state = advance(oneData, state);
    else if (state.mode === "choice") {
      const row = fixture.trace[index++];
      if (row) assert.deepEqual(row.slice(0, 2), [state.script, state.pc]);
      else if (!record)
        assert.fail(`Unrecorded choice ${state.script}:${state.pc}`);
      const selection =
        row?.[2] ??
        state.choices.findIndex(
          (c) => !c.disabled && c.cost <= readVariable(state, 8),
        );
      trace.push([state.script, state.pc, selection]);
      state = choose(oneData, state, selection);
    } else if (state.mode === "logic") {
      for (const field of getLogic(oneData, state).fields.filter((f) =>
        logicCondition(state, f),
      )) {
        const choices = field.choices.filter(
          (c) => c.id && state.flags.includes(c.id),
        );
        const candidate = bad
          ? choices.find((c) => c.id !== fixture.answers[field.id])
          : choices.find((c) => c.id === fixture.answers[field.id]);
        assert.ok(
          candidate,
          `No ${bad ? "incorrect" : "correct"} available answer for field ${field.id}`,
        );
        state = setAnswer(oneData, state, field.id, candidate.id);
      }
      state = finishLogic(oneData, state);
    } else if (state.mode === "confirm")
      state = confirmResult(oneData, state, true);
    else assert.fail(state.mode);
  }
  assert.equal(state.mode, "ended");
  return { state, trace, steps: step, visited, fixture };
}
