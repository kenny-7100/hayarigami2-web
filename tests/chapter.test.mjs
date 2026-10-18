import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  formatGameText,
  createState,
  parseGameData,
  run,
  advance,
  choose,
  readVariable,
  finishLogic,
  setAnswer,
  logicCondition,
  confirmResult,
  validateSave,
  openLogic,
  compare,
} from "../src/game/engine.ts";
const data = parseGameData(
  JSON.parse(readFileSync("public/game/chapter-zero.json")),
);
import { walk, chapterCoverage } from "./chapter-walk.mjs";
for (const route of ["science", "occult"])
  test(`complete real ${route} route: choices, reasoning, successful ending and full-history saves`, () => {
    let waits = 0,
      logic,
      confirmation,
      choice;
    const { state, visited, steps } = walk(route, {
      inspect: (s) => {
        waits++;
        if (s.mode === "logic") logic = s;
        if (s.mode === "confirm") confirmation = s;
        if (s.mode === "choice") choice = s;
        // Every wait is restorable; full accumulated history retained throughout the route.
        const restored = validateSave(data, JSON.parse(JSON.stringify(s)));
        assert.deepEqual(restored, s);
        if (waits % 100 === 0 && s.mode === "page")
          assert.deepEqual(advance(data, restored), advance(data, s));
      },
    });
    assert.ok(visited.has(18301));
    assert.ok(visited.has(18401));
    assert.ok(state.flags.includes(route === "science" ? 640 : 641));
    assert.ok(state.history.length > 2000);
    assert.ok(state.variables[10] >= state.variables[1]);
    assert.deepEqual(
      validateSave(data, JSON.parse(JSON.stringify(state))),
      state,
    );
    assert.ok(logic && confirmation && choice);
    const back = confirmResult(data, confirmation, false);
    assert.notEqual(back.mode, "error");
    assert.equal(back.mode, "logic");
    assert.throws(() => setAnswer(data, logic, 999, 4620));
    assert.throws(() => setAnswer(data, logic, 0, 65535));
    const field = data.logic.fields.find((f) => logicCondition(logic, f));
    const locked = field.choices.find(
      (c) => c.id && !logic.flags.includes(c.id),
    );
    if (locked)
      assert.throws(() => setAnswer(data, logic, field.id, locked.id));
    for (const patch of [
      { variables: { 8: NaN } },
      { answers: { 0: 65535 } },
      { choices: [{ text: "bad" }] },
      { audioEvents: [{}] },
      { animations: { 0: { id: 8, alpha: 5 } } },
      { sprites: { 0: { asset: 999999, alpha: 1 } } },
    ])
      assert.throws(() => validateSave(data, { ...choice, ...patch }));
    console.log(
      `${route}: ${steps} waits; ${state.history.length} retained pages; score ${state.variables[10]}`,
    );
  });
test("incorrect reasoning follows a different ending without blocking progression", () => {
  const { state, visited } = walk("occult", { bad: true });
  assert.ok(!visited.has(18301));
  assert.ok(!visited.has(18401));
  assert.ok(state.variables[10] < state.variables[1]);
});
test("all chapter references and native media files exist, no replacement glyphs", () => {
  assert.equal(
    Object.keys(data.scripts).filter((id) => Number(id) >= 10000).length,
    371,
  );
  for (const s of Object.values(data.scripts))
    for (const t of s.instructions) {
      if (t.op === 101)
        assert.ok(data.scripts[t.args[0]], `jump ${s.id} -> ${t.args[0]}`);
      if (t.text) assert.ok(!t.text.includes("�"));
    }
  for (const group of [
    data.backgrounds,
    data.music,
    data.effects,
    data.ambient,
    data.loops,
    data.secondary,
    data.sprites,
    data.logic.assets,
  ])
    for (const file of Object.values(group))
      assert.ok(
        existsSync(
          `public/game/${typeof file === "string" ? file : file.file}`,
        ),
      );
  assert.equal(data.logic.fields.length, 16);
});
const token = (op, args = []) => ({ op, args, offset: 100, length: 4 });
const fixture = (tokens) => ({
  ...data,
  entry: 99,
  scripts: { 99: { id: 99, offset: 100, size: 100, instructions: tokens } },
});
test("arithmetic, signed bytes, comparison and copy follow the original VM", () => {
  const d = fixture([
    token(802, [32767, 0]),
    token(802, [1, 256]),
    token(802, [255, 11]),
    token(806, [11 | (2 << 8)]),
    token(804, [2]),
    token(2),
  ]);
  const s = run(d, createState(d));
  assert.equal(s.mode, "ended");
  assert.equal(readVariable(s, 0), 32767);
  assert.equal(readVariable(s, 11), -1);
  assert.equal(readVariable(s, 2), -1);
  assert.equal(s.result, 1);
  for (const [a, b, m, r, yes] of [
    [1, 2, 0, 0, true],
    [2, 2, 1, 0, true],
    [2, 2, 2, 0, true],
    [2, 2, 3, 0, true],
    [3, 2, 4, 0, true],
    [4, 2, 5, 2, true],
    [5, 2, 6, 2, true],
    [3, 2, 7, 0, true],
    [2, 2, 8, 0, true],
    [0, 1, 9, 0, true],
    [2, 2, 10, 0, false],
  ])
    assert.equal(compare(a, b, m, r), yes);
  assert.throws(() => compare(1, 2, 999));
});
test("courage costs, disabled options and manual reasoning return preserve progress", () => {
  const d = fixture([token(2)]);
  const initial = {
    ...createState(d),
    mode: "choice",
    variables: { 8: 2 },
    choices: [
      { text: "a", flag: 0, cost: 2, disabled: false },
      { text: "b", flag: 0, cost: 3, disabled: false },
      { text: "c", flag: 0, cost: 0, disabled: true },
    ],
  };
  assert.throws(() => choose(d, initial, 1));
  assert.throws(() => choose(d, initial, 2));
  assert.throws(() => choose(d, initial, -1));
  assert.equal(readVariable(choose(d, initial, 0), 8), 0);
  assert.equal(initial.variables[8], 2);
  const page = { ...createState(data), mode: "page", logicAvailable: true };
  const opened = openLogic(page);
  assert.equal(opened.mode, "logic");
  assert.deepEqual(finishLogic(data, opened), { ...page, logicReturn: "page" });
});
test("100 deterministic branch traversals exercise every encountered alternative without interpreter errors", () => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const seen = new Set(),
    pages = new Set(),
    scripts = new Set();
  let alternatives = 0;
  const observed = {
    ...data,
    scripts: new Proxy(data.scripts, {
      get(target, key) {
        if (target[key]) {
          scripts.add(Number(key));
          chapterCoverage.add(Number(key));
        }
        return target[key];
      },
    }),
  };
  for (let trial = 0; trial < 100; trial++) {
    let s = run(observed, { ...createState(data), script: 10001 }),
      steps = 0;
    while (s.mode !== "ended" && steps++ < 16000) {
      assert.notEqual(s.mode, "error", s.error);
      s.history = [];
      if (s.mode === "page") {
        pages.add(s.page.id);
        s = advance(observed, s);
      } else if (s.mode === "choice") {
        const choices = s.choices
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.disabled && c.cost <= readVariable(s, 8));
        assert.ok(choices.length);
        const key = `${s.script}:${s.pc}`;
        if (!seen.has(key)) {
          seen.add(key);
          for (const { i } of choices) {
            const branch = choose(observed, s, i);
            assert.notEqual(branch.mode, "error", branch.error);
            alternatives++;
          }
        }
        s = choose(
          observed,
          s,
          choices[Math.floor(random() * choices.length)].i,
        );
      } else if (s.mode === "logic") {
        for (const f of data.logic.fields.filter((f) => logicCondition(s, f))) {
          const candidates = f.choices.filter(
            (c) => c.id === 0 || s.flags.includes(c.id),
          );
          s = setAnswer(
            data,
            s,
            f.id,
            candidates[Math.floor(random() * candidates.length)].id,
          );
        }
        s = finishLogic(observed, s);
      } else if (s.mode === "confirm") s = confirmResult(observed, s, true);
      else assert.fail(s.mode);
    }
    assert.equal(s.mode, "ended");
  }
  assert.equal(seen.size, 159);
  assert.ok(pages.size >= 4000);
  assert.ok(scripts.size >= 340);
  const missing = Object.keys(data.scripts)
    .map(Number)
    .filter((id) => id >= 10000 && !chapterCoverage.has(id));
  assert.deepEqual(missing, [], `Unvisited scripts: ${missing}`);
  console.log(
    `Branch audit: ${scripts.size} executed scripts, ${pages.size} pages, ${seen.size} choices, ${alternatives} alternatives`,
  );
});

test("dictionary name placeholders are native Unicode templates", () => {
  assert.ok(data.definitions[17].includes("{surname}"));
  assert.ok(!data.definitions[17].includes("％"));
  assert.equal(
    formatGameText("{surname}{givenName}，你好", ["林", "小雨"]),
    "林小雨，你好",
  );
  assert.ok(
    formatGameText(data.definitions[17], ["林", "小雨"]).includes("对林说"),
  );
});
