import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backgroundGeometry, readingLayers } from "../src/game/scene.ts";
import { createState, run, advance, validateSave } from "../src/game/engine.ts";
import { sceneFixtures } from "./scene-fixtures.mjs";
const data = JSON.parse(readFileSync("public/game/game.json"));
const fixtures = sceneFixtures(data);
test("chapter-zero exterior survives in-block preload without changing the next scene or old saves", () => {
  let s = run(data, { ...createState(data), script: 10001 });
  for (let i = 0; i < 14; i++) s = advance(data, s);
  assert.equal(s.page.id, "10201:67532");
  assert.equal(s.pc, 57);
  assert.equal(s.layers[0].asset, 105);
  assert.equal(s.layers[0].alpha, 0);
  const displayed = readingLayers(data, s)[0];
  assert.deepEqual(displayed, { asset: 100, alpha: 1, x: 0, y: -320 });
  coversScene(backgroundGeometry(data, displayed));
  const restored = validateSave(data, JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored, s);
  const legacy = structuredClone(s);
  delete legacy.readingLayers;
  const legacyRestored = validateSave(data, legacy);
  assert.deepEqual(readingLayers(data, legacyRestored), s.readingLayers);
  assert.deepEqual(legacyRestored.layers, s.layers);
  const next = advance(data, restored);
  assert.equal(next.page.id, "10201:67764");
  assert.equal(next.readingLayers, undefined);
  assert.equal(readingLayers(data, next)[0].asset, 105);
  assert.equal(readingLayers(data, next)[0].alpha, 1);
  assert.equal(readingLayers(data, next)[0].y, -380);
  assert.deepEqual(advance(data, legacyRestored), next);
  restored.readingLayers[0].asset = -1;
  assert.throws(() => validateSave(data, restored), /阅读画面/);
});
function coversScene(g) {
  assert.ok(
    g.left <= 0 && g.top <= 0 && g.right >= 480 && g.bottom >= 272,
    `Background must cover camera viewport: ${JSON.stringify(g)}`,
  );
}
test("compiled native background dimensions match all PNG headers", () => {
  assert.equal(
    Object.keys(data.backgroundTextures).length,
    Object.keys(data.backgrounds).length,
  );
  for (const [id, texture] of Object.entries(data.backgroundTextures)) {
    assert.equal(texture.file, data.backgrounds[id]);
    const png = readFileSync(`public/game/${texture.file}`);
    assert.equal(texture.width, png.readUInt32BE(16));
    assert.equal(texture.height, png.readUInt32BE(20));
  }
});
test("chapter-one falling pole keeps its image until advancing into the source impact blackout", () => {
  const s = run(data, { ...createState(data), script: 20756, pc: 465 });
  assert.equal(s.page.id, "20756:1627476");
  assert.equal(s.layers[1].asset, 1299);
  assert.equal(s.layers[1].alpha, 0);
  assert.deepEqual(readingLayers(data, s)[1], { asset: 1298, alpha: 0.625 });
  const next = advance(data, validateSave(data, JSON.parse(JSON.stringify(s))));
  assert.equal(next.page.id, "20756:1627756");
  assert.equal(next.readingLayers, undefined);
  assert.equal(readingLayers(data, next)[1].alpha, 0);
});
test("actual tall panorama remains on screen after a -380px camera move", () => {
  const layer = fixtures.panorama.layers[0];
  assert.equal(layer.asset, 105);
  assert.equal(layer.y, -380);
  const g = backgroundGeometry(data, layer);
  assert.equal(g.height, 664);
  coversScene(g);
  assert.deepEqual(
    backgroundGeometry(
      data,
      validateSave(data, JSON.parse(JSON.stringify(fixtures.panorama)))
        .layers[0],
    ),
    g,
  );
});
test("actual office pan and shelf zoom fill the viewport without fitting each layer first", () => {
  const office = backgroundGeometry(data, fixtures.office.layers[0]);
  assert.equal(office.width, 608);
  assert.equal(office.left, -120);
  coversScene(office);
  const shelves = backgroundGeometry(data, fixtures.shelves.layers[1]);
  assert.equal(shelves.width, 480);
  assert.equal(shelves.height, 280);
  coversScene(shelves);
});
test("chapter-one mirrored background uses signed dimensions, including pre-fix saves", () => {
  const s = run(data, {
    ...createState(data),
    script: 20756,
    pc: 1065,
    layers: { 3: { asset: 195, alpha: 1 } },
  });
  assert.notEqual(s.mode, "error", s.error);
  assert.equal(s.layers[3].width, -640);
  assert.equal(s.layers[3].height, -440);
  const g = backgroundGeometry(data, s.layers[3]);
  coversScene(g);
  assert.equal(g.transform, "translate(640 440) scale(-1 -1)");
  assert.deepEqual(
    backgroundGeometry(data, { ...s.layers[3], width: 64896, height: 65096 }),
    g,
  );
});
test("reported dark narration is explicitly cleared by source and has no active animation", () => {
  const s = fixtures.dark;
  assert.ok(Object.values(s.layers).every((l) => l.alpha === 0));
  assert.ok(Object.values(s.sprites).every((l) => l.alpha === 0));
  assert.equal(
    Object.values(s.animations).filter((a) => a.alpha > 0).length,
    0,
  );
  assert.match(s.page.text, /不存在的事/);
  const code = data.scripts[10201].instructions;
  assert.deepEqual(code[215].args, [32896, 128, 0, 2]);
  assert.equal(code[215].op, 403);
  assert.equal(s.readingLayers, undefined);
  assert.equal(readingLayers(data, s), s.layers);
});
