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
  x: number;
  y: number;
};
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
): AnimationDraw[] {
  const output: AnimationDraw[] = [];
  const framesOf = (node: number[]) =>
    data.frames.slice(node[1], node[1] + node[2]);
  function visitVariant(
    id: number,
    ticks: number,
    parent: string,
    alpha: number,
    stack: number[],
  ) {
    const v = data.variants[id];
    if (!v) throw new Error(`Missing animation variant ${id}`);
    if (stack.includes(id) || stack.length > 16) return; // Native recursion guard.
    const { time, clock } = animationTime(
      framesOf(data.nodes[v.start]),
      Math.max(0, ticks),
    );
    function visitNode(
      index: number,
      transform: string,
      opacity: number,
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
            (n, i) => n + (data.transforms[next[3]][i] - n) * ratio,
          );
          colors = colors.map(
            (n, i) => n + (data.colors[next[4]][i] - n) * ratio,
          );
        }
      }
      const world = `${transform} translate(${pose[0]} ${pose[1]}) rotate(${pose[6]}) scale(${pose[4] / 100} ${pose[5] / 100})`;
      const ownAlpha =
        (opacity * (colors[3] + colors[7] + colors[11] + colors[15])) / 512;
      visitNode(node[3], world, ownAlpha, new Set(seen));
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
        visitVariant(command[0], childTime, world, ownAlpha, [...stack, id]);
      } else if (f) {
        const cell = data.cells[f[2]];
        if (cell)
          output.push({
            cell,
            texture: data.textures[cell.texture],
            transform: world,
            opacity: Math.min(1, Math.max(0, ownAlpha)),
            x: -pose[2],
            y: -pose[3],
          });
      }
      visitNode(node[4], transform, opacity, new Set(seen));
    }
    visitNode(v.start + 1, parent, alpha, new Set());
  }
  visitVariant(variant, elapsed, "", 1, []);
  // Native render queue draws the later sibling/background first.
  return output.reverse();
}
