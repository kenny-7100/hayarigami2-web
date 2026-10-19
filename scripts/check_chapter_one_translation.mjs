/** Chapter-scoped authored-translation gate. Editorial review is reported separately. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
export function checkChapterOne({ game, chapter, catalog, routes, coverage, gameSha256 }) {
  validateGameCatalog(catalog, 'zh-Hans', game.sourceSha256);
  assert.equal(coverage.gameSha256, gameSha256, 'Stale source coverage: run npm run i18n:extract');
  assert.equal(coverage.sourceSha256, game.sourceSha256);
  const instructions = Object.values(game.scripts).filter(s => s.id >= 20000 && s.id < 30000).flatMap(s => s.instructions).filter(i => typeof i.text === 'string');
  assert.equal(coverage.textInstructions, instructions.length);
  assert.equal(coverage.executed, instructions.length);
  assert.deepEqual(coverage.missing, []);
  const passages = routes.filter(e => e.script >= 20000 && e.script < 30000);
  assert.equal(passages.length, 6050, 'First-chapter corpus changed; investigate before updating baseline');
  for (const e of passages) assert.equal(catalog.rich[e.key]?.source, e.source, `Missing/stale translation: ${e.key}`);
  const required = [];
  for (const collection of ['keywords', 'terms', 'definitions']) {
    for (const [id, source] of Object.entries(chapter[collection])) required.push([`${collection}.${id}`, source]);
  }
  const logic = game.logics[3];
  for (const [id, source] of Object.entries(logic.descriptions)) required.push([`logic.3.description.${id}`, source]);
  for (const field of logic.fields) for (const c of field.choices) if(c.description.trim()) required.push([`logic.3.field.${field.id}.choice.${c.id}`, c.description]);
  const labels = new Set(Object.values(game.scripts).filter(s => s.id >= 20000 && s.id < 30000).flatMap(s => s.instructions).filter(i => i.op === 1401 && i.label).map(i => i.label));
  for (const label of labels) required.push([`label.${label}`, label]);
  required.push(['prompt.23000.139', game.scripts[23000].instructions[138].label]);
  for (const [key, source] of required) {
    assert.equal(typeof source, 'string', `Invalid source: ${key}`);
    assert.equal(catalog.strings[key]?.source, source, `Missing/stale translation: ${key}`);
  }
  return { chapter: 20001, rich: passages.length, plain: required.length, sourceInstructions: instructions.length, routeExecuted: coverage.routeExecuted, isolatedBlocks: coverage.isolated, reviewed: passages.filter(e => catalog.rich[e.key].status === 'reviewed').length, status: 'authored-complete; editorial review tracked separately' };
}
export function loadInputs() {
  const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  return { game: read('public/game/game.json'), chapter: read('public/game/chapter-one.json'), catalog: read('localization/story/zh-Hans.json'), routes: fs.readFileSync('output/localization/routes.jsonl','utf8').trim().split('\n').map(JSON.parse), coverage: read('output/localization/chapter-one-source-coverage.json'), gameSha256: createHash('sha256').update(fs.readFileSync('public/game/game.json')).digest('hex') };
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const report = checkChapterOne(loadInputs());
 fs.writeFileSync('output/localization/chapter-one-zh-Hans.json', JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
