import { createState, run, advance } from "../src/game/engine.ts";
export function sceneFixtures(data) {
  const fixtures = {};
  let state = run(data, { ...createState(data), script: 10201 });
  const match = {
    panorama: "我的办公室位于",
    office: "阴暗的房间里没有窗户",
    shelves: "灰色的书架上摆满了",
    dark: "可是……我不知道那是否",
  };
  for (let i = 0; i < 30 && state.mode === "page"; i++) {
    for (const [key, text] of Object.entries(match)) {
      if (state.page.text.includes(text)) fixtures[key] = state;
    }
    if (Object.keys(fixtures).length === 4) return fixtures;
    state = advance(data, state);
  }
  throw new Error("Screenshot scene fixtures missing");
}
