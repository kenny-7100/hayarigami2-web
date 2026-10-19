import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {locate,checkpoint,writeReport} from '../scripts/bug_workbench.mjs';
import {loadWorkbench} from '../scripts/translation_workbench.mjs';
import {createState,run,validateSave} from '../src/game/engine.ts';
const inputs=loadWorkbench('zh-Hans');
test('visible Chinese lookup is bounded, retains ambiguity and supports chapter scoping',()=>{
 const result=locate(inputs,{text:'警署',limit:2});
 assert.ok(result.total>2);assert.equal(result.matches.length,2);assert.equal(result.truncated,true);
 const scoped=locate(inputs,{text:'你 明 天 再 来',entry:70001});
 assert.ok(scoped.matches.some(m=>m.key==='page.73101:4390516.85129e09'));
 assert.ok(scoped.matches.every(m=>m.entries.includes(70001)));
 assert.equal(locate(inputs,{text:'不存在的定位测试句子xyz'}).total,0);
 assert.throws(()=>locate(inputs,{text:'  '}),/two/);
 assert.throws(()=>locate(inputs,{text:'警署',limit:51}),/limit/);
 assert.throws(()=>locate(inputs,{text:'警署',entry:2}),/real chapter/);
});
test('candidate excerpts explicitly mark truncation and never mutate catalog',()=>{
 const before=JSON.stringify(inputs.catalog.strings['definitions.173']);
 const r=locate(inputs,{text:'奇卡蒂洛',entry:70001,limit:50});
 const definition=r.matches.find(m=>m.key==='definitions.173');
 assert.ok(definition.translationExcerptTruncated);assert.ok(definition.translationExcerpt.length<=350);
 assert.equal(JSON.stringify(inputs.catalog.strings['definitions.173']),before);
});
test('reports preserve validated checkpoints and provenance, reject stale inputs and overwrites',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hs2-bug-'));
 try{
  for(const dir of ['output/qa/test','output/localization','localization/story'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,'localization/story/zh-Hans.json'),'{}');
  fs.writeFileSync(path.join(root,'output/localization/routes.jsonl'),'test');
  const base=path.join(root,'output/qa/test'),state=run(inputs.game,createState(inputs.game));
  fs.writeFileSync(path.join(base,'fixtures.json'),JSON.stringify({opening:state}));
  fs.writeFileSync(path.join(base,'report.json'),JSON.stringify({dataSha256:inputs.gameSha256}));
  assert.throws(()=>checkpoint(root,inputs,'../test','opening'),/valid/);
  assert.throws(()=>checkpoint(root,inputs,'test','absent'),/not found/);
  assert.throws(()=>writeReport(root,inputs,{id:'../escape',text:'警署'}),/id must/);
  assert.throws(()=>writeReport(root,inputs,{id:'partial',text:'警署',bundle:'test'}),/together/);
  assert.throws(()=>writeReport(root,inputs,{id:'wrong',text:'警署',entry:70001,bundle:'test',scene:'opening'}),/chapter/);
  const options={id:'test',text:'警署',bundle:'test',scene:'opening'};
  const result=writeReport(root,inputs,options);
  const report=JSON.parse(fs.readFileSync(path.join(result.directory,'report.json')));
  assert.equal(report.status,'untriaged');assert.equal(report.dataSha256,inputs.gameSha256);
  const copied=JSON.parse(fs.readFileSync(path.join(result.directory,'fixtures.json'))).repro;
  assert.deepEqual(validateSave(inputs.game,copied),state);
  assert.equal(result.url,'/tests/qa.html?bundle=bug-test&scene=repro&lang=zh-Hans');
  fs.writeFileSync(path.join(base,'fixtures.json'),JSON.stringify({opening:{...state,script:999999}}));
  assert.throws(()=>checkpoint(root,inputs,'test','opening'));
  fs.writeFileSync(path.join(base,'fixtures.json'),JSON.stringify({opening:state}));
  const before=fs.readFileSync(path.join(result.directory,'REPORT.md'));
  assert.throws(()=>writeReport(root,inputs,options),/EEXIST/);
  assert.deepEqual(fs.readFileSync(path.join(result.directory,'REPORT.md')),before);
  fs.writeFileSync(path.join(base,'report.json'),JSON.stringify({dataSha256:'stale'}));
  assert.throws(()=>writeReport(root,inputs,{...options,id:'stale'}),/Stale/);
  assert.equal(fs.existsSync(path.join(root,'output/qa/bug-stale')),false);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
