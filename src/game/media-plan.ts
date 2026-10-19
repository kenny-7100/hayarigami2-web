import { advance, choose, getLogic, readVariable } from "./engine.ts";
import type { GameData, GameState } from "./engine.ts";
import { readingLayers } from "./scene.ts";

export type MediaFile = { file: string; kind: "image" | "audio" };
export function sceneMedia(data: GameData, state: GameState): MediaFile[] {
  const files = new Map<string, MediaFile>();
  const add = (file: string | undefined, kind: MediaFile["kind"]) => {
    if (file) files.set(file, { file, kind });
  };
  for (const layer of Object.values(readingLayers(data, state)))
    if (layer.alpha > 0) add(data.backgrounds[layer.asset], "image");
  for (const layer of Object.values(state.sprites))
    if (layer.alpha > 0) add(data.sprites?.[layer.asset]?.file, "image");
  for (const animation of Object.values(state.animations))
    for (const texture of Object.values(data.animationData?.[animation.id]?.textures ?? {})) add(texture.file, "image");
  if (state.logicVisible || state.mode === "logic")
    for (const texture of Object.values(getLogic(data, state)?.assets ?? {})) add(texture.file, "image");
  if (state.music != null) add(data.music[state.music], "audio");
  if (state.loopSound != null) add(data.loops?.[state.loopSound], "audio");
  if (state.secondaryMusic != null) add(data.secondary?.[state.secondaryMusic], "audio");
  for (const event of state.audioEvents) add(data[event.kind]?.[event.id], "audio");
  return [...files.values()];
}

// Execute only disposable copies; never choose a route or save speculative progress.
export function upcomingMedia(data: GameData, state: GameState): MediaFile[] {
  const queue = [{ state: { ...state, history: [] }, depth: 0 }];
  const files = new Map<string, MediaFile>();
  for (let count = 0; queue.length && count < 12; count++) {
    const item = queue.shift()!;
    for (const media of sceneMedia(data, item.state)) files.set(media.file, media);
    if (item.depth >= 4) continue;
    const next: GameState[] = [];
    if (["page", "credits"].includes(item.state.mode)) next.push(advance(data, item.state));
    else if (item.state.mode === "choice") item.state.choices.forEach((choice, index) => {
      if (!choice.disabled && choice.cost <= readVariable(item.state, 8)) next.push(choose(data, item.state, index));
    });
    for (const s of next) if (s.mode !== "error") queue.push({ state: { ...s, history: [] }, depth: item.depth + 1 });
  }
  return [...files.values()];
}
