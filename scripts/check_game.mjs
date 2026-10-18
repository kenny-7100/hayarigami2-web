/** Read-only generated-package audit. Run with Node's TypeScript stripping. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseGameData } from "../src/game/engine.ts";

export function checkGame(data, directory) {
  const errors = [],
    files = new Set();
  const fail = (message) => errors.push(message);
  function file(name, dimensions) {
    if (typeof name !== "string" || !name) {
      fail(`Invalid file reference: ${name}`);
      return;
    }
    const path = resolve(directory, name),
      rel = relative(resolve(directory), path);
    if (isAbsolute(rel) || rel.startsWith("..")) {
      fail(`Asset escapes package: ${name}`);
      return;
    }
    files.add(name);
    if (!existsSync(path)) {
      fail(`Missing asset: ${name}`);
      return;
    }
    const bytes = readFileSync(path);
    if (!bytes.length) fail(`Empty asset: ${name}`);
    if (
      name.endsWith(".png") &&
      (bytes.length < 24 ||
        bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    )
      fail(`Invalid PNG: ${name}`);
    else if (
      name.endsWith(".png") &&
      dimensions &&
      (bytes.readUInt32BE(16) !== dimensions.width ||
        bytes.readUInt32BE(20) !== dimensions.height)
    )
      fail(`PNG dimensions disagree with metadata: ${name}`);
  }
  for (const key of [
    "backgrounds",
    "music",
    "effects",
    "ambient",
    "loops",
    "secondary",
  ])
    for (const name of Object.values(data[key] ?? {})) file(name);
  for (const key of ["sprites", "backgroundTextures"])
    for (const texture of Object.values(data[key] ?? {}))
      file(texture.file, texture);
  const logics = Object.values(
    data.logics ?? (data.logic ? { [data.logic.id]: data.logic } : {}),
  );
  for (const logic of logics) {
    for (const texture of Object.values(logic.assets))
      file(texture.file, texture);
    for (const node of logic.nodes)
      if (!logic.assets[node.asset])
        fail(`Logic ${logic.id} missing asset ${node.asset}`);
  }
  for (const [id, animation] of Object.entries(data.animationData ?? {})) {
    for (const texture of Object.values(animation.textures))
      file(texture.file, texture);
    for (const cell of animation.cells)
      if (cell && !animation.textures[cell.texture])
        fail(`Animation ${id} missing texture ${cell.texture}`);
  }
  const resources = {
    401: "backgrounds",
    904: "music",
    909: "ambient",
    914: "effects",
    920: "loops",
    925: "secondary",
    2201: "sprites",
    2013: "terms",
    2001: "keywords",
  };
  for (const script of Object.values(data.scripts))
    for (const [pc, t] of script.instructions.entries()) {
      const site = `${script.id}:${pc} @0x${t.offset.toString(16)}`;
      if (t.text?.includes("\ufffd") || t.label?.includes("\ufffd"))
        fail(`${site}: Unicode replacement character`);
      const id = t.args?.[0],
        key = resources[t.op];
      if (
        key &&
        data[key]?.[id] === undefined &&
        !(t.op === 914 && data.silentEffects?.includes(id)) &&
        !(t.op === 909 && data.silentAmbient?.includes(id)) &&
        !(t.op === 920 && data.silentLoops?.includes(id)) &&
        !(t.op === 904 && data.silentMusic?.includes(id))
      )
        fail(`${site}: missing ${key}:${id}`);
      if (t.op === 401 && !data.backgroundTextures?.[id])
        fail(`${site}: missing native background dimensions ${id}`);
      if (t.op === 101 || t.op === 1301) {
        const target = id + (t.args[1] ?? 0) * 65536;
        if (!data.scripts[target])
          fail(`${site}: missing jump target ${target}`);

      }
      if (t.op === 2403 && !data.animationData?.[id]?.variants[t.args[1]])
        fail(`${site}: missing animation ${id}:${t.args[1]}`);
    }
  for (const chapter of data.chapters ?? []) {
    if (!data.scripts[chapter.entry])
      fail(`Missing chapter entry ${chapter.entry}`);
    if (chapter.next && !data.scripts[chapter.next])
      fail(`Missing next chapter entry ${chapter.next}`);
  }
  return {
    ok: errors.length === 0,
    scriptCount: Object.keys(data.scripts).length,
    assetFiles: files.size,
    errors,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const path = resolve(process.argv[2] ?? "public/game/game.json");
    const data = parseGameData(JSON.parse(readFileSync(path)));
    const result = checkGame(data, dirname(path));
    const source = "output/extracted/story.dat";
    if (
      existsSync(source) &&
      createHash("sha256").update(readFileSync(source)).digest("hex") !==
        data.sourceSha256
    ) {
      result.errors.push(
        "Source story.dat hash differs from compiled package; regenerate assets",
      );
      result.ok = false;
    }
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(
      `Package check failed: ${error.message}\nPrepare resources with npm run prepare:game.`,
    );
    process.exitCode = 1;
  }
}
