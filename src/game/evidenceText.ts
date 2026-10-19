import type { GameState } from './engine';
/** Readable evidence captions; preserve the original artwork and its handwritten clues. */
export const chapterOneEvidence: Record<number, string> = {
  2210: '名片：解梦师　宫本舞',
  2245: '名片：东京都议会议员　宫本笃',
  2260: '门上的血字：下一个就是你。',
  2261: '门上的血字：别做和梦里不一样的事！',
  2296: '剪报标题：仍未找到有关凶手的线索。',
  2325: '纸条：不准再接近宫本舞。',
  2375: '搜查员一览。栏目：担当、姓名、手机号码、住址。名单中有野上和志。',
};
export function visibleEvidence(state: GameState): string[] {
  if (state.chapterEntry !== 20001 || state.mode === 'logic' || state.logicVisible) return [];
  return [...new Set(Object.values(state.sprites).filter(layer => layer.alpha > 0).map(layer => chapterOneEvidence[layer.asset]).filter(Boolean))];
}
