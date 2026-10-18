// Development-only acceptance entry; Vite production build includes only index.html.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Reader } from "../src/App";
import { parseGameData, validateSave } from "../src/game/engine";
import "../src/index.css";
import "../src/App.css";
const data = parseGameData(
  await (await fetch("/game/chapter-zero.json")).json(),
);
const raw = await (
  await fetch("/output/chapter-zero/browser-fixtures.json")
).json();
export function Harness() {
  const [selected, setSelected] = useState("scene");
  const [mobile, setMobile] = useState(false);
  return (
    <>
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
        {Object.keys(raw).map((key) => (
          <button
            style={{ color: "#111", margin: 4 }}
            key={key}
            onClick={() => setSelected(key)}
          >
            {key}
          </button>
        ))}
        <button style={{ color: "#111" }} onClick={() => setMobile(!mobile)}>
          440px
        </button>
      </nav>
      {mobile ? (
        <iframe
          title="Mobile viewport"
          src={location.pathname}
          style={{
            display: "block",
            width: 440,
            height: 956,
            maxWidth: "100%",
            margin: "auto",
            border: 0,
          }}
        />
      ) : (
        <Reader
          key={selected}
          data={data}
          initialState={validateSave(data, raw[selected])}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
