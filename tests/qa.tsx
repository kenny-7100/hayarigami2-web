// Development-only viewer. Production Vite entry remains index.html.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Reader } from "../src/App";
import { parseGameData, validateSave } from "../src/game/engine";
import type { GameData, GameState } from "../src/game/engine";
import "../src/index.css";
import "../src/App.css";
const params = new URLSearchParams(location.search);
const bundle = params.get("bundle") ?? "one-science";
export function Harness({
  data,
  fixtures,
}: {
  data: GameData;
  fixtures: Record<string, GameState>;
}) {
  const [selected, setSelected] = useState(
    params.get("scene") ?? Object.keys(fixtures)[0],
  );
  const [viewport, setViewport] = useState<[number, number] | null>(null);
  const embedded = params.has("embedded");
  const current = fixtures[selected];
  return (
    <>
      {!embedded && (
        <nav
          aria-label="验收工具"
          style={{
            padding: 12,
            background: "#25342d",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label>
            检查点{" "}
            <select
              aria-label="检查点"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ maxWidth: "70vw", padding: 10 }}
            >
              <option value="home">首页</option>
              {Object.keys(fixtures).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              [360, 740],
              [440, 956],
              [844, 390],
            ] as const
          ).map(([w, h]) => (
            <button key={w} onClick={() => setViewport([w, h])}>
              {w}×{h}
            </button>
          ))}
          <button onClick={() => setViewport(null)}>桌面</button>
          <span>
            {bundle}
            {current
              ? ` · ${current.script}:${current.pc} · ${current.mode}`
              : ""}
          </span>
        </nav>
      )}
      {viewport ? (
        <iframe
          title="验收视口"
          key={`${selected}-${viewport.join("-")}`}
          src={`?bundle=${bundle}&embedded=1&scene=${encodeURIComponent(selected)}`}
          style={{
            display: "block",
            border: 0,
            width: viewport[0],
            height: viewport[1],
            maxWidth: "100%",
            margin: "auto",
          }}
        />
      ) : selected === "home" || current ? (
        <Reader key={selected} data={data} initialState={current ?? null} />
      ) : (
        <p role="alert">找不到检查点：{selected}</p>
      )}
    </>
  );
}
async function load() {
  if (!/^[a-z0-9-]+$/.test(bundle)) throw new Error("检查包名称无效");
  const paths = [
    "/game/game.json",
    `/output/qa/${bundle}/fixtures.json`,
    `/output/qa/${bundle}/report.json`,
  ];
  const texts = await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(path);
      if (!response.ok)
        throw new Error(`读取失败：${path}；请先运行 qa:replay。`);
      return response.text();
    }),
  );
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texts[0])),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== JSON.parse(texts[2]).dataSha256)
    throw new Error(
      "验收检查点与当前 game.json 不匹配，请重新运行 qa:replay，避免验证旧资源。",
    );
  const data = parseGameData(JSON.parse(texts[0]));
  const fixtures = Object.fromEntries(
    Object.entries(JSON.parse(texts[1])).map(([key, value]) => [
      key,
      validateSave(data, value),
    ]),
  );
  return <Harness data={data} fixtures={fixtures} />;
}
const root = createRoot(document.getElementById("root")!);
load()
  .then((element) => root.render(element))
  .catch((error) =>
    root.render(
      <main className="loading">
        <h1>验收包无法载入</h1>
        <p role="alert">{String(error.message)}</p>
      </main>,
    ),
  );
