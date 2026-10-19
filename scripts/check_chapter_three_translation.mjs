/** Authored coverage, not independent literary sign-off. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { inventory, loadWorkbench, progress, scopeFor } from './translation_workbench.mjs';
import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
import { translateParts } from '../src/i18n/richText.ts';
export function checkChapterThree(inputs, coverage) {
 const {game, corpus, catalog, gameSha256} = inputs;
 assert.equal(coverage.gameSha256, gameSha256, 'Stale source coverage: run npm run i18n:extract');
 assert.equal(coverage.sourceSha256, game.sourceSha256);
 validateGameCatalog(catalog, 'zh-Hans', game.sourceSha256);
 const scope=scopeFor(game,40001);
 const instructions = Object.values(game.scripts).filter(s=>scope.scripts.has(s.id)).flatMap(s=>s.instructions).filter(i=>typeof i.text==='string');
 assert.equal(instructions.length,16148,'Source changed; investigate baseline');
 assert.equal(coverage.textInstructions,instructions.length);
 assert.equal(coverage.executed,16085);
 assert.equal(coverage.routeExecuted,16085);
 assert.deepEqual(coverage.isolated,[]);
 // The unused source space slots are credit spacing, not omitted prose.
 const expectedSpaces=game.scripts[6001].instructions.filter(i=>i.text===' ').map(i=>({key:`6001:${i.offset}`,text:' ',script:6001,offset:i.offset}));
 assert.equal(expectedSpaces.length,63,'Credit spacing baseline changed');
 assert.deepEqual(coverage.missing,expectedSpaces,'Uncovered non-spacing source text');
 const {entries}=inventory(game,corpus,40001);
 const counts=progress(entries,catalog);
 assert.equal(counts.rich.required,6316,'Corpus changed; investigate baseline');
 assert.equal(counts.strings.required,509,'Static inventory changed; investigate baseline');
 for(const e of entries) assert.equal(catalog[e.collection][e.key]?.source,e.source,`Missing/stale translation: ${e.key}`);
 const normalizeKeyword = text => text.replace(/[〔〕\s]/gu, '');
 for (const e of entries.filter(e=>e.collection==='rich')) {
  for (const part of translateParts(JSON.parse(e.source),catalog.rich[e.key])) {
   if (part.keyword === undefined) continue;
   const keyword = catalog.strings[`keywords.${part.keyword}`];
   assert.ok(keyword,`Missing keyword: ${part.keyword}`);
   assert.equal(normalizeKeyword(part.text),normalizeKeyword(keyword.text),`Keyword mismatch: ${e.key} / ${part.keyword}`);
  }
 }
 return {entry:40001,counts,sourceInstructions:instructions.length,routeExecuted:coverage.routeExecuted,unexecutedCreditSpacing:expectedSpaces,isolated:coverage.isolated,status:'authored-complete; draft, not independent editorial sign-off'};
}
export function loadInputs() {
 return {inputs:loadWorkbench('zh-Hans'),coverage:JSON.parse(fs.readFileSync('output/localization/chapter-three-source-coverage.json','utf8'))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {inputs,coverage}=loadInputs(),report=checkChapterThree(inputs,coverage);
 fs.writeFileSync('output/localization/chapter-three-zh-Hans.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
