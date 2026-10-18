import { writeFileSync, mkdirSync } from "node:fs";
import { walk } from "./chapter-walk.mjs";
const fixtures = {};
const { state } = walk("science", {
  inspect: (s) => {
    const put = (key) => {
      if (!fixtures[key])
        fixtures[key] = { ...s, history: s.history.slice(-10) };
    };
    if (s.mode === "choice" && s.choices.some((c) => c.cost > 0)) put("choice");
    if (s.mode === "logic")
      fixtures.logic = { ...s, history: s.history.slice(-10) };
    if (s.mode === "confirm") put("confirm");
    if (
      s.mode === "page" &&
      Object.values(s.sprites).some((l) => l.alpha > 0) &&
      Object.values(s.layers).some((l) => l.alpha > 0)
    )
      put("scene");
  },
});
fixtures.ending = state;
mkdirSync("output/chapter-zero", { recursive: true });
writeFileSync(
  "output/chapter-zero/browser-fixtures.json",
  JSON.stringify(fixtures),
);
console.log(Object.keys(fixtures));
