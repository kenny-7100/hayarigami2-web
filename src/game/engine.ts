import { plainStyle, presentText, validStyle, validSpans } from "./text.ts";
import type { TextStyle, TextSpan, Acquisition } from "./text.ts";
import type { AnimationData } from "./animation.ts";
/** Original opcode semantics: docs/REVERSE_ENGINEERING.md.
 * The VM consumes offline-decoded Unicode. It has no PSP text decoder or font renderer.
 */
export type Instruction = {
  offset: number;
  length: number;
  op?: number;
  args?: number[];
  text?: string;
  label?: string;
};
export type Script = {
  language?: "ja" | "zh-CN";
  id: number;
  offset: number;
  size: number;
  instructions: Instruction[];
};
export type LogicField = {
  id: number;
  x: number;
  y: number;
  on: number[];
  off: number[];
  choices: { id: number; description: string }[];
};
export type Layer = {
  asset: number;
  alpha: number;
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  flip?: boolean;
};
export type Choice = {
  text: string;
  flag: number;
  cost: number;
  disabled: boolean;
};
export type Chapter = {
  id: number;
  entry: number;
  title: string;
  minScript: number;
  maxScript: number;
  next?: number;
};
export type GameData = {
  chapters?: Chapter[];
  logics?: Record<string, NonNullable<GameData["logic"]>>;
  pageText?: Record<string, string>;
  definitions?: Record<string, string>;
  effects?: Record<string, string>;
  silentEffects?: number[];
  silentAmbient?: number[];
  silentLoops?: number[];
  silentMusic?: number[];
  randomTable?: number[];
  ambient?: Record<string, string>;
  loops?: Record<string, string>;
  secondary?: Record<string, string>;
  keywords?: Record<string, string>;
  sprites?: Record<string, { file: string; width: number; height: number }>;
  logic?: {
    assets: Record<string, { file: string; width: number; height: number }>;
    id: number;
    width: number;
    height: number;
    fields: LogicField[];
    nodes: (Layer & { on: number[]; off: number[]; description: number })[];
    descriptions: Record<string, string>;
    variants: Record<string, { flag: number; description: number }[]>;
  };
  schemaVersion: number;
  revision: string;
  entry: number;
  title: string;
  sourceSha256: string;
  scripts: Record<string, Script>;
  backgrounds: Record<string, string>;
  animationData?: Record<string, AnimationData>;
  backgroundTextures?: Record<
    string,
    { file: string; width: number; height: number }
  >;
  music: Record<string, string>;
  terms: Record<string, string>;
  scope: string;
};
export type Page = {
  id: string;
  script: number;
  offset: number;
  text: string;
  background: number | null;
  spans?: TextSpan[];
  acquisitions?: Acquisition[];
};
export type GameState = {
  chapterEntry?: number;
  randomIndex?: number;
  creditLines?: string[];
  callStack?: { script: number; pc: number; blockOffset: number }[];
  version: 1;
  revision: string;
  script: number;
  pc: number;
  mode:
    | "running"
    | "page"
    | "input"
    | "choice"
    | "logic"
    | "confirm"
    | "credits"
    | "ended"
    | "error";
  error: string | null;
  flags: number[];
  variables: Record<string, number>;
  result: number;
  choices: Choice[];
  choiceCapture: boolean;
  option: Choice | null;
  answers: Record<string, number>;
  logicAvailable: boolean;
  logicVisible: boolean;
  logicId: number | null;
  logicReturn: "running" | "page";
  prompt: string;
  sprites: Record<string, Layer>;
  overlay: string;
  audioEvents: {
    id: number;
    kind: "effects" | "ambient";
    volume: number;
    delay: number;
  }[];
  loopSound: number | null;
  loopVolume: number;
  secondaryMusic: number | null;
  musicVolume: number;
  audioSequence: number;
  stageEffect: "none" | "shake" | "flash";
  animations: Record<
    string,
    {
      id: number;
      variant: number;
      startedAt?: number;
      alpha: number;
      x: number;
      y: number;
      z: number;
    }
  >;
  names: string[];
  input: { field: number; maxLength: number } | null;
  layers: Record<string, Layer>;
  music: number | null;
  bufferSpans?: TextSpan[];
  textStyles?: TextStyle[];
  pendingAcquisitions?: Acquisition[];
  buffer: string;
  blockOffset: number;
  page: Page | null;
  history: Page[];
  unlocked: number[];
  frames: number;
  adapted: number[];
};
// These presentation operations are deliberately adapted into Web page layout / transitions.
// This is an explicit, documented allowlist, never a fallback for unknown opcodes.
const WEB_PRESENTATION = new Set([
  1006, 1312, 1313, 1314, 203, 207, 216, 217, 306, 307, 701, 903, 914, 921, 922, 1101, 1308,
  1309, 1311, 208, 209, 214, 702, 907, 909, 910, 911, 918, 919, 920, 923, 924,
  925, 926, 927, 1102, 1201, 1204, 1303, 1306, 1403, 2108, 2109, 2201, 2202,
  2203, 2204, 2205, 2401, 2402, 2403, 2405, 2406, 2407,
]);
export function visibleBackground(state: GameState): number | null {
  return (
    Object.entries(state.layers)
      .sort(([a], [b]) => Number(b) - Number(a))
      .find(([, layer]) => layer.alpha > 0)?.[1].asset ?? null
  );
}
export function createState(data: GameData): GameState {
  return {
    chapterEntry: data.entry,
    randomIndex: 0,
    creditLines: [],
    callStack: [],
    version: 1,
    revision: data.revision,
    script: data.entry,
    pc: 0,
    mode: "running",
    error: null,
    flags: [],
    variables: {},
    result: 0,
    choices: [],
    choiceCapture: false,
    option: null,
    answers: {},
    logicAvailable: false,
    logicVisible: false,
    logicId: null,
    logicReturn: "running",
    prompt: "",
    sprites: {},
    overlay: "",
    audioEvents: [],
    loopSound: null,
    loopVolume: 1,
    secondaryMusic: null,
    musicVolume: 1,
    audioSequence: 0,
    stageEffect: "none",
    animations: {},
    names: ["风海", "纯也"],
    input: null,
    layers: {},
    music: null,
    bufferSpans: [],
    textStyles: [plainStyle],
    pendingAcquisitions: [],
    buffer: "",
    blockOffset: 0,
    page: null,
    history: [],
    unlocked: [],
    frames: 0,
    adapted: [],
  };
}
function setFlags(state: GameState, args: number[]) {
  const on = args[0] & 255,
    off = args[0] >>> 8;
  for (let i = 0; i < on + off; i++) {
    const flag = args[i + 1];
    if (flag === undefined) throw new Error("标志指令参数不完整");
    state.flags = state.flags.filter((x) => x !== flag);
    if (i < on) state.flags.push(flag);
  }
}
function matches(state: GameState, args: number[]): boolean {
  const on = args[0] & 255,
    off = args[0] >>> 8;
  if (args.length < 1 + on + off) throw new Error("条件指令参数不完整");
  return (
    args.slice(1, on + 1).every((x) => state.flags.includes(x)) &&
    args.slice(on + 1, on + off + 1).every((x) => !state.flags.includes(x))
  );
}
function publish(data: GameData, state: GameState) {
  const { text, spans } = presentText(state.buffer, state.bufferSpans ?? [], data.pageText?.[state.blockOffset]);
  state.buffer = "";
  state.bufferSpans = [];
  if (!text) return false;
  const page: Page = {
    id: `${state.script}:${state.blockOffset}`,
    script: state.script,
    offset: state.blockOffset,
    text,
    background: visibleBackground(state),
    spans,
    acquisitions: state.pendingAcquisitions ?? [],
  };
  state.pendingAcquisitions = [];
  state.page = page;
  state.history.push(page);
  state.mode = "page";
  return true;
}
export function run(data: GameData, previous: GameState): GameState {
  const { history, ...snapshot } = previous;
  const state: GameState = { ...structuredClone(snapshot), history: [...history] };
  if (state.mode !== "running") return state;
  state.audioEvents = [];
  state.audioSequence++;
  state.stageEffect = "none";
  const initialFrames = state.frames;
  let activeOffset = state.blockOffset;
  try {
    for (let steps = 0; steps < 10000; steps++) {
      const script = data.scripts[state.script];
      if (!script) throw new Error(`未提供剧情 ${state.script}`);
      const instruction = script.instructions[state.pc++];
      if (!instruction) throw new Error("剧情到达边界但未执行结束指令");
      activeOffset = instruction.offset;
      if (instruction.text !== undefined) {
        appendText(state, instruction.text);
        continue;
      }
      const a = instruction.args ?? [];
      switch (instruction.op) {
        case 1:
          if (data.chapters?.some(c => c.entry === state.script)) state.chapterEntry = state.script;
          state.blockOffset = instruction.offset;
          break;
        case 2:
          if (state.callStack?.length) {
            const caller = state.callStack.pop()!;
            Object.assign(state, caller);
            if (state.creditLines?.length) { state.mode = "credits"; return state; }
            break;
          }
          state.mode = "ended";
          state.music = null;
          state.loopSound = null;
          state.secondaryMusic = null;
          return state;
        case 3:
          state.buffer = "";
          state.bufferSpans = [];
          state.blockOffset = instruction.offset;
          break;
        case 4:
          if (publish(data, state)) return state;
          break;
        case 101: {
          const target = a[0] + (a[1] ?? 0) * 65536;
          if (!data.scripts[target]) throw new Error(`跳转目标 ${target} 尚未移植`);
          state.script = target;
          state.pc = 0;
          break;
        }
        case 1301: {
          // Native spawns a presentation task (08820838); Web executes these
          // audited side-effect-only tasks before the join / next reading stop.
          const target = a[0] + (a[1] ?? 0) * 65536;
          if (!data.scripts[target]) throw new Error(`演出脚本 ${target} 尚未提供`);
          if (!(target === 5004 || (target >= 6101 && target <= 6136) || (target >= 6200 && target <= 6225)) || a.slice(2).some(v => v !== 0)) throw new Error(`未审计的演出调用 ${target}`);
          const stack = state.callStack ??= [];
          if (stack.length >= 8) throw new Error("演出脚本嵌套过深");
          stack.push({ script: state.script, pc: state.pc, blockOffset: state.blockOffset });
          state.creditLines = [];
          state.script = target; state.pc = 0;
          break;
        }
        case 1302:
          break; // Join: synchronous Web presentation task has already completed.
        case 1304: {
          // 08820A7C -> 08831410: table[index] % bound; index += bound mod 1000.
          if (!data.randomTable || data.randomTable.length !== 1000 || !a[0]) throw new Error("随机表或范围无效");
          const index = state.randomIndex ?? 0;
          writeVariable(state, a[1] & 255, data.randomTable[index] % a[0]);
          state.randomIndex = (index + a[0]) % 1000;
          break;
        }
        case 106:
        case 108:
        case 114:
          if (
            !(instruction.op === 106
              ? matches(state, a)
              : instruction.op === 108
                ? compare(
                    readVariable(state, a[0] & 255),
                    signed(a[1]),
                    a[0] >>> 8,
                    a[2],
                  )
                : compare(state.result, signed(a[0]), a[2] & 255, a[1]))
          ) {
            let depth = 0,
              found = false;
            while (state.pc < script.instructions.length) {
              const next = script.instructions[state.pc++];
              if (next.op === instruction.op) depth++;
              if (next.op === instruction.op + 1) {
                if (depth === 0) {
                  found = true;
                  break;
                }
                depth--;
              }
            }
            if (!found)
              throw new Error(`条件块缺少结束指令 ${instruction.op + 1}`);
          }
          break;
        case 107:
        case 109:
        case 115:
          break;
        case 102:
          state.choices = [];
          state.choiceCapture = true;
          break;
        case 116:
          if (!state.choiceCapture || state.option)
            throw new Error("选项嵌套无效");
          state.option = {
            text: "",
            flag: signed(a[0]),
            cost: a[1] & 255,
            disabled: !!(a[1] >>> 8),
          };
          break;
        case 117:
          if (!state.option) throw new Error("选项缺少起始指令");
          state.choices.push(state.option);
          state.option = null;
          break;
        case 103:
          if (!state.choices.length || state.option)
            throw new Error("选择项不完整");
          publish(data, state);
          state.choiceCapture = false;
          state.mode = "choice";
          return state;
        case 802: {
          const id = a[1] & 255,
            op = a[1] >>> 8,
            value = signed(a[0]),
            old = readVariable(state, id);
          const values = [
            value,
            old + value,
            old - value,
            old * value,
            value ? Math.trunc(old / value) : old,
            old & value,
            old | value,
            old ^ value,
          ];
          if (values[op] === undefined) throw new Error("无效数值运算");
          writeVariable(state, id, values[op]);
          break;
        }
        case 804: {
          const left = readVariable(state, a[0] & 255),
            right = readVariable(state, a[0] >>> 8);
          state.result = left === right ? 0 : left < right ? 1 : -1;
          break;
        }
        case 806:
          writeVariable(state, a[0] >>> 8, readVariable(state, a[0] & 255));
          break;
        case 205: {
          const stack = state.textStyles ??= [plainStyle];
          const previous = stack.at(-1)!;
          const size = (a[0] << 24) >> 24;
          const color = (a[0] << 16) >> 24;
          if (stack.length >= 256) throw new Error("文字样式栈溢出");
          stack.push({ size: size >= -10 && size <= 10 ? size : previous.size, color: color >= 0 && color <= 15 ? color : previous.color });
          break;
        }
        case 206:
          if ((state.textStyles?.length ?? 0) > 1) state.textStyles!.pop();
          break;
        case 2001: {
          if (!data.keywords?.[a[0]]) throw new Error(`未转换关键词 ${a[0]}`);
          const fresh = !state.flags.includes(a[0]);
          appendText(state, `〔${data.keywords[a[0]]}〕`, { ...((state.textStyles ?? []).at(-1) ?? plainStyle), color: fresh ? 2 : 7, keyword: a[0], fresh });
          if (fresh) {
            state.flags.push(a[0]);
            (state.pendingAcquisitions ??= []).push({ kind: "keyword", id: a[0] });
          }
          break;
        }
        case 2008:
          if (!getLogic(data, { logicId: a[0] }))
            throw new Error("推理关系图未提供");
          state.logicId = a[0];
          break;
        case 2007:
          state.logicAvailable = !!a[0];
          break;
        case 2004:
          state.logicVisible = !!a[0];
          break;
        case 2012:
          state.answers = {};
          break;
        case 2006:
          writeVariable(state, a[0] >>> 8, state.answers[a[0] & 255] ?? 0);
          break;
        case 1005:
          if (!getLogic(data, state)) throw new Error("推理关系图尚未初始化");
          state.mode = "logic";
          state.logicReturn = "running";
          return state;
        case 1310:
          state.prompt = instruction.label ?? "确认推理结果？";
          state.mode = "confirm";
          return state;
        case 37240:
          if (![445568, 463532, 472732].includes(instruction.offset))
            throw new Error("未识别的原版补丁指令");
          break;
        case 405:
        case 406: {
          const l = state.layers[a[3]];
          if (l)
            Object.assign(
              l,
              instruction.op === 405
                ? { x: signed(a[0]), y: signed(a[1]) }
                : { width: signed(a[0]), height: signed(a[1]) },
            );
          break;
        }
        case 2201:
          if (data.sprites) {
            if (!data.sprites[a[0]]) throw new Error(`未转换角色图 ${a[0]}`);
            state.sprites[a[1]] = {
              asset: a[0],
              alpha: 0,
              x: 0,
              y: 0,
              z: 12000,
            };
          }
          break;
        case 2203:
          if (state.sprites[a[4]])
            Object.assign(state.sprites[a[4]], {
              x: signed(a[0]),
              y: signed(a[1]),
              z: signed(a[2]),
            });
          break;
        case 2204:
          if (state.sprites[a[3]])
            state.sprites[a[3]].alpha = Math.min(1, (a[1] >>> 8) / 128);
          break;
        case 2205:
          if (state.sprites[a[3]])
            Object.assign(state.sprites[a[3]], {
              width: signed(a[0]),
              height: signed(a[1]),
            });
          break;
        case 2208:
          if (state.sprites[a[0]]) state.sprites[a[0]].flip = !!a[1];
          break;
        case 2209:
          if (state.sprites[a[2]]) state.sprites[a[2]].z = signed(a[1]);
          break;
        case 1102:
          state.stageEffect = "shake";
          break;
        case 702:
          state.stageEffect = "flash";
          break;
        case 2403:
          if (data.animationData && !data.animationData[a[0]]?.variants[a[1]])
            throw new Error(`未转换动画 ${a[0]}:${a[1]}`);
          state.animations[a[2]] = {
            id: a[0],
            variant: a[1],
            startedAt: state.frames,
            alpha: 1,
            x: 0,
            y: 0,
            z: 10000,
          };
          break;
        case 2405:
          delete state.animations[a[0]];
          break;
        case 2406:
          if (state.animations[a[4]])
            Object.assign(state.animations[a[4]], {
              x: signed(a[0]),
              y: signed(a[1]),
              z: a[2],
            });
          break;
        case 2407:
          if (state.animations[a[3]])
            state.animations[a[3]].alpha = Math.min(1, (a[1] >>> 8) / 128);
          break;
        case 1401:
          if (state.callStack?.length && state.script >= 6100 && state.script < 6300 && instruction.label) (state.creditLines ??= []).push(instruction.label);
          state.overlay = instruction.label ?? "";
          break;
        case 1402:
          if (!(a[1] >>> 8)) state.overlay = "";
          break;
        case 801:
          setFlags(state, a);
          break;
        case 201:
          state.frames += a[0];
          break;
        case 202:
          state.frames += a[0];
          break; // Original input wait; grouped into the current Web reading page.
        case 204:
          appendText(state, "\n");
          break; // Line / wait flags are represented by one readable dialogue block.
        case 213:
          if (a[0] !== 0 && a[0] !== 1)
            throw new Error(`未支持的名字字段 ${a[0]}`);
          appendText(state, state.names[a[0]]);
          break;
        case 401:
          if (!data.backgrounds[a[0]]) throw new Error(`未转换背景 ${a[0]}`);
          state.layers[a[1]] = { asset: a[0], alpha: 0 };
          break;
        case 402:
          break; // Synchronous Web asset preparation replaces the PSP async-load barrier.
        case 403:
          if (state.layers[a[3]])
            state.layers[a[3]].alpha = Math.min(1, (a[1] >>> 8) / 128);
          break;
        case 902:
          break; // Preload only; 904 starts playback.
        case 904:
          if (data.silentMusic?.includes(a[0])) break;
          if (!data.music[a[0]]) throw new Error(`未转换音乐 ${a[0]}`);
          state.music = a[0];
          break;
        case 905:
          state.musicVolume = Math.min(1, a[1] / 128);
          break;
        case 906:
          state.music = null;
          break;
        case 909:
        case 914: {
          const kind = instruction.op === 909 ? "ambient" : "effects";
          if (kind === "effects" && data.silentEffects?.includes(a[0])) break;
          if (kind === "ambient" && data.silentAmbient?.includes(a[0])) break;
          if (data[kind]) {
            if (!data[kind]?.[a[0]])
              throw new Error(`未转换音效 ${kind}:${a[0]}`);
            state.audioEvents.push({
              id: a[0],
              kind,
              volume: Math.min(
                1,
                (instruction.op === 909
                  ? a[1]
                  : ((a[1] & 255) + (a[1] >>> 8)) / 2) / 128,
              ),
              delay: Math.min(5, (state.frames - initialFrames) / 60),
            });
          }
          break;
        }
        case 910:
        case 911:
          state.audioEvents = state.audioEvents.filter(
            (e) => e.kind !== "ambient",
          );
          break;
        case 920:
          if (data.silentLoops?.includes(a[0])) break;
          if (data.loops) {
            if (!data.loops[a[0]]) throw new Error(`未转换环境音 ${a[0]}`);
            state.loopSound = a[0];
            state.loopVolume = Math.min(1, a[1] / 128);
          }
          break;
        case 921:
          state.loopVolume = Math.min(1, (a[0] & 255) / 128);
          break;
        case 922:
          if (state.loopVolume === 0) state.loopSound = null;
          break;
        case 925:
          if (data.secondary) {
            if (!data.secondary[a[0]])
              throw new Error(`未转换第二音轨 ${a[0]}`);
            state.secondaryMusic = a[0];
          }
          break;
        case 926:
        case 927:
          state.secondaryMusic = null;
          break;
        case 1001:
          if (a[0] !== 0 && a[0] !== 1)
            throw new Error(`未支持的输入字段 ${a[0]}`);
          state.input = { field: a[0], maxLength: a[1] & 255 };
          state.mode = "input";
          return state;
        case 2013:
          if (!data.terms[a[0]]) throw new Error(`未提供术语 ${a[0]}`);
          if (!state.unlocked.includes(a[0])) {
            state.unlocked.push(a[0]);
            (state.pendingAcquisitions ??= []).push({ kind: "term", id: a[0] });
          }
          break;
        default:
          if (!WEB_PRESENTATION.has(instruction.op ?? -1))
            throw new Error(`未支持的指令 ${instruction.op}`);
          if (instruction.op === 217) appendText(state, "「菜单」");
          if (!state.adapted.includes(instruction.op!))
            state.adapted.push(instruction.op!);
      }
    }
    throw new Error("超过单次执行步数上限，可能存在脚本循环");
  } catch (error) {
    state.mode = "error";
    state.error = `${error instanceof Error ? error.message : String(error)}（剧情 ${state.script}，偏移 0x${activeOffset.toString(16)}）`;
    return state;
  }
}
export function advance(data: GameData, state: GameState): GameState {
  if (state.mode !== "page" && state.mode !== "credits") return state;
  return run(data, { ...state, mode: "running" });
}
export function submitName(
  data: GameData,
  state: GameState,
  value: string,
): GameState {
  if (state.mode !== "input" || !state.input) return state;
  const name = value.trim();
  if (
    !name ||
    Array.from(name).length > state.input.maxLength ||
    /[\p{Cc}\p{Cf}]/u.test(name)
  )
    throw new Error(`请输入 1–${state.input.maxLength} 个可见字符`);
  const next = structuredClone(state);
  next.names[state.input.field] = name;
  next.input = null;
  next.mode = "running";
  return run(data, next);
}
export function parseGameData(raw: unknown): GameData {
  if (!raw || typeof raw !== "object") throw new Error("剧情数据格式无效");
  const data = raw as GameData;
  if (
    data.schemaVersion !== 1 ||
    typeof data.revision !== "string" ||
    !data.scripts?.[data.entry] ||
    !data.music ||
    !data.backgrounds ||
    !data.terms
  )
    throw new Error("剧情数据版本不兼容");
  for (const script of Object.values(data.scripts)) {
    if (!Array.isArray(script.instructions) || !script.instructions.length)
      throw new Error("剧情指令为空");
    for (const t of script.instructions) {
      if (
        !Number.isInteger(t.offset) ||
        !Number.isInteger(t.length) ||
        t.length < 1 ||
        (typeof t.text !== "string" &&
          (!Number.isInteger(t.op) ||
            !Array.isArray(t.args) ||
            !t.args.every(Number.isInteger)))
      )
        throw new Error("剧情指令格式错误");
    }
  }
  return data;
}
const pageOffsets = new WeakMap<Script, Set<number>>();
function hasPageOffset(script: Script, offset: number): boolean {
  let offsets = pageOffsets.get(script);
  if (!offsets) {
    offsets = new Set(script.instructions.filter(t => t.op === 3).map(t => t.offset));
    pageOffsets.set(script, offsets);
  }
  return offsets.has(offset);
}
export function validateSave(data: GameData, raw: unknown): GameState {
  if (!raw || typeof raw !== "object") throw new Error("存档损坏");
  const original = raw as GameState;
  const s = { ...createState(data), ...structuredClone(original) };
  if (original.chapterEntry === undefined) s.chapterEntry = data.chapters?.find(c => s.script >= c.minScript && s.script <= c.maxScript)?.entry ?? data.entry;
  if (s.chapterEntry !== data.entry && !data.chapters?.some(c => c.entry === s.chapterEntry)) throw new Error("存档章节归属无效");
  const script = data.scripts[s.script];
  const validAcquisitions = (items: Acquisition[] | undefined) => items === undefined ||
    (Array.isArray(items) && items.length <= 1000 && items.every(e => e && Number.isInteger(e.id) && (e.kind === "keyword" ? !!data.keywords?.[e.id] : e.kind === "term" && !!data.terms[e.id])));
  const validPage = (p: Page) =>
    p &&
    typeof p.text === "string" &&
    p.text.length < 10000 &&
    validSpans(p.spans, p.text, data.keywords) &&
    validAcquisitions(p.acquisitions) &&
    typeof p.id === "string" &&
    !!data.scripts[p.script] &&
    hasPageOffset(data.scripts[p.script], p.offset) &&
    (p.background === null || !!data.backgrounds[p.background]);
  if (s.version !== 1 || s.revision !== data.revision)
    throw new Error("存档与当前剧情版本不兼容");
  if (
    !script ||
    !Number.isInteger(s.pc) ||
    s.pc < 0 ||
    s.pc > script.instructions.length ||
    !["page", "input", "choice", "logic", "confirm", "credits", "ended"].includes(
      s.mode,
    ) ||
    !Array.isArray(s.names) ||
    s.names.length !== 2 ||
    !s.names.every(
      (n) =>
        typeof n === "string" &&
        Array.from(n).length > 0 &&
        Array.from(n).length <= 5 &&
        !/[\p{Cc}\p{Cf}]/u.test(n),
    ) ||
    !Array.isArray(s.flags) ||
    !s.flags.every((x) => Number.isInteger(x) && x >= 0 && x < 65536) ||
    !Array.isArray(s.unlocked) ||
    !s.unlocked.every((x) => !!data.terms[x]) ||
    !Array.isArray(s.history) ||
    s.history.length > 50000 ||
    !s.history.every(validPage) ||
    (s.page !== null && !validPage(s.page)) ||
    !s.layers ||
    typeof s.layers !== "object" ||
    Object.values(s.layers).some(
      (l) =>
        !l ||
        !data.backgrounds[l.asset] ||
        !Number.isFinite(l.alpha) ||
        l.alpha < 0 ||
        l.alpha > 1,
    ) ||
    (s.music !== null && !data.music[s.music]) ||
    typeof s.buffer !== "string" ||
    s.buffer.length > 10000 ||
    !Number.isInteger(s.blockOffset) ||
    !Number.isFinite(s.frames) ||
    !Array.isArray(s.adapted) ||
    !s.adapted.every((x) => WEB_PRESENTATION.has(x) || x === 205 || x === 206) ||
    !validSpans(s.bufferSpans, s.buffer, data.keywords) ||
    !validAcquisitions(s.pendingAcquisitions) ||
    !Array.isArray(s.textStyles) || s.textStyles.length < 1 || s.textStyles.length > 256 || !s.textStyles.every(validStyle)
  )
    throw new Error("存档内容校验失败");
  if (
    !Array.isArray(s.audioEvents) ||
    s.audioEvents.length > 1000 ||
    s.audioEvents.some(
      (e) =>
        !e ||
        !["effects", "ambient"].includes(e.kind) ||
        !data[e.kind]?.[e.id] ||
        !Number.isFinite(e.volume) ||
        e.volume < 0 ||
        e.volume > 1 ||
        !Number.isFinite(e.delay) ||
        e.delay < 0 ||
        e.delay > 5,
    ) ||
    !Number.isInteger(s.audioSequence) ||
    !Number.isFinite(s.musicVolume) ||
    s.musicVolume < 0 ||
    s.musicVolume > 1 ||
    !Number.isFinite(s.loopVolume) ||
    s.loopVolume < 0 ||
    s.loopVolume > 1 ||
    (s.loopSound !== null && !data.loops?.[s.loopSound]) ||
    (s.secondaryMusic !== null && !data.secondary?.[s.secondaryMusic])
  )
    throw new Error("存档音频状态无效");
  if (
    !["none", "shake", "flash"].includes(s.stageEffect) ||
    !s.animations ||
    typeof s.animations !== "object" ||
    Object.values(s.animations).some(
      (a) =>
        !a ||
        !Number.isInteger(a.id) ||
        !Number.isInteger(a.variant) ||
        (a.startedAt !== undefined &&
          (!Number.isFinite(a.startedAt) ||
            a.startedAt < 0 ||
            a.startedAt > s.frames)) ||
        (data.animationData !== undefined &&
          !data.animationData[a.id]?.variants[a.variant]) ||
        !Number.isFinite(a.alpha) ||
        a.alpha < 0 ||
        a.alpha > 1 ||
        ![a.x, a.y, a.z].every(Number.isFinite),
    )
  )
    throw new Error("存档演出状态无效");
  const integerRecord = (
    value: unknown,
    keyMax: number,
    min: number,
    max: number,
  ) =>
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([k, v]) =>
        /^\d+$/.test(k) &&
        Number(k) <= keyMax &&
        Number.isInteger(v) &&
        v >= min &&
        v <= max,
    );
  if (
    !integerRecord(s.variables, 200, -32768, 32767) ||
    !integerRecord(s.answers, 63, 0, 65535) ||
    Object.entries(s.answers).some(
      ([id, value]) =>
        !getLogic(data, s)
          ?.fields.find((f) => f.id === Number(id))
          ?.choices.some((c) => c.id === value),
    ) ||
    !Number.isInteger(s.result) ||
    !Array.isArray(s.choices) ||
    s.choices.length > 16 ||
    s.choices.some(
      (c) =>
        !c ||
        typeof c.text !== "string" ||
        c.text.length > 10000 ||
        !Number.isInteger(c.flag) ||
        !Number.isInteger(c.cost) ||
        c.cost < 0 ||
        c.cost > 255 ||
        typeof c.disabled !== "boolean",
    ) ||
    typeof s.choiceCapture !== "boolean" ||
    s.option !== null ||
    typeof s.logicAvailable !== "boolean" ||
    typeof s.logicVisible !== "boolean" ||
    !["running", "page"].includes(s.logicReturn) ||
    (s.logicId !== null && !getLogic(data, s)) ||
    typeof s.prompt !== "string" ||
    s.prompt.length > 10000 ||
    typeof s.overlay !== "string" ||
    !s.sprites ||
    typeof s.sprites !== "object" ||
    Object.values(s.sprites).some(
      (l) =>
        !l ||
        !data.sprites?.[l.asset] ||
        !Number.isFinite(l.alpha) ||
        l.alpha < 0 ||
        l.alpha > 1 ||
        [l.x, l.y, l.z, l.width, l.height].some(
          (v) =>
            v !== undefined && (!Number.isFinite(v) || Math.abs(v) > 65535),
        ),
    )
  )
    throw new Error("存档交互状态校验失败");
  if (!Number.isInteger(s.randomIndex) || s.randomIndex! < 0 || s.randomIndex! >= 1000 ||
      !Array.isArray(s.callStack) || s.callStack.length > 8 || s.callStack.some(c => !c || !data.scripts[c.script] || !Number.isInteger(c.pc) || c.pc < 1 || c.pc > data.scripts[c.script].instructions.length || data.scripts[c.script].instructions[c.pc - 1].op !== 1301 || !Number.isInteger(c.blockOffset)) ||
      !Array.isArray(s.creditLines) || s.creditLines.length > 100 || s.creditLines.some(line => typeof line !== "string" || line.length > 1000)) throw new Error("存档演出调用或随机状态无效");
  const previous = script.instructions[s.pc - 1];
  if (s.mode === "credits" && (previous?.op !== 1301 || !s.creditLines.length)) throw new Error("存档片尾位置无效");
  if (
    s.mode === "choice" &&
    (previous?.op !== 103 || !s.choices.length || !s.page || s.choiceCapture)
  )
    throw new Error("存档选择位置无效");
  if (s.mode === "confirm" && previous?.op !== 1310)
    throw new Error("存档确认位置无效");
  if (
    s.mode === "logic" &&
    (!getLogic(data, s) ||
      (s.logicReturn === "running"
        ? previous?.op !== 1005
        : previous?.op !== 4))
  )
    throw new Error("存档推理位置无效");
  if (s.mode === "page" && (!s.page || ![4, 103].includes(previous?.op ?? -1)))
    throw new Error("存档不在有效阅读位置");
  if (
    s.mode === "input" &&
    (!s.input ||
      previous?.op !== 1001 ||
      s.input.field !== previous.args?.[0] ||
      s.input.maxLength !== (previous.args[1] & 255))
  )
    throw new Error("存档输入位置无效");
  if (s.mode === "ended" && previous?.op !== 2)
    throw new Error("存档结束位置无效");
  return structuredClone(s);
}

const signed = (value: number) => (value << 16) >> 16;
function appendText(state: GameState, text: string, style?: Omit<TextSpan, "start" | "end">) {
  if (state.option) state.option.text += text;
  else {
    const active = style ?? state.textStyles?.at(-1) ?? plainStyle;
    if (text.length && (active.color || active.size || "keyword" in active))
      (state.bufferSpans ??= []).push({ ...active, start: state.buffer.length, end: state.buffer.length + text.length });
    state.buffer += text;
  }
}
export function readVariable(state: GameState, id: number): number {
  const n = state.variables[id] ?? 0;
  return id >= 11 && id <= 26 ? (n << 24) >> 24 : n;
}
function writeVariable(state: GameState, id: number, value: number) {
  state.variables[id] = Math.max(-32768, Math.min(32767, Math.trunc(value)));
}
export function compare(
  value: number,
  expected: number,
  mode: number,
  range = 0,
): boolean {
  switch (mode) {
    case 0:
      return value < expected;
    case 1:
      return value <= expected;
    case 2:
      return value === expected;
    case 3:
      return value >= expected;
    case 4:
      return value > expected;
    case 5:
      return value >= expected - range && value <= expected + range;
    case 6:
      return value < expected - range || value > expected + range;
    case 7:
      return value !== expected;
    case 8:
      return !!(value & expected);
    case 9:
      return !!(value | expected);
    case 10:
      return !!(value ^ expected);
    default:
      throw new Error(`无效比较方式 ${mode}`);
  }
}
export function choose(
  data: GameData,
  previous: GameState,
  index: number,
): GameState {
  if (previous.mode !== "choice") throw new Error("当前没有待选择的选项");
  const option = previous.choices[index];
  if (
    !option ||
    !Number.isInteger(index) ||
    option.disabled ||
    readVariable(previous, 8) < option.cost
  )
    throw new Error("当前不能选择该选项");
  const state = structuredClone(previous);
  state.result = index;
  writeVariable(state, 8, Math.max(0, readVariable(state, 8) - option.cost));
  state.choices = [];
  state.mode = "running";
  return run(data, state);
}
export function logicCondition(
  state: GameState,
  item: { on: number[]; off: number[] },
): boolean {
  return (
    item.on.every((f) => state.flags.includes(f)) &&
    item.off.every((f) => !state.flags.includes(f))
  );
}
export function setAnswer(
  data: GameData,
  previous: GameState,
  fieldId: number,
  keyword: number,
): GameState {
  const field = getLogic(data, previous)?.fields.find((f) => f.id === fieldId);
  if (
    previous.mode !== "logic" ||
    !field ||
    !logicCondition(previous, field) ||
    !field.choices.some((c) => c.id === keyword) ||
    (keyword !== 0 && !previous.flags.includes(keyword))
  )
    throw new Error("此推理关键词尚不可用");
  const state = structuredClone(previous);
  state.answers[fieldId] = keyword;
  return state;
}
export function finishLogic(data: GameData, state: GameState): GameState {
  if (state.mode !== "logic") return state;
  return run(data, { ...state, mode: state.logicReturn });
}
export function openLogic(state: GameState): GameState {
  if (!state.logicAvailable || state.mode !== "page") return state;
  return { ...state, mode: "logic", logicReturn: "page" };
}
export function confirmResult(
  data: GameData,
  state: GameState,
  yes: boolean,
): GameState {
  if (state.mode !== "confirm") return state;
  return run(data, { ...state, result: yes ? 1 : 0, mode: "running" });
}

/** Native text templates compiled offline; no legacy byte decoding in the browser. */
export function formatGameText(text: string, names: string[]): string {
  return text.replace(
    /\{(surname|givenName)\}/g,
    (_, field: string) => names[field === "surname" ? 0 : 1] ?? "",
  );
}

export function getLogic(
  data: GameData,
  state: Pick<GameState, "logicId">,
): GameData["logic"] {
  if (state.logicId === null) return data.logic;
  return (
    data.logics?.[state.logicId] ??
    (data.logic?.id === state.logicId ? data.logic : undefined)
  );
}

export function enterChapter(
  data: GameData,
  previous: GameState,
  entry: number,
): GameState {
  if (!data.scripts[entry]) throw new Error("章节尚未提供");
  return run(data, {
    ...createState(data),
    script: entry,
    randomIndex: previous.randomIndex ?? 0,
    names: [...previous.names],
    flags: [...previous.flags],
    variables: { ...previous.variables },
    unlocked: [...previous.unlocked],
    history: [...previous.history],
  });
}
