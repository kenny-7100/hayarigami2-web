import { shortenChartLabel } from "../i18n/format";
import { useGameText } from "../i18n/useGameText";
import { useTranslation } from "../i18n/useTranslation";
import { useRef, useState } from "react";
import type { GameData, GameState } from "./engine";
import { finishLogic, logicCondition, setAnswer, getLogic } from "./engine";
import { mediaUrl as asset } from "./media";
export default function LogicBoard({
  data,
  state,
  onChange,
  readOnly = false,
}: {
  data: GameData;
  state: GameState;
  onChange: (state: GameState) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const g = useGameText();
  const keyword = (id: number) => data.keywords?.[id] ? g(`keywords.${id}`, data.keywords[id]) : undefined;
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollArea = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const detailPanel = useRef<HTMLDivElement>(null);
  const detailTrigger = useRef<SVGGElement | null>(null);
  function selectField(id: number) {
    if (readOnly) return;
    setSelected(id);
    requestAnimationFrame(() => {
      editor.current?.scrollIntoView({ block: "nearest" });
      editor.current?.querySelector<HTMLSelectElement>('select[data-keyword-select]')?.focus({ preventScroll: true });
    });
  }
  function showDetail(id: number, trigger: SVGGElement) {
    detailTrigger.current = trigger;
    setDetail(id);
    requestAnimationFrame(() => {
      detailPanel.current?.scrollIntoView({ block: "nearest" });
      detailPanel.current?.querySelector('button')?.focus({ preventScroll: true });
    });
  }
  function closeDetail() {
    setDetail(null);
    detailTrigger.current?.focus();
  }
  const diagram = getLogic(data, state);
  if (!diagram) return null;
  const fields = diagram.fields.filter((f) => logicCondition(state, f));
  const active = fields.find((f) => f.id === selected);
  const selectedChoice = active?.choices.find(choice => choice.id === (state.answers[active.id] ?? 0));
  return (
    <section className="logic-board" aria-label={t("推理关系图")}>
      <div className="logic-toolbar">
        <h2>{t("推理关系图")}</h2>
        <label>{t("缩放")}{" "}
          <input
            aria-label={t("关系图缩放")}
            type="range"
            min="1"
            max="3"
            step="0.25"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            setZoom(1);
            scrollArea.current?.scrollTo(0, 0);
          }}
        >{t("查看全图")}</button>
      </div>
      <p className="logic-hint">{readOnly ? t("可放大关系图，点击人物查看说明。") : t("点击关系栏或从下方列表选择，填入已获得的关键词。")}</p>
      <div className="logic-scroll" ref={scrollArea}>
        <svg
          role="group"
          aria-label={t("案件人物与关系")}
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          style={{
            width: `calc(min(100%, ${(56 * diagram.width) / diagram.height}svh) * ${zoom})`,
          }}
        >
          {diagram.nodes
            .filter((n) => logicCondition(state, n))
            .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
            .map((n, i) => {
              const picture = diagram.assets[n.asset];
              if (!picture) return null;
              const variant = diagram.variants[n.description]?.find(
                (v) => v.flag === 0 || !state.flags.includes(v.flag),
              );
              const text =
                g(`logic.${diagram.id}.description.${variant?.description ?? n.description}`, diagram.descriptions[variant?.description ?? n.description] ?? "");
              return (
                <g
                  key={i}
                  role={text ? "button" : undefined}
                  tabIndex={text ? 0 : undefined}
                  aria-label={text?.split("\n")[0]}
                  onClick={(e) => {
                    if (text) showDetail(variant?.description ?? n.description, e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (text && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      showDetail(variant?.description ?? n.description, e.currentTarget);
                    }
                  }}
                >
                  <title>{text}</title>
                  <image
                    href={asset(picture.file)}
                    x={n.x}
                    y={n.y}
                    width={n.width}
                    height={n.height}
                  />
                </g>
              );
            })}
          {fields.map((f) => (
            <g
              key={f.id}
              role={readOnly ? "img" : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-pressed={readOnly ? undefined : selected === f.id}
              aria-label={t("关系 {number}：{keyword}", { number: f.id + 1, keyword: keyword(state.answers[f.id]) ?? t("未填写") })}
              onClick={() => selectField(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectField(f.id);
                }
              }}
              className={`logic-field ${readOnly ? "readonly" : ""} ${selected === f.id ? "selected" : ""}`}
            >
              <title>{keyword(state.answers[f.id]) ?? t("关系 {number}", { number: f.id + 1 })}</title>
              <rect x={f.x - 66} y={f.y - 19} width={132} height={38} rx={5} />
              <text x={f.x} y={f.y + 6} textAnchor="middle">
                {shortenChartLabel(keyword(state.answers[f.id]) ?? t("关系 {number}", { number: f.id + 1 }))}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {detail !== null && (
        <div className="logic-detail" ref={detailPanel} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeDetail(); } }}>
          <button aria-label={t("关闭人物说明")} onClick={closeDetail}>
            ×
          </button>
          <p dir="auto">{g(`logic.${diagram.id}.description.${detail}`, diagram.descriptions[detail])}</p>
        </div>
      )}
      {!readOnly && (
        <div className="logic-editor" ref={editor}>
          <label>{t("选择要整理的关系")}{" "}
            <select
              value={selected ?? ""}
              onChange={(e) =>
                setSelected(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">{t("请选择关系")}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{t("关系 {number}", { number: f.id + 1 })} ·{" "}
                  {keyword(state.answers[f.id]) ?? t("未填写")}
                </option>
              ))}
            </select>
          </label>
          {active && (
            <label>{t("填写关键词")}{" "}
              <select
                data-keyword-select
                value={state.answers[active.id] ?? 0}
                onChange={(e) =>
                  onChange(
                    setAnswer(data, state, active.id, Number(e.target.value)),
                  )
                }
              >
                {active.choices
                  .filter((c) => c.id === 0 || state.flags.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id === 0
                        ? t("保留空白")
                        : `${keyword(c.id)} · ${g(`logic.${diagram.id}.field.${active.id}.choice.${c.id}`, c.description)}`}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {active && (
            <p>
              {selectedChoice ? g(`logic.${diagram.id}.field.${active.id}.choice.${selectedChoice.id}`, selectedChoice.description) : ""}
            </p>
          )}
          <button
            className="primary"
            onClick={() => onChange(finishLogic(data, state))}
          >{t("完成整理，返回剧情 →")}</button>
        </div>
      )}
    </section>
  );
}
