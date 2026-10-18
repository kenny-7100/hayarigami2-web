import type { GameData, Layer } from "./engine.ts";

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
