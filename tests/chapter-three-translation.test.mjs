import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkChapterThree,loadInputs} from '../scripts/check_chapter_three_translation.mjs';
import {inventory} from '../scripts/translation_workbench.mjs';
test('final-chapter translation gate detects missing branches, definitions, prompts and stale coverage', {skip:!fs.existsSync('output/localization/chapter-three-source-coverage.json')&&'Run npm run i18n:extract'},()=>{
 const {inputs,coverage}=loadInputs();
 assert.equal(checkChapterThree(inputs,coverage).counts.rich.missing,0);
 const {entries}=inventory(inputs.game,inputs.corpus,40001);
 for(const e of [entries.find(e=>e.script===45099),entries.find(e=>e.key.startsWith('definitions.')),entries.find(e=>e.key.startsWith('prompt.')),entries.find(e=>e.key.startsWith('logic.5.description.'))]){
  assert.ok(e);const old=inputs.catalog[e.collection][e.key];
  delete inputs.catalog[e.collection][e.key];
  assert.throws(()=>checkChapterThree(inputs,coverage),/Missing\/stale translation/);
  inputs.catalog[e.collection][e.key]=old;
 }
 const rich = inputs.catalog.rich[entries.find(e=>e.collection==='rich').key];
 const originalSource=rich.source;
 rich.source='[]';
 assert.throws(()=>checkChapterThree(inputs,coverage));
 rich.source=originalSource;
 const keyword=inputs.catalog.strings['keywords.4926'];
 const originalText=keyword.text;
 keyword.text='双人房';
 assert.throws(()=>checkChapterThree(inputs,coverage),/Keyword mismatch/);
 keyword.text=originalText;
 assert.throws(()=>checkChapterThree(inputs,{...coverage,gameSha256:'stale'}),/Stale source coverage/);
 assert.throws(()=>checkChapterThree(inputs,{...coverage,routeExecuted:16148}));
 assert.throws(()=>checkChapterThree(inputs,{...coverage,missing:[]}));
 assert.throws(()=>checkChapterThree(inputs,{...coverage,missing:[...coverage.missing,{script:40001,offset:0,text:'未采集对白'}]}));
});
