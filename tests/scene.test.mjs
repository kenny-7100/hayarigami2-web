import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backgroundGeometry } from "../src/game/scene.ts";
import { createState, run, validateSave } from "../src/game/engine.ts";
import { sceneFixtures } from "./scene-fixtures.mjs";
const data = JSON.parse(readFileSync("public/game/game.json"));
const fixtures = sceneFixtures(data);
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
});
