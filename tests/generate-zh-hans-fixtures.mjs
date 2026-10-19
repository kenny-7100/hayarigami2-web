// Real route states for Simplified Chinese editorial/layout checks; no synthetic story text.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { replayRoute } from '../scripts/replay_route.mjs';
import { localizationRoute } from '../scripts/localization_routes.mjs';
import { richKey } from '../src/i18n/richText.ts';
import { validateSave } from '../src/game/engine.ts';
const bytes = readFileSync('public/game/game.json');
const data = JSON.parse(bytes);
const batch = JSON.parse(readFileSync('localization/story-batches/chapter-one-opening-zh-Hans-002.json', 'utf8'));
const wanted = new Map([[24, 'letter-time'], [25, 'letter-threat'], [34, 'keyword-blood'], [56, 'emphasis-warning'], [93, 'emphasis-interruption']].map(([index, label]) => [batch.entries[index].key, label]));
const fixtures = {};
const route = localizationRoute('chapter-one-occult.json', JSON.parse(readFileSync('tests/fixtures/chapter-one-occult.json', 'utf8')));
replayRoute(data, route, { inspect(state) {
  if (!state.page) return;
  const label = wanted.get(richKey(`page.${state.page.id}`, state.page.parts));
  if (label && !fixtures[label]) fixtures[label] = validateSave(data, { ...state, history: state.history.slice(-100) });
}});
if (Object.keys(fixtures).length !== wanted.size) throw new Error('A translated scene is no longer reached by the reference route');
mkdirSync('output/qa/zh-hans', { recursive: true });
writeFileSync('output/qa/zh-hans/fixtures.json', JSON.stringify(fixtures));
writeFileSync('output/qa/zh-hans/report.json', JSON.stringify({ dataSha256: createHash('sha256').update(bytes).digest('hex') }));
console.log(`Prepared ${Object.keys(fixtures).join(', ')} from a real first-chapter route.`);
// Late scenes and reasoning are obtained by complete route replay, never forged flags.
for (const kind of ['science', 'occult']) {
 const filename = `chapter-one-${kind}.json`;
 let lastPage;
 replayRoute(data, localizationRoute(filename, JSON.parse(readFileSync(`tests/fixtures/${filename}`, 'utf8'))), { inspect(state) {
  if (state.mode === 'page' && Object.values(state.sprites).some(s => s.asset === 2261 && s.alpha > 0) && !fixtures['evidence-blood']) fixtures['evidence-blood'] = validateSave(data, { ...state, history: state.history.slice(-100) });
  if (state.mode === 'page') lastPage = validateSave(data, { ...state, history: state.history.slice(-100) });
  if (state.mode === 'logic' && !fixtures[`${kind}-logic`]) fixtures[`${kind}-logic`] = validateSave(data, { ...state, history: state.history.slice(-100) });
  if (state.mode === 'confirm' && !fixtures[`${kind}-confirm`]) fixtures[`${kind}-confirm`] = validateSave(data, { ...state, history: state.history.slice(-100) });
  if (state.mode === 'choice' && state.script > 27000 && !fixtures[`${kind}-late-choice`]) fixtures[`${kind}-late-choice`] = validateSave(data, { ...state, history: state.history.slice(-100) });
 }});
 fixtures[`${kind}-ending`] = lastPage;
}
// Explicit layout boundary: a real source label on a real scene snapshot, not a reachable story assertion.
fixtures['overlay-label-layout'] = validateSave(data, { ...fixtures['evidence-blood'], overlay: data.scripts[23081].instructions.find(i => i.op === 1401).label });
writeFileSync('output/qa/zh-hans/fixtures.json', JSON.stringify(fixtures));
console.log(`Extended checkpoints: ${Object.keys(fixtures).join(', ')}`);
