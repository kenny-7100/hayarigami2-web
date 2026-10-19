import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { advance, choose, createState, run, readVariable } from "../src/game/engine.ts";
import { sceneMedia, upcomingMedia } from "../src/game/media-plan.ts";
const data = JSON.parse(readFileSync("public/game/game.json"));

test("preloading includes the complete car atlas and music without changing progress", () => {
  const state = run(data, createState(data));
  const original = structuredClone(state);
  const media = upcomingMedia(data, state);
  for (const texture of Object.values(data.animationData[100].textures))
    assert.ok(media.some(m => m.file === texture.file && m.kind === "image"));
  assert.ok(media.some(m => m.file === data.music[state.music] && m.kind === "audio"));
  let next = state;
  for (let i = 0; i < 4; i++) {
    next = advance(data, next);
    for (const file of sceneMedia(data, next)) assert.ok(media.some(m => m.file === file.file));
  }
  assert.deepEqual(state, original);
  assert.equal(new Set(media.map(m => m.file)).size, media.length);
});

test("choice prefetch covers legal alternatives without selecting, spending courage, or changing RNG", () => {
  let state = run(data, { ...createState(data), script: 10001 });
  for (let i = 0; i < 500 && state.mode === "page"; i++) state = advance(data, state);
  assert.equal(state.mode, "choice");
  const original = structuredClone(state);
  const files = new Set(upcomingMedia(data, state).map(m => m.file));
  state.choices.forEach((choice, i) => {
    if (choice.disabled || choice.cost > readVariable(state, 8)) return;
    for (const media of sceneMedia(data, choose(data, state, i))) assert.ok(files.has(media.file));
  });
  assert.deepEqual(state, original);
});

test("required media uses the displayed background, and includes every sound channel and logic texture", () => {
  const state = createState(data);
  const background = Number(Object.keys(data.backgrounds)[0]);
  state.mode = "page";
  state.readingLayers = { 0: { asset: background, alpha: 1 } };
  state.layers = {};
  for (const [field, catalog] of [["music", "music"], ["loopSound", "loops"], ["secondaryMusic", "secondary"]])
    state[field] = Number(Object.keys(data[catalog])[0]);
  state.audioEvents = ["effects", "ambient"].map(kind => ({ kind, id: Number(Object.keys(data[kind])[0]), volume: 1, delay: 1 }));
  state.logicVisible = true;
  state.logicId = Number(Object.keys(data.logics)[0]);
  const files = new Set(sceneMedia(data, state).map(m => m.file));
  assert.ok(files.has(data.backgrounds[background]));
  assert.ok(files.has(data.music[state.music]));
  assert.ok(files.has(data.loops[state.loopSound]));
  assert.ok(files.has(data.secondary[state.secondaryMusic]));
  for (const event of state.audioEvents) assert.ok(files.has(data[event.kind][event.id]));
  for (const texture of Object.values(data.logics[state.logicId].assets)) assert.ok(files.has(texture.file));
});
