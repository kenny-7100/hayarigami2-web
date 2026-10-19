import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { sampleAnimation, sampleSceneAnimation, animationTime, animationScale, animationPosition } from "../src/game/animation.ts";
import { createState, run, advance, validateSave } from "../src/game/engine.ts";
const data = JSON.parse(readFileSync("public/game/game.json"));
test("native screen-coordinate animations are not scaled down twice", () => {
  for (const id of [500, 5600, 6000, 6100, 6200, 6300, 6400]) assert.deepEqual(animationScale(id), [1, 1]);
  for (const id of [100, 200, 600, 700, 1000]) assert.deepEqual(animationScale(id), [0.75, 272 / 448]);
  assert.deepEqual(animationPosition(5600, 114, 0), [152, 0]);
  assert.deepEqual(animationPosition(100, 114, 0), [114, 0]);
});
test("script 38401 preserves position and color configured before animation start", () => {
  let s = run(data, { ...createState(data), script: 38401 });
  s = advance(data, advance(data, s));
  assert.equal(s.page.id, "38401:2045212");
  assert.equal(s.animations[0].x, 114);
  assert.equal(s.animations[0].z, 13000);
  assert.deepEqual(s.animations[0].color, [128, 128, 128, 128]);
  assert.deepEqual(validateSave(data, JSON.parse(JSON.stringify(s))), s);
  for (const bad of [{ color: [128, 128, 128, 256] }, { x: Infinity }]) {
    const copy = structuredClone(s);
    Object.assign(copy.animationSettings[0], bad);
    assert.throws(() => validateSave(data, copy), /动画设置/);
  }
  const next = advance(data, s);
  assert.equal(next.animations[1].x, 114);
  assert.equal(next.animationSettings[0], undefined);
});
test("opening sky follows story time while lamp loops keep moving", () => {
  const s = run(data, createState(data));
  const a = s.animations[0];
  const draws = elapsed => sampleSceneAnimation(data.animationData[100], a, s.frames, elapsed);
  const sky = list => list.filter(d => d.texture.file === "animation-100-2-2.png");
  assert.deepEqual(sky(draws(0)), sky(draws(10000)));
  assert.notDeepEqual(sky(draws(0)), sky(sampleSceneAnimation(data.animationData[100], a, s.frames + 420, 0)));
  assert.notDeepEqual(draws(0), draws(37));
});
test("full-scene fades wait for reading and credit-card progress", () => {
  for (const [id, variant, age] of [[300, 2, 240], [300, 1, 120], [6100, 500, 264], [6200, 500, 264], [1400, 10, 60]]) {
    const a = data.animationData[id];
    const playback = { id, variant, startedAt: 0 };
    // Parent effects must not reach their black terminal frame just because
    // the reader takes longer. Independent looping children may still move.
    const atStart = sampleSceneAnimation(a, playback, age, 0);
    const later = sampleSceneAnimation(a, playback, age, 12000);
    const curtain = d => d.cell.width <= 32 && d.cell.height <= 32 && d.cell.blend === 0;
    assert.deepEqual(later.filter(curtain), atStart.filter(curtain), `${id}:${variant}`);
    assert.ok(later.some(d => d.opacity > 0));
  }
});
test("native per-vertex color products saturate before alpha normalization", () => {
  const a = data.animationData[100];
  const glow = sampleAnimation(a, 1, 0).find(d => d.cell.width === 64 && d.cell.height === 64 && !d.cell.flipX);
  assert.deepEqual(glow.colors, a.colors[4]);
  assert.equal(glow.opacity, 192 / 255);
  const child = sampleAnimation(a, 1, 1500).find(d => d.texture.file === "animation-100-0-0.png");
  assert.deepEqual(child.colors, a.colors[2]);
});
test("car movement at the 100-frame loop is present in source, not an added shake", () => {
  const a = data.animationData[100];
  const car = time => sampleAnimation(a, 5, time).find(d => d.texture.file === "animation-100-0-0.png").transform;
  assert.equal(car(0), car(100));
  assert.equal(car(6), car(99));
  assert.match(car(0), /translate\(0 3\)/);
  assert.match(car(6), /translate\(0 0\)/);
});
test("slow reading keeps the opening car visible while its child animation moves", () => {
  const s = run(data, createState(data));
  assert.equal(s.page.id, "1:55172");
  const playback = s.animations[0];
  const animation = data.animationData[playback.id];
  const start = sampleSceneAnimation(animation, playback, s.frames, 0);
  const later = sampleSceneAnimation(animation, playback, s.frames, 6000);
  const curtain = draws => draws.filter(d => d.texture.file === "animation-100-5-3.png" && d.cell.width === 16 && d.transform.includes("scale(40 30)"));
  assert.equal(curtain(start).length, 0);
  assert.equal(curtain(later).length, 0);
  assert.notDeepEqual(start, later);
  assert.ok(later.some(d => d.texture.file === "animation-100-0-0.png" && d.opacity === 1));
  // Source intentionally fades to black before the Friend of a Friend card.
  const end = sampleSceneAnimation(animation, playback, 2890, 0);
  assert.ok(curtain(end).some(d => d.opacity === 1));
  const ordinary = { id: 200, variant: 2, startedAt: 30 };
  assert.deepEqual(sampleSceneAnimation(data.animationData[200], ordinary, 60, 90),
    sampleAnimation(data.animationData[200], 2, 120));
});
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
