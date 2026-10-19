import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createState, run, advance, submitName, validateSave } from "../src/game/engine.ts";
import { replayRoute } from "../scripts/replay_route.mjs";
const bytes = readFileSync("public/game/game.json");
const data = JSON.parse(bytes);
const fixtures = {};
const targets = new Map([
  ["1:55172", "opening-car"],
  ["1:56136", "friend"],
  ["3:61528", "dictionary"],
  ["10101:63832", "gods"],
  ["10101:65592", "chapter-title"],
  ["10201:67532", "police"],
  ["10201:67764", "panorama"],
  ["10201:67960", "office"],
]);
for (const entry of [1, 10001]) {
  let s = run(data, { ...createState(data), script: entry });
  for (let i = 0; i < 60 && ["page", "input"].includes(s.mode); i++) {
    const name = targets.get(s.page?.id);
    if (name) fixtures[name] = validateSave(data, s);
    if (name === "office") break;
    s = s.mode === "input" ? submitName(data, s, s.names[s.input.field]) : advance(data, s);
  }
}
if (Object.keys(fixtures).length !== targets.size) throw new Error("Missing reported scenes");
fixtures["police-legacy"] = structuredClone(fixtures.police);
delete fixtures["police-legacy"].readingLayers;
replayRoute(data, { entry: 20001, ...JSON.parse(readFileSync("tests/fixtures/chapter-one-occult.json")) }, {
  inspect(s) {
    if (s.page?.id === "20756:1627476") fixtures["falling-pole"] = validateSave(data, s);
  },
});
if (!fixtures["falling-pole"]) throw new Error("Missing falling-pole route checkpoint");
mkdirSync("output/qa/black-scenes", { recursive: true });
writeFileSync("output/qa/black-scenes/fixtures.json", JSON.stringify(fixtures));
writeFileSync("output/qa/black-scenes/report.json", JSON.stringify({
  dataSha256: createHash("sha256").update(bytes).digest("hex"),
}));
console.log(Object.keys(fixtures));
