export type AnimationData = {
  variants: Record<string, { start: number; end: number }>;
  nodes: number[][];
  frames: number[][];
  transforms: number[][];
  colors: number[][];
  commands: number[];
  cells: (null | {
    texture: string;
    u: number;
    v: number;
    width: number;
    height: number;
    flipX: boolean;
    flipY: boolean;
    blend: number;
  })[];
  textures: Record<string, { file: string; width: number; height: number }>;
};
export type AnimationDraw = {
  cell: NonNullable<AnimationData["cells"][number]>;
  texture: AnimationData["textures"][string];
  transform: string;
  opacity: number;
  colors: number[];
  x: number;
  y: number;
};
// 0881581c-08815888 selects native screen coordinates for these assets;
// 08860c70/08862c90 bypasses the usual 640x448 conversion.
export function animationScale(id: number): [number, number] {
  return [500, 5600, 6000, 6100, 6200, 6300, 6400].includes(id)
    ? [1, 1] : [480 / 640, 272 / 448];
}
export function animationPosition(id: number, x: number, y: number): [number, number] {
  const scale = animationScale(id);
  return [Math.trunc(Math.trunc(x * 640 / 480) * scale[0]),
    Math.trunc(Math.trunc(y * 448 / 272) * scale[1])];
}
// These full-scene cinematics end in authored fades. Reading pages and credit
// cards advance their story clock; ambient/particle animations keep real time.
export function storyAnimation(playback: { id: number; variant: number }) {
  return [100, 1700, 300, 400, 6000, 6100, 6200, 6300, 6400].includes(playback.id) ||
    (playback.id === 1400 && playback.variant === 10);
}
// Control keys: 1 loop start, 2/3 loop back, 4/5 hold. Child animations have
// independent clocks, including when their parent is held on frame zero.
export function animationTime(frames: number[][], elapsed: number) {
  let start = 0;
  for (const frame of frames) {
    const [time, flags] = frame;
    const mode = flags & 255;
    if (mode === 1) start = time;
    if ((mode === 2 || mode === 3) && elapsed >= time && time > start)
      return {
        time: start + ((elapsed - start) % (time - start)),
        clock: start + ((elapsed - start) % (time - start)),
      };
    if ((mode === 4 || mode === 5) && elapsed >= time)
      return { time, clock: elapsed };
  }
  return { time: elapsed, clock: elapsed };
}
export function sampleAnimation(
  data: AnimationData,
  variant: number,
  elapsed: number,
  rootTime?: number,
  tint: number[] = [128, 128, 128, 128],
): AnimationDraw[] {
  const output: AnimationDraw[] = [];
  const framesOf = (node: number[]) =>
    data.frames.slice(node[1], node[1] + node[2]);
  function visitVariant(
    id: number,
    ticks: number,
    parent: string,
    parentColors: number[],
    stack: number[],
    storyTicks?: number,
  ) {
    const v = data.variants[id];
    if (!v) throw new Error(`Missing animation variant ${id}`);
    if (stack.includes(id) || stack.length > 16) return; // Native recursion guard.
    const controls = framesOf(data.nodes[v.start]);
    const loops = controls.some(f => [2, 3].includes(f[1] & 255));
    const sampled = animationTime(controls, Math.max(0,
      storyTicks !== undefined && !loops ? storyTicks : ticks));
    const time = sampled.time;
    const clock = storyTicks !== undefined && !loops ? ticks : sampled.clock;
    function visitNode(
      index: number,
      transform: string,
      inheritedColors: number[],
      seen: Set<number>,
    ) {
      if (index < 0) return;
      if (seen.has(index)) throw new Error("Cyclic animation node tree");
      seen.add(index);
      const node = data.nodes[index];
      if (!node) throw new Error(`Missing animation node ${index}`);
      const keys = framesOf(node);
      let selected = -1;
      for (let i = 0; i < keys.length; i++)
        if (keys[i][0] <= time) selected = i;
      const f = keys[selected];
      let pose = [0, 0, 0, 0, 100, 100, 0];
      let colors = Array<number>(16).fill(128);
      if (f) {
        pose = [...data.transforms[f[3]]];
        colors = [...data.colors[f[4]]];
        const next = keys[selected + 1];
        if (f[1] & 255 && next && next[0] > f[0]) {
          const ratio = Math.min(1, (time - f[0]) / (next[0] - f[0]));
          pose = pose.map(
            (n, i) => n + Math.trunc((data.transforms[next[3]][i] - n) * ratio),
          );
          colors = colors.map(
            (n, i) => n + Math.trunc((data.colors[next[4]][i] - n) * ratio),
          );
        }
      }
      const world = `${transform} translate(${pose[0]} ${pose[1]}) rotate(${pose[6]}) scale(${pose[4] / 100} ${pose[5] / 100})`;
      // Native 0885d7e4/0885d840: saturating per-channel product / 128,
      // including alpha, at every level of the node tree.
      const tint = colors.map((n, i) => Math.min(255, (n * inheritedColors[i]) >> 7));
      visitNode(node[3], world, tint, new Set(seen));
      let trigger: number[] | undefined;
      for (const key of keys) {
        if (key[0] > time) break;
        if (key[1] >>> 8 === 1) trigger = key;
        if (key[1] >>> 8 === 2) trigger = undefined;
      }
      if (trigger) {
        const command = data.commands.slice(trigger[5], trigger[5] + 3);
        if (command.length !== 3)
          throw new Error("Invalid child animation command");
        const childTime = Math.max(0, clock - trigger[0]) + command[1];
        visitVariant(command[0], childTime, world, tint, [...stack, id],
          storyTicks === undefined || loops ? undefined : Math.max(0, storyTicks - trigger[0]) + command[1]);
      } else if (f) {
        const cell = data.cells[f[2]];
        if (cell)
          output.push({
            cell,
            texture: data.textures[cell.texture],
            transform: world,
            opacity: Math.max(tint[3], tint[7], tint[11], tint[15]) / 255,
            colors: tint,
            x: -pose[2],
            y: -pose[3],
          });
      }
      visitNode(node[4], transform, inheritedColors, new Set(seen));
    }
    visitNode(v.start + 1, parent, parentColors, new Set());
  }
  visitVariant(variant, elapsed, "", Array.from({ length: 4 }, () => tint).flat(), [], rootTime);
  // Native render queue draws the later sibling/background first.
  return output.reverse();
}

export function sampleSceneAnimation(
  data: AnimationData,
  playback: { id: number; variant: number; startedAt?: number; color?: number[] },
  frames: number,
  elapsed: number,
) {
  const scriptAge = Math.max(0, frames - (playback.startedAt ?? frames));
  const rootTime = storyAnimation(playback) ? scriptAge : undefined;
  return sampleAnimation(data, playback.variant, scriptAge + elapsed, rootTime, playback.color);
}
