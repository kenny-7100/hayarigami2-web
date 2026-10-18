import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { sampleAnimation, animationTime } from "../src/game/animation.ts";
import { createState, run, validateSave } from "../src/game/engine.ts";
const data = JSON.parse(readFileSync("public/game/game.json"));
test("every referenced animation variant has converted atlases and finite sampled geometry", () => {
  const variants = new Set(
    Object.values(data.scripts).flatMap((s) =>
      s.instructions
        .filter((t) => t.op === 2403)
        .map((t) => t.args.slice(0, 2).join(":")),
    ),
  );
  for (const key of variants) {
    const [id, v] = key.split(":").map(Number);
    const a = data.animationData[id];
    assert.ok(a?.variants[v], key);
    for (const texture of Object.values(a.textures)) {
      assert.ok(existsSync(`public/game/${texture.file}`));
      const bytes = readFileSync(`public/game/${texture.file}`);
      assert.equal(bytes.readUInt32BE(16), texture.width);
      assert.equal(bytes.readUInt32BE(20), texture.height);
    }
    for (const time of [0, 15, 60, 150, 300, 3001])
      for (const d of sampleAnimation(a, v, time)) {
        assert.ok(d.texture.file);
        assert.ok(!/NaN|Infinity/.test(d.transform), key);
        assert.ok(d.opacity >= 0 && d.opacity <= 1);
      }
  }
  assert.equal(variants.size, 38);
});
test("formerly blank rain, tunnel, daytime drive and CCTV resolve source scene artwork", () => {
  for (const [id, variant] of [
    [200, 2],
    [600, 1],
    [1000, 1],
    [700, 10],
  ]) {
    for (const time of [0, 60, 180]) {
      const draws = sampleAnimation(data.animationData[id], variant, time);
      assert.ok(
        draws.some(
          (d) => d.opacity > 0 && d.cell.width >= 240 && d.cell.height >= 168,
        ),
        `${id}:${variant}@${time}`,
      );
    }
  }
});
test("source subanimations actually change over time while their parent holds frame zero", () => {
  for (const [id, variant] of [
    [200, 2],
    [600, 1],
    [1000, 1],
    [700, 11],
    [8, 1],
  ]) {
    assert.notDeepEqual(
      sampleAnimation(data.animationData[id], variant, 0),
      sampleAnimation(data.animationData[id], variant, 37),
      `${id}:${variant}`,
    );
  }
});
test("timeline honors loop-back and terminal hold markers", () => {
  assert.equal(
    animationTime(
      [
        [0, 1],
        [60, 2],
      ],
      75,
    ).time,
    15,
  );
  assert.equal(
    animationTime(
      [
        [0, 0],
        [20, 1],
        [80, 2],
      ],
      95,
    ).time,
    35,
  );
  assert.deepEqual(
    animationTime(
      [
        [0, 5],
        [3000, 5],
      ],
      123,
    ),
    { time: 0, clock: 123 },
  );
  assert.equal(
    animationTime(
      [
        [0, 0],
        [300, 5],
      ],
      600,
    ).time,
    300,
  );
});
test("animation clock survives saves and legacy saves remain readable", () => {
  let s = run(data, { ...createState(data), script: 10701 });
  assert.notEqual(s.mode, "error", s.error);
  assert.ok(s.animations[0].startedAt >= 0);
  assert.deepEqual(validateSave(data, JSON.parse(JSON.stringify(s))), s);
  assert.throws(() =>
    validateSave(data, {
      ...s,
      animations: { 0: { ...s.animations[0], startedAt: Infinity } },
    }),
  );
  delete s.animations[0].startedAt;
  validateSave(data, s);
});
