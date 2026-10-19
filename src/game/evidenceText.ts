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
/** Finale source artwork: captions translate readable clues without repainting them. */
export const chapterThreeEvidence: Record<number, string> = {
  2600: '地图：日本关东近海，红圈标示常世岛所在的位置。',
  2605: '药盒：成人用晕船药。黄色宣传语：很快入睡，逐渐恢复！',
  2610: '书封：《亡灵如此漫长的缺席》，作者柿崎幸之助。',
  2615: '名片：《东东体育报》编辑部记者，落合圭三。',
  2640: '录像画面：PLAY 表示正在播放；左上角是录像标记。',
  2641: '录像画面：PLAY 表示正在播放。',
  2642: '录像画面放大：PLAY，意为播放。',
  2675: '墙上的英文留言：欢迎来到艾滋病的世界。',
  2690: '书封：《世界猎奇事件簿·现代篇》。',
  2705: '手稿：下方署名为青山正纯；正文内容随剧情中的阅读展开。',
  4300: '思考：取走器官的人是……',
  4301: '思考：凶手的身世。',
  4302: '思考：有疑点的罪行。',
  4303: '思考：死者复活。',
  4304: '思考：关于谷的行动。',
};
/** Remaining chapters: checked source textures; handwriting is not guessed from thumbnails. */
export const remainingEvidence: Record<number, string> = {
  2010: '破损的神符，上面写有难以辨认的字；主人公此时也无法读懂。',
  2015: '门牌：美术室。',
  2865: '搜查员名册。栏目含姓名、手机号码和住址；号码在原图中已作遮蔽。',
  2870: '电梯楼层显示：5楼。',
  2871: '电梯楼层显示：10楼。',
  2875: '门牌：证物保管仓库。',
  2880: '警察手册。',
  2881: '警察证件：小暮宗一郎。',
  3000: '电视新闻字幕：烧死的女人？遗体发现。',
  3005: '墙上的字：你明天再来。',
  3030: '纸箱里放着事件资料档案；旧档案题名为“狗山女校神隐事件”，新档案为“人为编造的都市传说”。',
  3085: '电脑上的匿名讨论区，列着都市传说与怪谈话题。当前调查涉及的帖子内容见下方正文。',
  4000: '思考：镜子下面隐藏的是……',
  4001: '思考：从投报口看到的人。',
  4002: '思考：202号房的怪事。',
  4003: '思考：赝品的作者是……',
  4004: '思考：春日圭一的死因和雪乃。',
  4005: '思考：身上留下的瘢痕。',
  4006: '思考：黑暗天。',
  4400: '思考：来历不明的少女。',
  4401: '思考：老妇人的戒指。',
  4500: '思考：浑身是血的女人。',
  4501: '思考：我能做的事是……',
  4600: '思考：菱田桃代的死因。',
  4602: '思考：都市传说的变形。',
  4603: '思考：迫近者的真面目。',
};
export function visibleEvidence(state: GameState): string[] {
  if (state.mode === 'logic' || state.logicVisible) return [];
  const captions = state.chapterEntry === 20001 ? chapterOneEvidence : state.chapterEntry === 30001 ? chapterTwoEvidence : state.chapterEntry === 40001 ? chapterThreeEvidence : remainingEvidence;
  return [...new Set(Object.values(state.sprites).filter(layer => layer.alpha > 0).map(layer => captions[layer.asset]).filter(Boolean))];
}
