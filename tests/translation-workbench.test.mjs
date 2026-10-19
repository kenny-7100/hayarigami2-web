import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inventory,prepareTask,checkTask,mergeTask,applyTaskFile,loadWorkbench,progress } from '../scripts/translation_workbench.mjs';
import { sha256,stampCorpus,verifyCorpus } from '../scripts/localization_provenance.mjs';
import { richKey,sourceSignature } from '../src/i18n/richText.ts';
import { replayContext } from '../scripts/translation_context.mjs';
import { localizationRoute } from '../scripts/localization_routes.mjs';
function fixture() {
 const parts=[{text:'名前',name:0},{text:'8時に来る。'}];
 const game={sourceSha256:'test',chapters:[{id:1,entry:20001,title:'一',minScript:20000,maxScript:29999}],scripts:{20001:{id:20001,instructions:[{op:1310,label:'決定？',offset:10},{op:2013,args:[52]},{op:1401,label:'検証１',offset:20}]}},keywords:{},terms:{52:'名前'},definitions:{52:'{surname}さん'},logics:{}};
 const corpus=[{key:richKey('page.20001:10',parts),source:sourceSignature(parts),text:'名前8時に来る。',kind:'page',script:20001,route:'test',trial:1,step:2}];
 return {game,corpus,catalog:{locale:'zh-Hans',sourceSha256:'test',rich:{},strings:{}},gameSha256:sha256(JSON.stringify(game)),glossary:{rules:[]}};
}
test('inventory includes confirmation, overlay, dictionary, chapter and transitive 32-bit dependencies',()=>{
 const i=fixture();i.game.scripts[20001].instructions.push({op:1301,args:[6100,0]});i.game.scripts[6100]={id:6100,instructions:[{op:1401,label:'Staff'}]};
 const keys=inventory(i.game,i.corpus,20001).entries.map(e=>e.key);
 for(const k of ['prompt.20001.1','label.検証１','definitions.52','terms.52','chapter.1.title','label.Staff'])assert.ok(keys.includes(k),k);
 assert.throws(()=>inventory(i.game,i.corpus,1),/Missing script/);
 assert.throws(()=>inventory(i.game,i.corpus,2),/real chapter entry/);
});
test('bounded tasks retain required refs, translated neighbors and separate trials',()=>{
 const i=fixture(),e=i.corpus[0];
 i.corpus.push({...e,key:'other',trial:2});
 const t=prepareTask(i,{entry:20001,limit:1});
 assert.equal(t.entries.length,1);assert.equal(t.entries[0].requiredRefs[0].name,0);
 assert.equal(t.entries[0].context.length,1);
 assert.throws(()=>prepareTask(i,{entry:20001,maxChars:0}),/chars/);
 assert.throws(()=>prepareTask(i,{entry:20001,key:'absent'}),/Key/);
});
test('structural validation catches erased names, placeholders, source drift and duplicate keys',()=>{
 const i=fixture(),t=prepareTask(i,{entry:20001});
 t.entries[0].translation={parts:[{text:'八点来。'}]};assert.match(checkTask(i,t).errors[0].message,/reference|name/);
 t.entries[0].translation={parts:[{ref:0},{text:'8点来。'}]};assert.equal(checkTask(i,t).canApply,true);
 assert.equal(mergeTask(i,t).rich[t.entries[0].key].status,'draft');
 const dup=structuredClone(t);dup.entries.push(dup.entries[0]);assert.match(checkTask(i,dup).errors[0].message,/Duplicate/);
 t.gameSha256='old';assert.throws(()=>checkTask(i,t),/fingerprint/);
 const s=prepareTask(i,{entry:20001,key:'definitions.52'});s.entries[0].translation={text:'姓名先生'};assert.match(checkTask(i,s).errors[0].message,/placeholders/);
 s.entries[0].translation={text:'{surname}先生'};assert.equal(checkTask(i,s).canApply,true);
});
test('numbers, kana and glossary findings need contextual notes, never auto-rewrite',()=>{
 const i=fixture();i.glossary.rules=[{id:'test',source:['時'],preferred:'八',avoid:['伯父']}];
 const t=prepareTask(i,{entry:20001});t.entries[0].translation={parts:[{ref:0},{text:'伯父9点あ'}]};
 const report=checkTask(i,t);assert.equal(report.warnings.length,3);assert.equal(report.canApply,false);
 t.entries[0].notes='测试：记录源文数字、专名和亲属关系的具体核查原因。';assert.equal(checkTask(i,t).canApply,true);
});
test('revisions require unchanged base translation, while disjoint work can merge',()=>{
 const i=fixture(),a=prepareTask(i,{entry:20001,key:'terms.52'}),b=prepareTask(i,{entry:20001,key:'definitions.52'});
 a.entries[0].translation={text:'姓名'};b.entries[0].translation={text:'{surname}先生'};
 i.catalog=mergeTask(i,a);i.catalog=mergeTask(i,b);
 assert.match(checkTask(i,a).errors[0].message,/conflict/);
 const revision=prepareTask(i,{entry:20001,key:'terms.52'});revision.entries[0].translation.text='人名';revision.entries[0].notes='统一词条标题';
 assert.equal(mergeTask(i,revision).strings['terms.52'].text,'人名');
 assert.equal(progress(inventory(i.game,i.corpus,20001).entries,i.catalog).strings.draft,2);
});
test('atomic apply archives task, preserves unrelated changes, refuses lock and stale provenance',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hs2-translation-'));
 try{
  const i=fixture();for(const dir of ['public/game','output/localization','localization/story'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  const gameFile=path.join(root,'public/game/game.json'),corpusFile=path.join(root,'output/localization/routes.jsonl'),catalogFile=path.join(root,'localization/story/zh-Hans.json');
  fs.writeFileSync(gameFile,JSON.stringify(i.game));fs.writeFileSync(corpusFile,i.corpus.map(e=>JSON.stringify(e)).join('\n'));fs.writeFileSync(catalogFile,JSON.stringify(i.catalog));stampCorpus(corpusFile,gameFile);
  const t=prepareTask(loadWorkbench('zh-Hans',root),{entry:20001,key:'terms.52'});t.entries[0].translation={text:'姓名'};
  fs.writeFileSync(`${catalogFile}.lock`,'');assert.throws(()=>applyTaskFile(root,'zh-Hans',t),/EEXIST/);fs.unlinkSync(`${catalogFile}.lock`);
  const result=applyTaskFile(root,'zh-Hans',t);assert.ok(fs.existsSync(result.archive));assert.equal(JSON.parse(fs.readFileSync(catalogFile)).strings['terms.52'].text,'姓名');
  const before=fs.readFileSync(catalogFile);assert.throws(()=>applyTaskFile(root,'zh-Hans',t),/conflict/);assert.deepEqual(fs.readFileSync(catalogFile),before);
  assert.equal(fs.existsSync(`${catalogFile}.lock`),false);
  fs.appendFileSync(corpusFile,'\n');assert.throws(()=>loadWorkbench('zh-Hans',root),/provenance/);
  assert.throws(()=>verifyCorpus(Buffer.from('x'),Buffer.from('{}'),{}),/provenance/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('all production chapter inventories resolve; first-chapter static labels are included',()=>{
 const i=loadWorkbench('zh-Hans');for(const c of i.game.chapters)assert.ok(inventory(i.game,i.corpus,c.entry).entries.length);
 const entries=inventory(i.game,i.corpus,20001).entries;
 assert.equal(entries.filter(e=>e.collection==='rich').length,6050);
 assert.ok(entries.some(e=>e.key==='label.【検証１】'));
});
test('actual route context reconstructs consecutive stops and validates the whole route',()=>{
 const i=loadWorkbench('zh-Hans');const filename='chapter-one-science.json';
 const route=localizationRoute(filename,JSON.parse(fs.readFileSync(`tests/fixtures/${filename}`,'utf8')));
 const key=i.corpus.find(e=>e.script>=20000&&e.script<30000).key;
 const report=replayContext(i.game,i.catalog,route,key,{radius:2});assert.ok(report.stops.length>=3);
 for(let n=1;n<report.stops.length;n++)assert.equal(report.stops[n].step,report.stops[n-1].step+1);
 assert.ok(report.stops.some(s=>s.page?.key===key));
 assert.throws(()=>replayContext(i.game,i.catalog,{...route,end:123},key),/ending|Expected|123/);
});
