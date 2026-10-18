import { useEffect, useState } from "react";
import type { GameData, GameState } from "./engine";
import { sampleAnimation } from "./animation";
function AnimationLayer({
  data,
  state,
  slot,
}: {
  data: GameData;
  state: GameState;
  slot: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!document.hidden && !reduce.matches)
        setElapsed(((now - start) * 60) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const a = state.animations[slot];
  const animation = data.animationData?.[a.id];
  if (!animation) return null;
  const draws = sampleAnimation(
    animation,
    a.variant,
    elapsed + Math.max(0, state.frames - (a.startedAt ?? state.frames)),
  );
  return (
    <g
      opacity={a.alpha}
      transform={`translate(${a.x} ${a.y}) scale(${480 / 640} ${272 / 448})`}
    >
      {draws.map((d, i) => (
        <g
          key={i}
          transform={d.transform}
          opacity={d.opacity}
          style={{
            mixBlendMode:
              d.cell.blend === 512
                ? "screen"
                : d.cell.blend === 768
                  ? "multiply"
                  : "normal",
          }}
        >
          <g
            transform={`translate(${d.x + (d.cell.flipX ? d.cell.width : 0)} ${d.y + (d.cell.flipY ? d.cell.height : 0)}) scale(${d.cell.flipX ? -1 : 1} ${d.cell.flipY ? -1 : 1})`}
          >
            <svg
              width={d.cell.width}
              height={d.cell.height}
              viewBox={`${d.cell.u} ${d.cell.v} ${d.cell.width} ${d.cell.height}`}
              overflow="hidden"
            >
              <image
                href={`${import.meta.env.BASE_URL}game/${d.texture.file}`}
                width={d.texture.width}
                height={d.texture.height}
              />
            </svg>
          </g>
        </g>
      ))}
    </g>
  );
}
export default function AnimationScene({
  data,
  state,
}: {
  data: GameData;
  state: GameState;
}) {
  return (
    <g aria-hidden="true">
      {Object.entries(state.animations)
        .sort(([, a], [, b]) => a.z - b.z)
        .map(([slot, a]) => (
          <AnimationLayer
            key={`${slot}:${a.id}:${a.variant}:${a.startedAt ?? 0}`}
            data={data}
            state={state}
            slot={slot}
          />
        ))}
    </g>
  );
}
