// Development-only acceptance entry; Vite production build includes only index.html.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Reader } from "../src/App";
import { parseGameData, validateSave } from "../src/game/engine";
import "../src/index.css";
import "../src/App.css";
const data = parseGameData(await (await fetch("/game/game.json")).json());
const raw = await (
  await fetch("/output/chapter-one/browser-fixtures.json")
).json();
export function Harness() {
  const params = new URLSearchParams(location.search);
  const embedded = params.has("embedded");
  const [selected, setSelected] = useState(params.get("scene") ?? "japanese");
  const [viewport, setViewport] = useState<[number, number] | null>(null);
  return (
    <>
      {!embedded && (
        <nav
          style={{
            position: "relative",
            zIndex: 100,
            background: "#fff",
            padding: 8,
            color: "#111",
          }}
          aria-label="Acceptance fixtures"
        >
          {["home", ...Object.keys(raw)].map((key) => (
            <button
              style={{ color: "#111", margin: 4 }}
              key={key}
              onClick={() => setSelected(key)}
            >
              {key}
            </button>
          ))}
          {(
            [
              [440, 956],
              [360, 740],
              [844, 390],
            ] as const
          ).map(([w, h]) => (
            <button
              key={w}
              style={{ color: "#111" }}
              onClick={() => setViewport([w, h])}
            >
              {w}×{h}
            </button>
          ))}
          <button style={{ color: "#111" }} onClick={() => setViewport(null)}>
            Desktop
          </button>
        </nav>
      )}
      {viewport ? (
        <iframe
          title="Mobile viewport"
          src={`${location.pathname}?embedded=1&scene=${selected}`}
          style={{
            display: "block",
            width: viewport[0],
            height: viewport[1],
            maxWidth: "100%",
            margin: "auto",
            border: 0,
          }}
        />
      ) : (
        <Reader
          key={selected}
          data={data}
          initialState={
            selected === "home" ? null : validateSave(data, raw[selected])
          }
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
