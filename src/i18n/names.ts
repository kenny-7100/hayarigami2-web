/** Web names use grapheme clusters, not the original PSP's five glyph slots. */
export const playerNameLimit = 32;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function validPlayerName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && value.trim().length > 0 &&
    [...segmenter.segment(value)].length <= playerNameLimit &&
    !/[\p{Cc}\p{Cf}]/u.test(value.replace(/[\u200C\u200D]/g, ''));
}
