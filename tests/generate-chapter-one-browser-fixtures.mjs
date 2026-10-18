import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { sceneFixtures } from "./scene-fixtures.mjs";
import { walk } from "./chapter-walk.mjs";
import { walkOne } from "./chapter-one-walk.mjs";
const fixtures = sceneFixtures(
  JSON.parse(readFileSync("public/game/game.json")),
);
function captureAnimation(s) {
  if (s.mode !== "page") return;
  for (const a of Object.values(s.animations)) {
    const key = {
      200: "rain",
      600: "tunnel",
      700: "cctv",
      1000: "daydrive",
      8: "thought",
      5400: "lights",
    }[a.id];
    if (key && a.alpha > 0 && !fixtures[key])
      fixtures[key] = { ...s, history: s.history.slice(-10) };
  }
}
const success = walkOne("science", {
  inspect: (s) => {
    captureAnimation(s);
    const put = (key) => {
      if (!fixtures[key])
        fixtures[key] = { ...s, history: s.history.slice(-10) };
    };
    if (s.script === 20201 && s.mode === "page") put("japanese");
    if (s.mode === "choice" && s.choices.some((c) => c.cost > 0)) put("choice");
    if (s.mode === "logic") put("logic");
    if (s.mode === "confirm") put("confirm");
  },
});
fixtures.ending = success.state;
fixtures.failure = walkOne("science", { bad: true, fullHistory: false }).state;
fixtures.zeroEnding = walk("science", { inspect: captureAnimation }).state;
mkdirSync("output/chapter-one", { recursive: true });
writeFileSync(
  "output/chapter-one/browser-fixtures.json",
  JSON.stringify(fixtures),
);
console.log(Object.keys(fixtures));
