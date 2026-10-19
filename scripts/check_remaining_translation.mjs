/** Simplified Chinese authored coverage; independent editorial sign-off remains separate. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {loadWorkbench,inventory,progress,scopeFor} from './translation_workbench.mjs';
import {translateParts} from '../src/i18n/richText.ts';
export const baselines={
 1:[53,10,139,118,139,9],10001:[5042,293,12380,12380,12380,0],
 50001:[1740,171,4309,4155,4309,51],60001:[2502,179,6335,6334,6335,1],
 70001:[2333,249,5463,5185,5463,99],80001:[35,3,196,196,196,0],
 90001:[277,204,789,725,725,0],
};
export function checkRemaining(inputs,reports){
 const {game,corpus,catalog,gameSha256}=inputs,results=[];
 assert.equal(catalog.locale,'zh-Hans');
 for(const [entryString,baseline] of Object.entries(baselines)){
  const entry=Number(entryString),coverage=reports[entry];
  assert.equal(coverage.entry,entry);assert.equal(coverage.gameSha256,gameSha256,'Stale source coverage');
  assert.equal(coverage.sourceSha256,game.sourceSha256);
  const scope=scopeFor(game,entry),instructions=[...scope.scripts].flatMap(id=>game.scripts[id].instructions.filter(i=>typeof i.text==='string').map(i=>({...i,script:id})));
  assert.equal(instructions.length,baseline[2],'Source inventory changed');
  assert.deepEqual([coverage.textInstructions,coverage.routeExecuted,coverage.executed,coverage.isolated.length],baseline.slice(2),'Source execution baseline changed');
  const spaces=entry===90001?game.scripts[7000].instructions.filter(i=>i.text===' ').map(i=>({key:`7000:${i.offset}`,text:' ',script:7000,offset:i.offset})):[];
  if(entry===90001){assert.equal(spaces.length,64);assert.equal(spaces[0].offset,4627448);assert.equal(spaces.at(-1).offset,4632388);}
  assert.deepEqual(coverage.missing,spaces,'Uncovered non-spacing text');
  for(const isolated of coverage.isolated){
   const ins=game.scripts[isolated.script]?.instructions[isolated.pc];
   assert.ok(scope.scripts.has(isolated.script));
   if(isolated.script===75026&&isolated.pc===0&&isolated.answers){assert.deepEqual(isolated.answers,{6:5230});continue;}
   assert.equal(ins?.offset,isolated.offset);
   assert.ok([3,102].includes(ins.op)||isolated.script===75026,'Unrecognized isolated entry');
  }
  const {entries}=inventory(game,corpus,entry),counts=progress(entries,catalog);
  assert.deepEqual([counts.rich.required,counts.strings.required],baseline.slice(0,2),'Translation inventory changed');
  for(const e of entries){
   assert.equal(catalog[e.collection][e.key]?.source,e.source,`Missing/stale translation: ${e.key}`);
   if(e.collection!=='rich')continue;
   for(const p of translateParts(JSON.parse(e.source),catalog.rich[e.key]))if(p.keyword!==undefined){
    const text=catalog.strings[`keywords.${p.keyword}`]?.text;
    assert.equal(p.text.replace(/[〔〕\s]/gu,''),text?.replace(/[〔〕\s]/gu,''),`Keyword mismatch: ${e.key} / ${p.keyword}`);
   }
  }
  results.push({entry,counts,sourceInstructions:instructions.length,routeExecuted:coverage.routeExecuted,isolated:coverage.isolated,creditSpaces:spaces.length});
 }
 return {status:'authored-complete; draft, not independent editorial sign-off',chapters:results};
}
export function loadReports(){return Object.fromEntries(Object.keys(baselines).map(entry=>[entry,JSON.parse(fs.readFileSync(`output/localization/remaining-${entry}-source-coverage.json`))]));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=checkRemaining(loadWorkbench('zh-Hans'),loadReports());
 fs.writeFileSync('output/localization/remaining-zh-Hans.json',JSON.stringify(report,null,2)+'\n');
 console.log(report.chapters.map(({entry,counts,sourceInstructions,routeExecuted,creditSpaces})=>({entry,counts,sourceInstructions,routeExecuted,creditSpaces})));
}
