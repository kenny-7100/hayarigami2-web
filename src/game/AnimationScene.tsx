import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { GameData, GameState } from "./engine";
import { animationPosition, sampleSceneAnimation, storyAnimation } from "./animation";
import { createAnimationRenderer } from "./animation-renderer";

function AnimationLayer({ data, state, slot }: { data: GameData; state: GameState; slot: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>();
  const a = state.animations[slot];
  const animation = data.animationData?.[a.id];
  const sample = useEffectEvent((elapsed: number, initialFrames: number) => ({
    position: animationPosition(a.id, a.x, a.y),
    draws: sampleSceneAnimation(animation!, a, state.frames,
      // Page waits move the cinematic, but must not jump the driving loop.
      elapsed - (storyAnimation(a) ? state.frames - initialFrames : 0)),
  }));
  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let renderer: Awaited<ReturnType<typeof createAnimationRenderer>> | undefined;
    const initialFrames = state.frames;
    const fail = (e: unknown) => { if (!disposed) setError(String(e)); };
    if (!animation) {
      queueMicrotask(() => fail(new Error(`Missing animation ${a.id}`)));
      return;
    }
    const element = canvas.current!;
    const lost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      fail(new Error("Animation graphics context lost; reload to restore"));
    };
    element.addEventListener("webglcontextlost", lost);
    void createAnimationRenderer(element, animation, a.id).then(result => {
      if (disposed) { result.dispose(); return; }
      renderer = result;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      let previous = performance.now();
      let elapsed = 0;
      const tick = (now: number) => {
        if (!document.hidden && !reduce.matches) elapsed += Math.min(now - previous, 100) * 60 / 1000;
        previous = now;
        try {
          const { draws, position } = sample(elapsed, initialFrames);
          // Rain and particles are additive overlays over SVG backgrounds.
          // Source-over here would darken the backdrop by their alpha.
          element.parentElement!.style.mixBlendMode = draws.filter(d => d.opacity > 0)
            .every(d => d.cell.blend === 512) ? "plus-lighter" : "normal";
          result.draw(draws, position);
        }
        catch (e) { fail(e); return; }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }).catch(fail);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      element.removeEventListener("webglcontextlost", lost);
      renderer?.dispose();
    };
    // The component key identifies a playback, not a reading page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation, a.id]);
  return (
    <foreignObject x="0" y="0" width="480" height="272" opacity={a.color ? 1 : a.alpha}>
      <canvas ref={canvas} width="960" height="544" style={{ width: "100%", height: "100%", display: "block" }} />
      {error && <div role="alert" style={{ position: "absolute", inset: 0, color: "white", background: "#400", padding: 12 }}>{error}</div>}
    </foreignObject>
  );
}
export default function AnimationScene({ data, state }: { data: GameData; state: GameState }) {
  return (
    <g>
      {Object.entries(state.animations).sort(([, a], [, b]) => a.z - b.z).map(([slot, a]) => (
        <AnimationLayer key={`${slot}:${a.id}:${a.variant}:${a.startedAt ?? 0}`} data={data} state={state} slot={slot} />
      ))}
    </g>
  );
}
