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
/** Checked against chapter-two source textures; no unseen plot interpretation. */
export const chapterTwoEvidence: Record<number, string> = {
  2405: '剧团海报：《死之道行》。主演：五十岚理绪。',
  2410: '门禁卡。卡面英文 SECURITY CARD 表示安全门禁卡。',
  2475: '出入记录。栏目：时间、姓名、卡号、进入／离开。记录依次为：６点００分，五十岚理绪进入；６点１１分，辻沙耶香进入；７点０７分，辻沙耶香离开；８点０１分，佐伯龙彦进入。',
  2485: '手机邮件：下一个轮到你了。',
  2486: '手机邮件：我来接你啦。',
  2487: '手机邮件：要幸福哦。',
  2488: '手机邮件：为什么要逃走？',
  2489: '手机邮件：我去接你啊，贵子……',
  2495: '手机邮件：我在这里啊……快点，来接我……',
  4209: '思考：代替辻沙耶香的人。',
};
export function visibleEvidence(state: GameState): string[] {
  if (state.mode === 'logic' || state.logicVisible) return [];
  const captions = state.chapterEntry === 20001 ? chapterOneEvidence : state.chapterEntry === 30001 ? chapterTwoEvidence : {};
  return [...new Set(Object.values(state.sprites).filter(layer => layer.alpha > 0).map(layer => captions[layer.asset]).filter(Boolean))];
}
