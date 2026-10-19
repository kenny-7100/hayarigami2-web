import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkChapterTwo,loadInputs} from '../scripts/check_chapter_two_translation.mjs';
import {inventory} from '../scripts/translation_workbench.mjs';
test('second-chapter translation gate detects missing branches, definitions, prompts and stale coverage', {skip:!fs.existsSync('output/localization/chapter-two-source-coverage.json')&&'Run npm run i18n:extract'},()=>{
 const {inputs,coverage}=loadInputs();
 assert.equal(checkChapterTwo(inputs,coverage).counts.rich.missing,0);
 const {entries}=inventory(inputs.game,inputs.corpus,30001);
 for(const e of [entries.find(e=>e.script===39999),entries.find(e=>e.key.startsWith('definitions.')),entries.find(e=>e.key.startsWith('prompt.')),entries.find(e=>e.key.startsWith('logic.4.description.'))]){
  assert.ok(e);const old=inputs.catalog[e.collection][e.key];
  delete inputs.catalog[e.collection][e.key];
  assert.throws(()=>checkChapterTwo(inputs,coverage),/Missing\/stale translation/);
  inputs.catalog[e.collection][e.key]=old;
 }
 const rich = inputs.catalog.rich[entries.find(e=>e.collection==='rich').key];
 const originalSource=rich.source;
 rich.source='[]';
 assert.throws(()=>checkChapterTwo(inputs,coverage));
 rich.source=originalSource;
 const keyword=inputs.catalog.strings['keywords.4814'];
 const originalText=keyword.text;
 keyword.text='吊架';
 assert.throws(()=>checkChapterTwo(inputs,coverage),/Keyword mismatch/);
 keyword.text=originalText;
 assert.throws(()=>checkChapterTwo(inputs,{...coverage,gameSha256:'stale'}),/Stale source coverage/);
 assert.throws(()=>checkChapterTwo(inputs,{...coverage,routeExecuted:12695}));
 assert.throws(()=>checkChapterTwo(inputs,{...coverage,isolated:[]}));
});
