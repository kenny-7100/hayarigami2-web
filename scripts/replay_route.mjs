/** Strict deterministic route replay; never guesses choices or correct answers. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import {
  createState,
  enterChapter,
  run,
  advance,
  choose,
  getLogic,
  logicCondition,
  setAnswer,
  finishLogic,
  confirmResult,
  submitName,
  readVariable,
  validateSave,
  parseGameData,
} from "../src/game/engine.ts";

export function replayRoute(
  data,
  route,
  { inspect = () => {}, checkSaves = false, previous, maxSteps = 20000 } = {},
) {
  assert.ok(
    Number.isInteger(route.entry) && data.scripts[route.entry],
    "Route requires a compiled entry",
  );
  assert.ok(
    Number.isInteger(route.end),
    "Route requires an explicit expected ending",
  );
  assert.ok(
    Array.isArray(route.trace),
    "Route requires an explicit choice trace",
  );
  if (!previous && route.previousRoute) {
    assert.ok(!route.previousRoute.previousRoute, "Only one explicit prerequisite route is supported");
    previous = replayRoute(data, route.previousRoute, { checkSaves, maxSteps }).state;
  }
  let state = previous ? enterChapter(data, previous, route.entry) : run(data, { ...createState(data), script: route.entry, randomIndex: route.randomIndex ?? 0 }),
    choices = 0,
    steps = 0,
    confirmations = 0;
  const visited = new Set();
  while (true) {
    assert.ok(
      steps++ < maxSteps,
      `Route exceeded ${maxSteps} stops at ${state.script}:${state.pc}`,
    );
    assert.notEqual(state.mode, "error", state.error);
    visited.add(state.script);
    if (checkSaves)
      assert.deepEqual(
        validateSave(data, JSON.parse(JSON.stringify(state))),
        state,
      );
    inspect(state, steps);
    if (state.mode === "ended") break;
    if (["page", "credits"].includes(state.mode)) state = advance(data, state);
    else if (state.mode === "choice") {
      const row = route.trace[choices++];
      assert.ok(row, `Missing recorded choice ${state.script}:${state.pc}`);
      assert.deepEqual(
        row.slice(0, 2),
        [state.script, state.pc],
        "Route trace drift",
      );
      const choice = state.choices[row[2]];
      assert.ok(
        choice && !choice.disabled && choice.cost <= readVariable(state, 8),
        "Recorded choice unavailable",
      );
      state = choose(data, state, row[2]);
    } else if (state.mode === "logic") {
      const logic = getLogic(data, state);
      assert.ok(logic, "Missing active relation diagram");
      const answers = route.answersByLogic?.[logic.id] ?? route.answers;
      for (const field of logic.fields.filter((f) =>
        logicCondition(state, f),
      )) {
        assert.ok(
          Object.hasOwn(answers ?? {}, field.id),
          `Missing explicit answer for logic ${logic.id}, field ${field.id}`,
        );
        state = setAnswer(data, state, field.id, answers[field.id]);
      }
      state = finishLogic(data, state);
    } else if (state.mode === "confirm") {
      const answer = route.confirmations?.[confirmations++] ?? true;
      assert.equal(typeof answer, "boolean");
      state = confirmResult(data, state, answer);
    } else if (state.mode === "input") {
      const name = route.names?.[state.input.field];
      assert.equal(
        typeof name,
        "string",
        "Name input requires explicit route.names",
      );
      state = submitName(data, state, name);
    } else assert.fail(`Unhandled mode ${state.mode}`);
  }
  assert.equal(
    choices,
    route.trace.length,
    "Unused recorded choices; route ended early",
  );
  if (route.confirmations)
    assert.equal(
      confirmations,
      route.confirmations.length,
      "Unused confirmations",
    );
  assert.equal(state.script, route.end, "Unexpected ending");
  if (route.score !== undefined)
    assert.equal(readVariable(state, 10), route.score, "Unexpected score");
  if (route.penalty !== undefined)
    assert.equal(
      readVariable(state, 1),
      route.penalty,
      "Unexpected reasoning penalty",
    );
  return {
    state,
    steps,
    choices,
    stoppedScripts: [...visited].sort((a, b) => a - b),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({
      options: {
        data: { type: "string", default: "public/game/game.json" },
        route: { type: "string" },
        entry: { type: "string" },
        bundle: { type: "string" },
        "check-saves": { type: "boolean", default: false },
      },
    });
    assert.ok(
      values.route && values.bundle && /^[a-z0-9-]+$/.test(values.bundle),
      "Usage: npm run qa:replay -- --route PATH --entry ID --bundle NAME [--check-saves]",
    );
    const bytes = readFileSync(values.data),
      data = parseGameData(JSON.parse(bytes));
    const route = JSON.parse(readFileSync(values.route));
    if (values.entry) route.entry = Number(values.entry);
    const fixtures = {},
      locations = {};
    const result = replayRoute(data, route, {
      checkSaves: values["check-saves"],
      inspect(state, stop) {
        const keys = [state.mode];
        if (["page", "credits"].includes(state.mode)) {
          keys.push(`script-${state.script}`);
          for (const a of Object.values(state.animations))
            if (a.alpha > 0) keys.push(`animation-${a.id}-${a.variant}`);
        }
        for (const key of keys)
          if (!fixtures[key]) {
            // UI checkpoint only: source remains full-history for replay/save validation.
            fixtures[key] = structuredClone({
              ...state,
              history: state.history.slice(-100),
            });
            locations[key] = {
              script: state.script,
              pc: state.pc,
              stop,
              historyTruncated: state.history.length > 100,
            };
          }
      },
    });
    const directory = resolve("output/qa", values.bundle);
    mkdirSync(directory, { recursive: true });
    const metadata = {
      schemaVersion: 1,
      dataSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceSha256: data.sourceSha256,
      route: values.route,
      entry: route.entry,
      end: result.state.script,
      score: readVariable(result.state, 10),
      stops: result.steps,
      choices: result.choices,
      stoppedScripts: result.stoppedScripts,
      locations,
      note: "Stopped scripts are not total executed-record coverage. Browser checkpoint history is limited to 100 pages. Generated against the exact game.json hash.",
    };
    writeFileSync(`${directory}/fixtures.json`, JSON.stringify(fixtures));
    writeFileSync(
      `${directory}/report.json`,
      JSON.stringify(metadata, null, 2) + "\n",
    );
    console.log(
      `${result.steps} stops, ${result.choices} choices, ending ${result.state.script}; ${Object.keys(fixtures).length} browser checkpoints`,
    );
    console.log(`http://localhost:5173/tests/qa.html?bundle=${values.bundle}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
