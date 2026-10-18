import { useEffect, useRef } from "react";
import type { GameData, GameState } from "./engine";
const asset = (file: string) => `${import.meta.env.BASE_URL}game/${file}`;
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
      preload="none"
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
    const timers = events.map((event) =>
      window.setTimeout(() => {
        if (document.hidden) return;
        const file = data[event.kind]?.[event.id];
        if (!file) return;
        const audio = new Audio(asset(file));
        audio.volume = volume * event.volume;
        playing.push(audio);
        void audio.play().catch(() => undefined);
      }, event.delay * 1000),
    );
    const stop = () => {
      for (const t of timers) clearTimeout(t);
      for (const a of playing) {
        a.pause();
        a.removeAttribute("src");
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
