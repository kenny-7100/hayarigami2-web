import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { GameData, GameState } from "./engine";
import { createState, run } from "./engine";
import { prepareMedia, protectMedia } from "./media";
import { sceneMedia, upcomingMedia } from "./media-plan";

export function useMediaState(data: GameData, initial: GameState | null) {
  const [state, publish] = useState<GameState | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const active = useRef(true);
  const current = useRef<GameState | null>(null);
  const pending = useRef(false);
  const target = useRef<GameState | null>(null);
  const completion = useRef<(() => void) | undefined>(undefined);
  const generation = useRef(0);
  const setState = useCallback(async (action: SetStateAction<GameState | null>, onReady?: () => void) => {
    if (pending.current) return false;
    const next = typeof action === "function" ? action(current.current) : action;
    target.current = next;
    completion.current = onReady;
    const token = ++generation.current;
    pending.current = true;
    setStatus("正在加载场景…");
    setError("");
    try {
      const files = next ? sceneMedia(data, next) : [];
      protectMedia([...files, ...(current.current ? sceneMedia(data, current.current) : [])]);
      await prepareMedia(files);
      if (!active.current || token !== generation.current) return false;
      current.current = next;
      publish(next);
      onReady?.();
      setStatus("");
      return true;
    } catch (e) {
      if (active.current && token === generation.current) {
        setStatus("");
        setError(String(e));
      }
      return false;
    } finally {
      if (token === generation.current) pending.current = false;
    }
  }, [data]);
  useEffect(() => {
    active.current = true;
    void setState(initial);
    return () => {
      active.current = false;
      // This is an async transaction counter, not a DOM ref captured by the effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      pending.current = false;
    };
  }, [initial, setState]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (pending.current) return;
      const files = upcomingMedia(data, state ?? run(data, createState(data)));
      protectMedia(files);
      // A speculative failure is retried by the mandatory foreground gate.
      void prepareMedia(files, () => !cancelled && !pending.current).catch(() => undefined);
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [data, state]);
  return { state, setState, mediaLoading: !!status, mediaStatus: status, mediaError: error,
    // Restoring the same animation must reset its clock even after a failed load.
    retryMedia: () => setState(target.current, completion.current) };
}
