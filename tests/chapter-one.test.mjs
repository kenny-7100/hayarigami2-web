import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  oneData as data,
  walkOne,
  chapterOneCoverage,
} from "./chapter-one-walk.mjs";
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
  validateSave,
  enterChapter,
  submitName,
} from "../src/game/engine.ts";
for (const route of ["science", "occult"])
  test(`chapter one ${route}: complete story, correct reasoning, full-history save restoration`, () => {
    let waits = 0,
      logic,
      confirmation;
    const { state, visited, steps } = walkOne(route, {
      inspect: (s) => {
        waits++;
        if (s.mode === "logic") logic = s;
        if (s.mode === "confirm") confirmation = s;
        const restored = validateSave(data, JSON.parse(JSON.stringify(s)));
        assert.deepEqual(restored, s);
        if (waits % 100 === 0 && s.mode === "page")
          assert.deepEqual(advance(data, restored), advance(data, s));
      },
    });
    assert.equal(state.script, 29000);
    assert.ok(visited.has(route === "science" ? 22406 : 20956));
    assert.equal(state.variables[1], 0);
    assert.equal(state.variables[10], route === "science" ? 74 : 86);
    assert.ok(state.flags.includes(route === "science" ? 755 : 756));
    assert.ok(state.history.length > 3300);
    assert.deepEqual(
      validateSave(data, JSON.parse(JSON.stringify(state))),
      state,
    );
    assert.ok(logic && confirmation);
    const back = confirmResult(data, confirmation, false);
    assert.equal(back.mode, "logic");
    assert.deepEqual(back.answers, confirmation.answers);
    validateSave(data, back);
    const blank = { ...logic, answers: {} };
    let missing = finishLogic(data, blank);
    assert.equal(missing.mode, "page");
    assert.match(missing.page.text, /空白/);
    validateSave(data, missing);
    missing = advance(data, missing);
    assert.equal(missing.mode, "logic");
    assert.throws(() => setAnswer(data, logic, 99, 4700));
    assert.throws(() => setAnswer(data, logic, 0, 4600));
    console.log(
      `Chapter one ${route}: ${steps} waits, ${state.history.length} pages, score ${state.variables[10]}`,
    );
  });
for (const route of ["science", "occult"])
  test(`chapter one ${route}: incorrect reasoning reaches failure ending`, () => {
    const { state, visited } = walkOne(route, {
      bad: true,
      fullHistory: false,
    });
    assert.equal(state.script, 29998);
    assert.ok(state.variables[1] >= 7);
    assert.ok(!visited.has(29000));
  });
test("chapter transition preserves player progress and isolates scene/logic state; legacy chapter-zero saves remain readable", () => {
  let previous = run(data, { ...createState(data), script: 10001 });
  previous.names = ["林", "小雨"];
  previous.unlocked = [1];
  previous.flags.push(2401);
  previous.variables[11] = 87;
  previous.answers = { 0: 4620 };
  previous.logicId = 2;
  const next = enterChapter(data, previous, 20001);
  assert.equal(next.logicId, 3);
  assert.deepEqual(next.answers, {});
  assert.deepEqual(next.names, previous.names);
  assert.ok(next.flags.includes(2401));
  assert.equal(next.variables[11], 87);
  assert.equal(next.variables[8], 7);
  assert.deepEqual(next.unlocked, [1]);
  assert.equal(getLogic(data, next).fields.length, 20);
  validateSave(data, next);
  assert.equal(getLogic(data, previous).fields.length, 16);
  validateSave(data, previous);
  assert.throws(() => validateSave(data, { ...next, answers: { 0: 4620 } }));
  assert.throws(() => validateSave(data, { ...next, logicId: 999 }));
  const legacy = run(data, createState(data));
  for (const k of [
    "variables",
    "answers",
    "logicId",
    "audioEvents",
    "animations",
    "stageEffect",
  ])
    delete legacy[k];
  const migrated = validateSave(data, legacy);
  assert.deepEqual(migrated.variables, {});
  assert.equal(migrated.logicId, null);
});
test("chapter-one text stays Japanese where untranslated; authored Chinese opening/keywords retained; every resource exists", () => {
  const standalone = JSON.parse(readFileSync("public/game/chapter-one.json"));
  assert.equal(Object.keys(standalone.scripts).length, 457);
  assert.equal(standalone.scripts[20201].language, "ja");
  assert.equal(standalone.scripts[20101].language, "zh-CN");
  assert.ok(
    standalone.scripts[20201].instructions.some(
      (t) => t.text === "小暮さんがふと呟いた一言を、",
    ),
  );
  assert.match(standalone.definitions[42], /記憶/);
  assert.match(standalone.logic.descriptions[13], /『鬼』/);
  assert.equal(standalone.keywords[4721], "孪生");
  for (const s of Object.values(standalone.scripts))
    for (const t of s.instructions) {
      if (t.op === 101) assert.ok(standalone.scripts[t.args[0]]);
      if (t.text) assert.ok(!t.text.includes("�"));
    }
  for (const group of [
    standalone.backgrounds,
    standalone.sprites,
    standalone.music,
    standalone.effects,
    standalone.ambient,
    standalone.loops,
    standalone.secondary,
    standalone.logic.assets,
  ])
    for (const value of Object.values(group))
      assert.ok(
        existsSync(
          `public/game/${typeof value === "string" ? value : value.file}`,
        ),
      );
  assert.deepEqual(standalone.silentEffects, [70, 72, 91]);
});
test("chapter-one deterministic branch coverage: all 457 records, 202 reachable choices, one verified dead source choice", () => {
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const seen = new Set(),
    pages = new Set(),
    testedOptions = new Set();
  let alternatives = 0;
  const checkChoices = (s) => {
    const key = `${s.script}:${s.pc}`;
    seen.add(key);
    for (let i = 0; i < s.choices.length; i++) {
      const c = s.choices[i],
        optionKey = `${key}:${i}`;
      if (
        !c.disabled &&
        c.cost <= readVariable(s, 8) &&
        !testedOptions.has(optionKey)
      ) {
        testedOptions.add(optionKey);
        const branch = choose(data, s, i);
        assert.notEqual(branch.mode, "error", branch.error);
        alternatives++;
      }
    }
  };
  // Include choices on both success routes in the coverage set.
  for (const route of ["science", "occult"])
    walkOne(route, {
      fullHistory: false,
      inspect: (s) => {
        if (s.mode === "choice") checkChoices(s);
      },
    });
  for (let trial = 0; trial < 100; trial++) {
    let s = run(data, { ...createState(data), script: 20001 }),
      steps = 0;
    while (s.mode !== "ended" && steps++ < 18000) {
      assert.notEqual(s.mode, "error", s.error);
      s.history = [];
      if (s.mode === "page") {
        pages.add(s.page.id);
        s = advance(data, s);
      } else if (s.mode === "choice") {
        const options = s.choices
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.disabled && c.cost <= readVariable(s, 8));
        assert.ok(options.length);
        checkChoices(s);
        s = choose(data, s, options[Math.floor(random() * options.length)].i);
      } else if (s.mode === "logic") {
        for (const f of getLogic(data, s).fields.filter((f) =>
          logicCondition(s, f),
        )) {
          const candidates = f.choices.filter(
            (c) => c.id && s.flags.includes(c.id),
          );
          if (candidates.length)
            s = setAnswer(
              data,
              s,
              f.id,
              candidates[Math.floor(random() * candidates.length)].id,
            );
        }
        s = finishLogic(data, s);
      } else if (s.mode === "confirm") s = confirmResult(data, s, true);
      else assert.fail(s.mode);
    }
    assert.equal(s.mode, "ended");
  }
  const missing = Object.keys(data.scripts)
    .map(Number)
    .filter((id) => id >= 20000 && id < 30000 && !chapterOneCoverage.has(id));
  assert.deepEqual(missing, []);
  const missingChoices = Object.values(data.scripts)
    .filter((s) => s.id >= 20000 && s.id < 30000)
    .flatMap((s) =>
      s.instructions.flatMap((t, i) =>
        t.op === 103 && !seen.has(`${s.id}:${i + 1}`)
          ? [`${s.id}:${i + 1}`]
          : [],
      ),
    );
  assert.deepEqual(missingChoices, ["27220:96"]);
  // This source choice is dead code after an unconditional jump, not a missing Web branch.
  const dead = data.scripts[27220].instructions;
  assert.equal(dead[72].op, 101);
  assert.equal(dead[72].args[0], 27221);
  assert.ok(!dead.slice(0, 72).some((t) => [106, 108, 114].includes(t.op)));
  assert.equal(seen.size, 202);
  assert.equal(testedOptions.size, 470);
  assert.ok(pages.size >= 5000);
  console.log(
    `Chapter one coverage: 457 records, ${seen.size} choices, ${pages.size} pages, ${alternatives} available alternatives`,
  );
});

test("merged production data executes the complete prologue including shared sprites and audio", () => {
  let state = run(data, createState(data)),
    steps = 0;
  while (state.mode !== "ended" && steps++ < 300) {
    assert.notEqual(state.mode, "error", state.error);
    validateSave(data, state);
    state =
      state.mode === "input"
        ? submitName(data, state, state.input.field === 0 ? "林" : "小雨")
        : advance(data, state);
  }
  assert.equal(state.mode, "ended");
  assert.equal(state.script, 3);
  assert.ok(state.history.some((p) => p.text.includes("林小雨")));
  const zero = enterChapter(data, state, 10001);
  assert.equal(zero.logicId, 2);
  validateSave(data, zero);
});
