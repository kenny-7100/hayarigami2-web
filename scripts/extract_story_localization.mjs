/** Collect full displayed passages from verified routes, with immutable source provenance. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createState, run, advance, submitName } from '../src/game/engine.ts';
import { richKey, sourceSignature } from '../src/i18n/richText.ts';
import { walk } from '../tests/chapter-walk.mjs';
import { replayRoute } from './replay_route.mjs';
const data = JSON.parse(readFileSync('public/game/game.json', 'utf8'));
const entries = new Map();
function add(id, parts, context) {
  if (!parts?.length) return;
  const key = richKey(id, parts);
  const signature = sourceSignature(parts);
  if (entries.has(key) && entries.get(key).source !== signature) throw new Error(`Source key collision: ${key}`);
  if (!entries.has(key)) entries.set(key, { key, source: signature, ...context });
}
function inspect(state, step, route) {
  if (state.page) add(`page.${state.page.id}`, state.page.parts, { kind: 'page', script: state.page.script, page: state.page.id, text: state.page.text, route, step });
  state.choices.forEach((choice, index) => add(`choice.${state.script}.${state.pc}.${index}`, choice.parts, { kind: 'choice', script: state.script, text: choice.text, route, step }));
  // Collection is for translation context, not persistence validation.
  state.history = [];
}
let prologue = run(data, createState(data));
for (let step = 0; step < 1000; step++) {
  inspect(prologue, step, 'prologue');
  if (prologue.mode === 'ended') break;
  if (prologue.mode === 'page') prologue = advance(data, prologue);
  else if (prologue.mode === 'input') prologue = submitName(data, prologue, prologue.names[prologue.input.field]);
  else throw new Error(`Unexpected prologue state: ${prologue.mode}`);
}
if (!process.argv.includes('--prologue-only')) {
  // Record 2 clears flag 2490 before its branch; record 4 is the documented alternate.
  // Collect it in isolation for translation, not as a reachable player route.
  let alternate = run(data, { ...createState(data), script: 4 });
  for (let step = 0; step < 1000; step++) {
    inspect(alternate, step, 'isolated-prologue-record-4');
    if (alternate.mode === 'ended') break;
    if (alternate.mode === 'page') alternate = advance(data, alternate);
    else if (alternate.mode === 'input') alternate = submitName(data, alternate, alternate.names[alternate.input.field]);
    else throw new Error(`Unexpected alternate prologue state: ${alternate.mode}`);
  }
  if (alternate.mode !== 'ended' || alternate.script !== 4) throw new Error('Alternate prologue did not reach script 4');
  for (const route of ['science', 'occult']) {
    for (const bad of [false, true]) {
      let step = 0;
      walk(route, { bundle: data, bad, inspect: state => inspect(state, step++, `chapter-zero-${route}-${bad ? 'failure' : 'success'}`) });
    }
  }
  const files = readdirSync('tests/fixtures').filter(file => /^chapter-(?:one|[2-8])-.+\.json$/.test(file));
  for (const file of files) {
    const route = JSON.parse(readFileSync(`tests/fixtures/${file}`, 'utf8'));
    if (route.entry && route.trace) replayRoute(data, route, { inspect: (state, step) => inspect(state, step, file) });
  }
  for (let chapter = 2; chapter <= 8; chapter++) {
    const fixture = JSON.parse(readFileSync(`tests/fixtures/remaining/chapter-${chapter}.json`, 'utf8'));
    fixture.routes.forEach((route, index) => replayRoute(data, route, { inspect: (state, step) => inspect(state, step, `coverage-${chapter}-${index}`) }));
  }
}
mkdirSync('output/localization', { recursive: true });
const suffix = process.argv.includes('--prologue-only') ? 'prologue' : 'routes';
writeFileSync(`output/localization/${suffix}.jsonl`, [...entries.values()].map(entry => JSON.stringify(entry)).join('\n') + '\n');
console.log(`${entries.size} distinct rich passages collected (${suffix}); not a claim of all source variants.`);
