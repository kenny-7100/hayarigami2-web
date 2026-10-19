import { visibleEvidence } from "./game/evidenceText";
import { GameConfirmation } from "./components/GameConfirmation";
import { SearchField } from "./components/SearchField";
import { matchesSearch } from "./game/search";
import { playerNameLimit } from "./i18n/names";
import { useGameText } from "./i18n/useGameText";
import { useGameCatalog } from "./i18n/gameContext";
import { localizeChoice, localizePage } from "./i18n/gameCatalog";
import { GameLocaleProvider } from "./i18n/GameLocaleProvider";
import { LanguagePicker } from "./i18n/LanguagePicker";
import { useTranslation } from "./i18n/useTranslation";
import { StoryText, CollectionFeedback } from "./game/StoryText";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  formatGameText,
  getLogic,
  enterChapter,
  validateSave,
  advance,
  choose,
  readVariable,
  confirmResult,
  openLogic,
  createState,
  parseGameData,
  run,
  submitName,
} from "./game/engine";
import type { GameData, GameState } from "./game/engine";
import { loadGame, readSaves, saveGame } from "./game/storage";
import type { SaveSlot } from "./game/storage";
import "./App.css";
import AudioScene from "./game/AudioScene";
import LogicBoard from "./game/LogicBoard";
import AnimationScene from "./game/AnimationScene";
import { backgroundGeometry } from "./game/scene";
const asset = (name: string) => `${import.meta.env.BASE_URL}game/${name}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Panel = "history" | "saves" | "terms" | "keywords" | "settings" | "chapters" | null;
function NameInput({
  state,
  onSubmit,
}: {
  state: GameState;
  onSubmit: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(state.names[state.input!.field]);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      onSubmit(value);
    } catch (e) {
      setError(message(e) === "INVALID_PLAYER_NAME" ? "姓名需为 1–32 个可见字符，不能包含控制字符。" : message(e));
    }
  }
  return (
    <form className="name-form" onSubmit={submit}>
      <span className="eyebrow">{t("人物档案")}</span>
      <h2>{t(state.input!.field === 0 ? "你的姓氏是？" : "你的名字是？")}</h2>
      <p>{t("请输入 1–{max} 个字符，随后将用于故事中的称呼。", { max: playerNameLimit })}</p>
      <label>
        {state.input!.field === 0 ? t("姓氏") : t("名字")}
        <input
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          autoComplete="off"
          spellCheck={false}
          dir="auto"
          aria-invalid={!!error}
          aria-describedby={error ? "name-error" : undefined}
        />
      </label>
      {error && <p id="name-error" role="alert">{t(error)}</p>}
      <button className="primary" type="submit">{t("确认并继续 →")}</button>
    </form>
  );
}
function readPreference(
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  try {
    const raw = localStorage.getItem(`hs2.${key}`);
    const value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  } catch {
    return fallback;
  }
}
function Backlog({
  state,
  fontSize,
}: {
  state: GameState | null;
  fontSize: number;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState(100);
  const [query, setQuery] = useState("");
  const catalog = useGameCatalog();
  const history = state?.history ?? [];
  const matching = history.filter(page => matchesSearch(localizePage(catalog, page, state?.names ?? []).text, query));
  return (
    <div className="backlog" style={{ fontSize }}>
      {!!history.length && <SearchField value={query} onChange={value => { setQuery(value); setCount(100); }} />}
      {!!history.length && !matching.length && <p role="status">{t("没有匹配的内容")}</p>}
      {!history.length ? (
        <p>{t("开始阅读后，剧情会记录在这里。")}</p>
      ) : (
        <p className="backlog-order">{t("最近的记录在前")}</p>
      )}
      {matching
        .slice(-count)
        .reverse()
        .map((p, i) => (
          <article key={`${p.id}-${history.length - i}`}>
            <p><StoryText page={p} names={state?.names} /></p>
          </article>
        ))}
      {matching.length > count && (
        <button className="secondary" onClick={() => setCount(count + 100)}>{t("查看更早的记录")}</button>
      )}
    </div>
  );
}
export function Reader(props: { data: GameData; initialState?: GameState | null }) {
  return <GameLocaleProvider sourceSha256={props.data.sourceSha256}><ReaderContent {...props} /></GameLocaleProvider>;
}
function ReaderContent({
  data,
  initialState = null,
}: {
  data: GameData;
  initialState?: GameState | null;
}) {
  const { locale, t } = useTranslation();
  const g = useGameText();
  const catalog = useGameCatalog();
  const chapters = data.chapters?.map(chapter => ({ ...chapter, title: g(`chapter.${chapter.id}.title`, chapter.title) }));
  const [state, setState] = useState<GameState | null>(initialState);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmation, setConfirmation] = useState<{ kind: "start"; entry: number } | { kind: "save"; id: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [collectionFocus, setCollectionFocus] = useState<number | null>(null);
  const [collectionQuery, setCollectionQuery] = useState("");
  function openCollection(panel: "terms" | "keywords", id: number) {
    setCollectionQuery("");
    setCollectionFocus(id);
    setPanel(panel);
  }
  function openNotebook(panel: "terms" | "keywords") {
    setCollectionQuery("");
    setCollectionFocus(null);
    setPanel(panel);
  }
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(() =>
    readPreference("volume", 0.5, 0, 1),
  );
  const [fontSize, setFontSize] = useState(() =>
    readPreference("fontSize", 20, 16, 28),
  );
  const [busy, setBusy] = useState(false);
  const [sceneSession, setSceneSession] = useState(0);
  const sceneSvg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = sceneSvg.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const effect = state?.stageEffect;
    const animation =
      effect === "shake"
        ? element.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-4px)" },
              { transform: "translateX(4px)" },
              { transform: "translateX(-4px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 350, easing: "ease-out" },
          )
        : effect === "flash"
          ? element.animate(
              [{ filter: "brightness(1.8)" }, { filter: "brightness(1)" }],
              { duration: 500, easing: "ease-out" },
            )
          : null;
    return () => animation?.cancel();
  }, [state?.audioSequence, state?.stageEffect, sceneSession]);
  const latestProgress = useRef<GameState | null>(initialState ?? null);
  useEffect(() => { if (state) latestProgress.current = state; }, [state]);
  useEffect(() => { if (state?.mode === "error") console.error(state.error); }, [state?.mode, state?.error]);
  const dialog = useRef<HTMLDialogElement>(null);
  const panelBody = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!panel && !confirmation) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => { root.style.overflow = previous; };
  }, [panel, confirmation]);
  useEffect(() => {
    try {
      localStorage.setItem("hs2.fontSize", String(fontSize));
      localStorage.setItem("hs2.volume", String(volume));
    } catch {
      /* Reading remains available when browser storage is restricted. */
    }
  }, [fontSize, volume]);
  useEffect(() => {
    if (panel || (notice !== "已恢复存档" && notice !== "存档已保存到此浏览器"))
      return;
    const timer = window.setTimeout(() => setNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [notice, panel]);
  useEffect(() => {
    readSaves()
      .then(setSlots)
      .catch((e) => setNotice(message(e)));
  }, []);
  useEffect(() => {
    if (
      !state ||
      !["page", "input", "choice", "logic", "confirm", "credits", "ended"].includes(
        state.mode,
      )
    )
      return;
    let active = true;
    saveGame("auto", state)
      .then(readSaves)
      .then((s) => {
        if (active) setSlots(s);
      })
      .catch((e) => {
        if (active) setNotice(message(e));
      });
    return () => {
      active = false;
    };
  }, [state]);
  useEffect(() => {
    if (panel) {
      dialog.current?.showModal();
      panelBody.current?.scrollTo(0, 0);
    }
    else dialog.current?.close();
  }, [panel]);
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const play = () => {
      if (sound && state?.music && !document.hidden)
        el.play().catch(() => setNotice("声音尚未播放，请点击“声音”重试。"));
      else el.pause();
    };
    play();
    document.addEventListener("visibilitychange", play);
    return () => {
      el.pause();
      document.removeEventListener("visibilitychange", play);
    };
  }, [sound, state?.music]);
  useEffect(() => {
    if (audio.current)
      audio.current.volume = volume * (state?.musicVolume ?? 1);
  }, [volume, state?.musicVolume]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        panel || confirmation ||
        (!state || !["page", "credits"].includes(state.mode)) ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable ||
        ((e.target as HTMLElement)?.closest("button") &&
          !(
            e.key === "ArrowRight" &&
            (e.target as HTMLElement)?.closest(".next")
          ))
      )
        return;
      if ([" ", "Enter", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        setState((s) => (s ? advance(data, s) : s));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [data, panel, confirmation, state]);
  async function restore(id: string) {
    setBusy(true);
    try {
      const restored = await loadGame(data, id);
      setSceneSession((n) => n + 1);
      setState(restored);
      setPanel(null);
      setNotice("已恢复存档");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(id: string, confirmed = false) {
    if (!state) return;
    if (!confirmed && slots.some((s) => s.id === id)) {
      setConfirmation({ kind: "save", id });
      return;
    }
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBusy(true);
    try {
      await saveGame(id, state);
      setSlots(await readSaves());
      setNotice("存档已保存到此浏览器");
    } catch (e) {
      setNotice(message(e));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        if (trigger?.isConnected && document.activeElement === document.body && dialog.current?.open) trigger.focus();
      });
    }
  }
  function start(entry = data.entry, confirmed = false) {
    if (!confirmed && slots.some((s) => s.id === "auto")) {
      setConfirmation({ kind: "start", entry });
      return;
    }
    setNotice("");
    setPanel(null);
    setSceneSession((n) => n + 1);
    const previous = state ?? latestProgress.current ?? slots.find(s => s.id === "auto")?.state;
    const base = previous ? validateSave(data, previous) : createState(data);
    setState(enterChapter(data, { ...base, randomIndex: crypto.getRandomValues(new Uint32Array(1))[0] % 1000 }, entry));
  }
  const chapter = state
    ? chapters?.find(
        (c) => state.script >= c.minScript && state.script <= c.maxScript,
      ) ?? chapters?.find(c => c.entry === state.chapterEntry)
    : undefined;
  const nextEntry = state && !chapter ? 10001 : chapter?.next;
  const nextTitle =
    chapters?.find((c) => c.entry === nextEntry)?.title ?? "第零话 · 黒闇";
  const saveConfirmation = !!state && state.mode === "confirm" && data.scripts[state.script].instructions.some(t => t.op === 1006);
  const canSave =
    !!state &&
    ["page", "input", "choice", "logic", "confirm", "credits", "ended"].includes(
      state.mode,
    );
  return (
    <main className={`app ${state ? "reading" : "landing"}`}>
      <header className="topbar">
        <button
          className="brand"
          aria-label={t("返回标题")}
          onClick={() => {
            setState(null);
            setPanel(null);
          }}
        >{t("流行之神")}<span>２</span>
          <small>{t("都市传说 · 警察怪异事件")}</small>
        </button>
        <div className="top-actions">
          <LanguagePicker />
          <button
            aria-pressed={sound}
            onClick={() => {
              setSound(!sound);
              setNotice("");
            }}
          >
            {t(sound ? "声音 开" : "声音 关")}
          </button>
          <button onClick={() => setPanel("saves")}>{t("存档")}</button>
          <button onClick={() => setPanel("settings")}>{t("设置")}</button>
        </div>
      </header>
      {notice && !panel && (
        <div className="notice" role="status">
          {t(notice)}
          <button aria-label={t("关闭通知")} onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {!state ? (
        <section className="hero" aria-label={t("游戏标题")}>
          <img className="title-art" src={asset("PIC1.PNG")} alt="" />
          <div className="title-menu">
            <h1>{t("流行之神")}<span>２</span></h1>
            <p className="title-subtitle">{t("都市传说 · 警察怪异事件")}</p>
            <nav className="start-actions" aria-label={t("开始游戏")}>
              {slots.some(s => s.id === "auto") && <button className="primary" disabled={busy} onClick={() => restore("auto")}>{t("继续游戏")}<span className="forward-arrow" aria-hidden="true">→</span></button>}
              <button className={slots.some(s => s.id === "auto") ? "secondary" : "primary"} onClick={() => start()}>{t("开始序章")}</button>
              <button className="secondary" onClick={() => setPanel("chapters")}>{t("选择章节")}</button>
            </nav>
            <p className="save-hint">{t("进度自动保存")}</p>
          </div>
        </section>
      ) : (
        <section className={`reader${state.mode === "ended" ? " reader-ended" : ""}`} aria-label={t("剧情阅读区")}>
          <div
            className={`scene-stage stage-${state.stageEffect}`}
            aria-label={t("故事场景")}
          >
            {state.mode === "logic" ? (
              <LogicBoard data={data} state={state} onChange={setState} />
            ) : state.logicVisible && getLogic(data, state) ? (
              <LogicBoard
                data={data}
                state={state}
                onChange={setState}
                readOnly
              />
            ) : (
              <svg
                key={sceneSession}
                ref={sceneSvg}
                className="scene-composition"
                viewBox="0 0 480 272"
                aria-label={t("当前故事场景")}
              >
                {Object.entries(state.layers)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .filter(([, l]) => l.alpha > 0)
                  .map(([slot, l]) => {
                    const geometry = backgroundGeometry(data, l);
                    return (
                      <image
                        key={slot}
                        href={asset(data.backgrounds[l.asset])}
                        width={geometry.width}
                        height={geometry.height}
                        transform={geometry.transform}
                        opacity={l.alpha}
                        preserveAspectRatio="none"
                      />
                    );
                  })}
                <AnimationScene data={data} state={state} />
                {Object.entries(state.sprites)
                  .sort(([, a], [, b]) => (a.z ?? 0) - (b.z ?? 0))
                  .filter(([, l]) => l.alpha > 0)
                  .map(([slot, l]) => {
                    const pic = data.sprites?.[l.asset];
                    return pic ? (
                      <image
                        key={slot}
                        href={asset(pic.file)}
                        x={l.x ?? 0}
                        y={l.y ?? 0}
                        width={Math.abs(l.width ?? pic.width)}
                        height={Math.abs(l.height ?? pic.height)}
                        opacity={l.alpha}
                        transform={
                          l.flip
                            ? `translate(${2 * (l.x ?? 0) + Math.abs(l.width ?? pic.width)} 0) scale(-1 1)`
                            : undefined
                        }
                      />
                    ) : null;
                  })}
                {state.overlay && (
                  <text x="24" y="24" fill="white" fontSize="14">
                    {g(`label.${state.overlay}`, state.overlay)}
                  </text>
                )}
              </svg>
            )}
          </div>
          <div className="dialogue-panel">
            {locale === "zh-Hans" && visibleEvidence(state).length > 0 && (
              <details className="evidence-caption" key={visibleEvidence(state).join("|")}>
                <summary>查看画面文字</summary>
                {visibleEvidence(state).map(text => <p key={text}>{text}</p>)}
              </details>
            )}
            <div className="dialogue-content">
              {state.mode === "input" ? (
                <NameInput
                  key={state.input!.field}
                  state={state}
                  onSubmit={(value) => setState(submitName(data, state, value))}
                />
              ) : state.mode === "credits" ? (
                <div className="credit-card" aria-live="polite">
                  <h2>{t("制作名单")}</h2>
                  {state.creditLines?.map((line, i) => <p key={i}>{g(`label.${line}`, line)}</p>)}
                  <button className="next primary" onClick={() => setState(advance(data, state))}>{t("继续片尾 →")}</button>
                  <button className="secondary" onClick={() => setState(run(data, { ...state, mode: "running", script: state.chapterEntry === 90001 ? 7099 : 6099, pc: 0, creditLines: [], callStack: [] }))}>{t("跳过片尾")}</button>
                </div>
              ) : state.mode === "ended" ? (
                <div className="ending">
                  <h1>
                    {!chapter
                      ? t("序章 · 已读完")
                      : t("{chapter} · 本次调查结束", { chapter: chapter?.title ?? data.title })}
                  </h1>
                  {!chapter ? (
                    <p>{t("调查才刚刚开始。")}</p>
                  ) : (
                    <p>
                      {[18401, 29000, 39000, 44142, 47099, 58102, 64502, 75090, 80101, 90701].includes(state.script)
                        ? t("本篇已读完") : t("调查告一段落")}
                      {chapter.id < 7 && <>{t("· 推理得分")}<bdi>{new Intl.NumberFormat(locale).format(readVariable(state, 10))}</bdi></>}
                      {chapter.id === 3 && state.script === 44142 && <><br />{t("另一条调查路线仍有线索，重新调查可保留已完成路线。")}</>}

                    </p>
                  )}
                  <p>
                    {!chapter
                      ? t("翻开下一份案件档案，开始调查《黒闇》。")
                      : t("可以读取存档，探索不同的选择与推理结果。")}
                  </p>
                  {nextEntry && data.scripts[nextEntry] && (
                    <button
                      className="primary"
                      onClick={() =>
                        setState(enterChapter(data, state, nextEntry))
                      }
                    >
                      {t("进入{chapter} →", { chapter: nextTitle })}
                    </button>
                  )}
                  {chapter && <button className="secondary" onClick={() => setState(enterChapter(data, state, chapter.entry))}>{t("重新调查本篇")}</button>}
                  <button className="secondary" onClick={() => setState(null)}>{t("返回标题")}</button>
                </div>
              ) : state.mode === "logic" ? (
                <p>{t("整理上方的关系图后，点击“完成整理”继续。")}</p>
              ) : state.mode === "confirm" ? (
                <div className="confirmation">
                  <p>{g(`prompt.${state.script}.${state.pc}`, state.prompt)}</p>
                  <button
                    onClick={() => setState(confirmResult(data, state, false))}
                  >
                    {saveConfirmation ? t("暂不手动保存") : t("继续修改")}
                  </button>
                  <button
                    className="primary"
                    onClick={() => { setState(confirmResult(data, state, true)); if (saveConfirmation) setPanel("saves"); }}
                  >
                    {saveConfirmation ? t("选择存档位置") : t("确认提交")}
                  </button>
                </div>
              ) : state.mode === "error" ? (
                <div className="ending">
                  <h2>{t("剧情暂时无法继续")}</h2>
                  <p role="alert">{t("暂时无法读取这段剧情，请读取之前的存档重试。")}</p>
                  <button onClick={() => setPanel("saves")}>{t("读取存档")}</button>
                </div>
              ) : (
                <>
                  <article
                    className="story-text"
                    lang={data.scripts[state.script]?.language}
                    key={state.page?.id}
                    style={{ fontSize }}
                  >
                    {state.page && <StoryText page={state.page} names={state.names} onKeyword={(id) => openCollection("keywords", id)} />}
                  </article>
                  {state.mode === "choice" ? (
                    <div className="story-choices">
                      <p className="courage">{t("勇气")} <bdi>{new Intl.NumberFormat(locale).format(readVariable(state, 8))} / {new Intl.NumberFormat(locale).format(readVariable(state, 9))}</bdi>
                      </p>
                      {state.choices.map((c, i) => (
                        <button
                          key={i}
                          disabled={
                            c.disabled || readVariable(state, 8) < c.cost
                          }
                          onClick={() => setState(choose(data, state, i))}
                        >
                          {localizeChoice(catalog, `choice.${state.script}.${state.pc}.${i}`, c, state.names)}
                          {c.cost > 0 && <small>{t("消耗 {cost} 点勇气", { cost: c.cost })}</small>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="reader-bottom">
                      <button
                        className="next primary"
                        onClick={() => setState(advance(data, state))}
                      >{t("继续")}<span className="forward-arrow" aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </>
              )}
              <CollectionFeedback page={state.mode === "page" || state.mode === "choice" ? state.page : null} data={data} session={sceneSession} onOpen={openCollection} />
              <nav className="reader-tools" aria-label={t("阅读工具")}>
                {state.logicAvailable && state.mode === "page" && (
                  <button onClick={() => setState(openLogic(state))}>{t("推理关系图")}</button>
                )}
                <button onClick={() => setPanel("history")}>{t("回看记录")}</button>
                <button onClick={() => openNotebook("keywords")}>{t("关键词手帖")}</button>
                <button onClick={() => openNotebook("terms")}>{t("术语辞典")}</button>
              </nav>
            </div>
          </div>
        </section>
      )}
      <AudioScene data={data} state={state} enabled={sound} volume={volume} />
      <audio
        ref={audio}
        src={state?.music ? asset(data.music[state.music]) : undefined}
        loop
        preload="none"
      />
      <dialog
        ref={dialog}
        aria-labelledby="panel-title"
        onKeyDown={event => {
          if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        onCancel={() => setPanel(null)}
        onClose={() => setPanel(null)}
      >
        <div className="dialog-head">
          <h2 id="panel-title">
            {
              {
                history: t("回看记录"),
                saves: t("保存与读取"),
                terms: t("已发现的术语"),
                keywords: t("关键词手帖"),
                settings: t("游戏设置"),
                chapters: t("选择章节"),
              }[panel ?? "settings"]
            }
          </h2>
          <button
            autoFocus
            aria-label={t("关闭面板")}
            onClick={() => setPanel(null)}
          >
            ×
          </button>
        </div>
        {notice && (
          <div className="panel-notice" role="status">
            {t(notice)}
            <button aria-label={t("关闭通知")} onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        <div className="dialog-body" ref={panelBody} key={panel}>
          {panel === "chapters" && <nav className="chapter-menu" aria-label={t("章节列表")}>
            {[{ title: t("本篇"), chapters: chapters?.filter(c => c.id < 4) ?? [] }, { title: t("人物篇"), chapters: chapters?.filter(c => c.id >= 4) ?? [] }].map(group => <section key={group.title}>
              <h3>{group.title}</h3>
              {group.chapters.map(c => <button key={c.id} onClick={() => start(c.entry)}>{c.title}<span className="forward-arrow" aria-hidden="true">→</span></button>)}
            </section>)}
          </nav>}

          {panel === "history" && <Backlog state={state} fontSize={fontSize} />}
          {panel === "saves" && (
            <div className="save-list">
              <p>{t("存档仅保存在此设备的当前浏览器；清除网站数据会同时清除存档。")}</p>
              {["auto", "slot1", "slot2", "slot3"].map((id, i) => {
                const slot = slots.find((s) => s.id === id);
                return (
                  <section className="save-slot" key={id} aria-labelledby={`save-${id}`}>
                    <div>
                      <h3 id={`save-${id}`}>{i === 0 ? t("自动存档") : t("手动存档 {number}", { number: i })}</h3>
                      <p>
                        {slot
                          ? `${chapters?.find(c => c.entry === slot.state.chapterEntry || (slot.state.script >= c.minScript && slot.state.script <= c.maxScript))?.title ?? t("序章")} · ${new Date(slot.savedAt).toLocaleString(locale)}`
                          : t("尚无存档")}
                      </p>
                    </div>
                    <div>
                      {i > 0 && (
                        <button
                          disabled={!canSave || busy}
                          onClick={() => save(id)}
                        >{t("保存")}</button>
                      )}
                      <button
                        disabled={!slot || busy}
                        onClick={() => restore(id)}
                      >{t("读取")}</button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {panel === "keywords" && (
            <div className="terms">
              <SearchField value={collectionQuery} onChange={setCollectionQuery} />
              <p>{t("阅读中获得的关键词记录于此，供整理推理关系时参考。")}</p>
              {!state?.flags.some(id => data.keywords?.[id]) && <p>{t("尚未获得关键词。")}</p>}
              {!!collectionQuery && !state?.flags.some(id => data.keywords?.[id] && matchesSearch(g(`keywords.${id}`, data.keywords[id]), collectionQuery)) && <p role="status">{t("没有匹配的内容")}</p>}
              <ul className="keyword-notebook">{state?.flags.filter(id => data.keywords?.[id] && matchesSearch(g(`keywords.${id}`, data.keywords[id]), collectionQuery)).reverse().sort((a, b) => Number(b === collectionFocus) - Number(a === collectionFocus)).map(id => <li className={id === collectionFocus ? "collection-selected" : undefined} key={id} dir="auto">{g(`keywords.${id}`, data.keywords![id])}</li>)}</ul>
            </div>
          )}
          {panel === "terms" && (
            <div className="terms">
              <SearchField value={collectionQuery} onChange={setCollectionQuery} />
              <p>{t("阅读中发现的术语会收录于此，可以随时查阅。")}</p>
              {!state?.unlocked.length && <p>{t("尚未发现术语。")}</p>}
              {!!collectionQuery && !state?.unlocked.some(id => matchesSearch(`${g(`terms.${id}`, data.terms[id])} ${g(`definitions.${id}`, data.definitions?.[id] ?? "")}`, collectionQuery)) && <p role="status">{t("没有匹配的内容")}</p>}
              {state?.unlocked.filter(id => matchesSearch(`${g(`terms.${id}`, data.terms[id])} ${g(`definitions.${id}`, data.definitions?.[id] ?? "")}`, collectionQuery)).reverse().sort((a, b) => Number(b === collectionFocus) - Number(a === collectionFocus)).map((id) => (
                <div className={id === collectionFocus ? "collection-selected" : undefined} key={id} dir="auto">
                  <h3>{g(`terms.${id}`, data.terms[id])}</h3>
                  <p className="term-definition">
                    {formatGameText(
                      g(`definitions.${id}`, data.definitions?.[id] ?? ""),
                      state?.names ?? ["风海", "纯也"],
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
          {panel === "settings" && (
            <div className="settings">
              <label>{t("文字大小")}<span>{fontSize <= 18 ? t("较小") : fontSize <= 22 ? t("标准") : t("较大")}</span>
                <input
                  type="range"
                  min="16"
                  max="28"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </label>
              <label>{t("声音音量")}<bdi>{new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(volume)}</bdi>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
              <button className="secondary" onClick={() => setSound(!sound)}>
                {t(sound ? "关闭游戏声音" : "开启游戏声音")}
              </button>
              <hr />
              <p>{t("键盘空格、回车或右方向键继续阅读；手机点击“继续”。关闭面板可按 Esc。")}</p>
            </div>
          )}
        </div>
      </dialog>
      {confirmation && <GameConfirmation
        title={t(confirmation.kind === "start" ? "重新开始" : "覆盖存档")}
        message={t(confirmation.kind === "start" ? "重新开始会替换自动存档。手动存档会保留。继续？" : "覆盖这个手动存档？")}
        confirmLabel={t(confirmation.kind === "start" ? "重新开始" : "保存")}
        onResolve={confirmed => {
          setConfirmation(null);
          if (!confirmed) return;
          if (confirmation.kind === "start") start(confirmation.entry, true);
          else void save(confirmation.id, true);
        }}
      />}
    </main>
  );
}
export default function App() {
  const { locale, t } = useTranslation();
  useEffect(() => { document.title = t("流行之神 2"); }, [locale, t]);
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(asset("game.json"), { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw new Error("游戏资源暂时无法加载，请稍后重试。");
        return r.json();
      })
      .then(parseGameData)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) { console.error(e); setError("游戏资源暂时无法加载，请检查网络后重试。"); }
      });
    return () => controller.abort();
  }, []);
  if (!data)
    return (
      <main className="loading">
        <h1>{t("流行之神 2")}</h1>
        <p role="status">{(error && t(error)) || t("正在加载游戏…")}</p>
        {error && <button onClick={() => location.reload()}>{t("重新加载")}</button>}
      </main>
    );
  return <Reader data={data} />;
}
