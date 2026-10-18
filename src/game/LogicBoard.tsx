import { useRef, useState } from "react";
import type { GameData, GameState } from "./engine";
import { finishLogic, logicCondition, setAnswer, getLogic } from "./engine";
const asset = (file: string) => `${import.meta.env.BASE_URL}game/${file}`;
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
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState("");
  const [zoom, setZoom] = useState(1);
  const scrollArea = useRef<HTMLDivElement>(null);
  const diagram = getLogic(data, state);
  if (!diagram) return null;
  const fields = diagram.fields.filter((f) => logicCondition(state, f));
  const active = fields.find((f) => f.id === selected);
  return (
    <section className="logic-board" aria-label="推理关系图">
      <div className="logic-toolbar">
        <h2>推理关系图</h2>
        <label>
          缩放{" "}
          <input
            aria-label="关系图缩放"
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
        >
          查看全图
        </button>
      </div>
      <p className="logic-hint">{readOnly ? "可放大关系图，点击人物查看说明。" : "点击关系栏或从下方列表选择，填入已获得的关键词。"}</p>
      <div className="logic-scroll" ref={scrollArea}>
        <svg
          role="group"
          aria-label="案件人物与关系"
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
                diagram.descriptions[variant?.description ?? n.description];
              return (
                <g
                  key={i}
                  role={text ? "button" : undefined}
                  tabIndex={text ? 0 : undefined}
                  aria-label={text?.split("\n")[0]}
                  onClick={() => {
                    if (text) setDetail(text);
                  }}
                  onKeyDown={(e) => {
                    if (text && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setDetail(text);
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
              role="button"
              tabIndex={0}
              aria-label={`关系 ${f.id + 1}：${data.keywords?.[state.answers[f.id]] ?? "未填写"}`}
              onClick={() => setSelected(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(f.id);
                }
              }}
              className={`logic-field ${selected === f.id ? "selected" : ""}`}
            >
              <rect x={f.x - 66} y={f.y - 19} width={132} height={38} rx={5} />
              <text x={f.x} y={f.y + 6} textAnchor="middle">
                {data.keywords?.[state.answers[f.id]] ?? `关系 ${f.id + 1}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {detail && (
        <div className="logic-detail">
          <button aria-label="关闭人物说明" onClick={() => setDetail("")}>
            ×
          </button>
          <p>{detail}</p>
        </div>
      )}
      {!readOnly && (
        <div className="logic-editor">
          <label>
            选择要整理的关系{" "}
            <select
              value={selected ?? ""}
              onChange={(e) =>
                setSelected(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">请选择关系</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  关系 {f.id + 1} ·{" "}
                  {data.keywords?.[state.answers[f.id]] ?? "未填写"}
                </option>
              ))}
            </select>
          </label>
          {active && (
            <label>
              填写关键词{" "}
              <select
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
                        ? "保留空白"
                        : `${data.keywords?.[c.id]} · ${c.description}`}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {active && (
            <p>
              {
                active.choices.find(
                  (c) => c.id === (state.answers[active.id] ?? 0),
                )?.description
              }
            </p>
          )}
          <button
            className="primary"
            onClick={() => onChange(finishLogic(data, state))}
          >
            完成整理，返回剧情 →
          </button>
        </div>
      )}
    </section>
  );
}
