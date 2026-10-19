import { useEffect, useRef } from "react";
import type { GameData, GameState } from "./engine";
import { mediaUrl as asset } from "./media";
function Track({
  file,
  enabled,
  volume,
  loop = true,
}: {
  file?: string;
  enabled: boolean;
  volume: number;
  loop?: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (enabled && file && !document.hidden)
        void el.play().catch(() => undefined);
      else el.pause();
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      el.pause();
      document.removeEventListener("visibilitychange", update);
    };
  }, [file, enabled]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  return (
    <audio
      ref={ref}
      src={file ? asset(file) : undefined}
      loop={loop}
      preload="auto"
    />
  );
}
export default function AudioScene({
  data,
  state,
  enabled,
  volume,
}: {
  data: GameData;
  state: GameState | null;
  enabled: boolean;
  volume: number;
}) {
  const sequence = state?.audioSequence;
  const events = state?.audioEvents;
  useEffect(() => {
    if (!enabled || !events) return;
    const playing: HTMLAudioElement[] = [];
    const timers = events.map((event) => {
      const file = data[event.kind]?.[event.id];
      if (!file) return undefined;
      const audio = new Audio(asset(file));
      audio.preload = "auto";
      audio.volume = volume * event.volume;
      audio.load();
      playing.push(audio);
      return window.setTimeout(() => {
        if (document.hidden) return;
        void audio.play().catch(() => undefined);
      }, event.delay * 1000);
    });
    const stop = () => {
      for (const t of timers) clearTimeout(t);
      for (const a of playing) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sequence, events, enabled, volume, data]);
  return (
    <>
      <Track
        file={
          state?.loopSound != null ? data.loops?.[state.loopSound] : undefined
        }
        enabled={enabled}
        volume={volume * (state?.loopVolume ?? 1)}
      />
      <Track
        file={
          state?.secondaryMusic != null
            ? data.secondary?.[state.secondaryMusic]
            : undefined
        }
        enabled={enabled}
        volume={volume}
        loop={false}
      />
    </>
  );
}
