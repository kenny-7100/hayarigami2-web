import type { GameData, Layer } from "./engine.ts";
import { createState, run } from "./engine.ts";
import type { GameState } from "./engine.ts";

const legacyPoliceLayers = new WeakMap<GameData, Record<string, Layer>>();
export function readingLayers(data: GameData, state: GameState) {
  if (state.mode !== "page") return state.layers;
  if (state.readingLayers) return state.readingLayers;
  // Old saves at this verified, straight-line opening already discarded the
  // exterior. Recompute it from source; never replace the saved VM state.
  if (state.script === 10201 && state.pc === 57 && state.page?.id === "10201:67532") {
    let layers = legacyPoliceLayers.get(data);
    if (!layers) {
      const opening = run(data, { ...createState(data), script: 10201 });
      if (opening.mode !== "page" || opening.page?.id !== state.page.id || !opening.readingLayers)
        throw new Error("警视厅阅读画面与源脚本不匹配");
      layers = opening.readingLayers;
      legacyPoliceLayers.set(data, layers);
    }
    return layers;
  }
  return state.layers;
}

// Background commands operate in texture pixels, not a pre-fitted 480×272 image.
// Signed sizes also mirror backgrounds (e.g. chapter one, script 20756).
export function backgroundGeometry(data: GameData, layer: Layer) {
  const texture = data.backgroundTextures?.[layer.asset];
  // Decode unsigned dimensions from saves written before signed-size support.
  const signed = (n: number) => (n > 32767 ? n - 65536 : n);
  const width = signed(layer.width ?? texture?.width ?? 480);
  const height = signed(layer.height ?? texture?.height ?? 272);
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  return {
    width: Math.abs(width),
    height: Math.abs(height),
    transform: `translate(${x} ${y}) scale(${width < 0 ? -1 : 1} ${height < 0 ? -1 : 1})`,
    left: Math.min(x, x + width),
    top: Math.min(y, y + height),
    right: Math.max(x, x + width),
    bottom: Math.max(y, y + height),
  };
}
