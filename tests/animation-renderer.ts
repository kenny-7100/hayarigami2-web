import { createAnimationRenderer } from "../src/game/animation-renderer";
import { sampleAnimation, sampleSceneAnimation } from "../src/game/animation";
import type { AnimationData, AnimationDraw } from "../src/game/animation";
import type { GameData } from "../src/game/engine";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const result = document.querySelector("#result")!;
const gallery = document.querySelector("#gallery")!;
const report: unknown[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
function pixels() {
  const gl = canvas.getContext("webgl")!;
  const bytes = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  assert(gl.getError() === gl.NO_ERROR, "WebGL error");
  return bytes;
}
async function run() {
  const data: GameData = await (await fetch("/game/game.json")).json();
  const synthetic: AnimationData = {
    variants: {}, nodes: [], frames: [], transforms: [], colors: [], commands: [], cells: [],
    textures: { white: { file: "../tests/animation-white.svg", width: 4, height: 4 } },
  };
  const renderer = await createAnimationRenderer(canvas, synthetic);
  const quad = (rgba: number[], blend = 0): AnimationDraw => ({
    cell: { texture: "white", u: 0, v: 0, width: 4, height: 4, flipX: false, flipY: false, blend },
    texture: synthetic.textures.white, transform: "scale(160 112)", x: 0, y: 0, opacity: 1, colors: rgba,
  });
  const solid = (c: number[]) => Array.from({ length: 4 }, () => c).flat();
  const center = () => [...pixels().slice((136 * 480 + 240) * 4, (136 * 480 + 240) * 4 + 4)];
  const near = (actual: number[], expected: number[]) => assert(actual.every((n, i) => Math.abs(n - expected[i]) <= 2), `${actual} != ${expected}`);
  renderer.draw([quad(solid([64, 32, 16, 255]))]);
  near(center(), [128, 64, 32, 255]);
  renderer.draw([quad(solid([50, 50, 50, 255])), quad(solid([40, 20, 10, 128]), 512)]);
  near(center(), [140, 120, 110, 255]);
  renderer.draw([quad(solid([50, 50, 50, 255])), quad(solid([40, 20, 10, 128]), 768)]);
  near(center(), [60, 80, 90, 255]);
  renderer.draw([quad([255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 0, 255, 255, 255, 255])]);
  const bytes = pixels();
  assert(bytes[(135 * 480 + 5) * 4 + 3] > 240 && bytes[(135 * 480 + 475) * 4 + 3] < 10, "Vertex alpha was flattened");
  renderer.dispose();
  report.push({ pixelTests: 4, passed: true });
  const refs = new Set(Object.values(data.scripts).flatMap(s => s.instructions.filter(t => t.op === 2403).map(t => t.args!.slice(0, 2).join(":"))));
  for (const ref of refs) {
    const [id, variant] = ref.split(":").map(Number);
    const animation = data.animationData![id];
    const r = await createAnimationRenderer(canvas, animation, id);
    const samples = [];
    for (const time of [0, 37, 150, 540, 1500, 3001]) {
      const draws = sampleAnimation(animation, variant, time);
      r.draw(draws);
      const p = pixels();
      let visible = 0;
      for (let i = 0; i < p.length; i += 4) if (p[i] + p[i + 1] + p[i + 2] > 12 && p[i + 3] > 0) visible++;
      samples.push({ time, draws: draws.length, visible });
      if (time === 150) {
        const section = document.createElement("section");
        const label = document.createElement("div"); label.textContent = ref;
        const image = new Image(); image.src = canvas.toDataURL();
        section.append(label, image); gallery.append(section);
      }
    }
    report.push({ ref, samples });
    r.dispose();
  }
  for (const [id, variant, age] of [[100, 1, 540], [300, 2, 240], [300, 1, 120], [6100, 500, 264], [6200, 500, 264], [1400, 10, 60]]) {
    const animation = data.animationData![id];
    const r = await createAnimationRenderer(canvas, animation, id);
    const counts: number[] = [];
    for (const elapsed of [0, 12000]) {
      r.draw(sampleSceneAnimation(animation, { id, variant, startedAt: 0 }, age, elapsed));
      const p = pixels();
      let visible = 0;
      for (let i = 0; i < p.length; i += 4) if (p[i] + p[i + 1] + p[i + 2] > 12) visible++;
      counts.push(visible);
    }
    assert(counts[0] > 1000 && counts[1] > counts[0] * 0.5, `Reading faded to black: ${id}:${variant} ${counts}`);
    report.push({ reading: `${id}:${variant}`, age, counts });
    r.dispose();
  }
  result.textContent = JSON.stringify({ passed: true, report }, null, 2);
}
void run().catch(e => { result.textContent = JSON.stringify({ passed: false, error: String(e), report }); });
