/** Extend translation corpus using the chapter's deterministic branch test strategy. */
import fs from 'node:fs';
import { stampCorpus } from './localization_provenance.mjs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createState, run, advance, choose, readVariable, getLogic, logicCondition, setAnswer, finishLogic, confirmResult } from '../src/game/engine.ts';
import { replayRoute } from './replay_route.mjs';
import { localizationRoute } from './localization_routes.mjs';
import { richKey, sourceSignature } from '../src/i18n/richText.ts';
const data=JSON.parse(fs.readFileSync('public/game/game.json','utf8'));
const executedText=new Set(), allText=[];
for(const script of Object.values(data.scripts).filter(s=>s.id>=20000&&s.id<30000)){
 for(const ins of script.instructions){if(typeof ins.text!=='string')continue;
 const text=ins.text,key=`${script.id}:${ins.offset}`;allText.push({key,text,script:script.id,offset:ins.offset});
 Object.defineProperty(ins,'text',{get(){executedText.add(key);return text;}});
 }
}
const file='output/localization/routes.jsonl';
const entries=new Map(fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse).map(e=>[e.key,e]));
const before=entries.size, choices=new Set(), pages=new Set();
let seed=7;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function inspect(s,step,trial){
 const add=(id,parts,context)=>{if(!parts?.length)return;const key=richKey(id,parts),source=sourceSignature(parts);if(entries.has(key)){assert.equal(entries.get(key).source,source);return;}entries.set(key,{key,source,...context,route:'chapter-one-branches',step,trial});};
 if(s.page){pages.add(s.page.id);add(`page.${s.page.id}`,s.page.parts,{kind:'page',script:s.page.script,page:s.page.id,text:s.page.text});}
 s.choices.forEach((c,i)=>add(`choice.${s.script}.${s.pc}.${i}`,c.parts,{kind:'choice',script:s.script,text:c.text}));
}
const trialRoutes=[];
for(let trial=0;trial<300;trial++){
 const trace=[], answersByLogic={}, confirmations=[];
 let s=run(data,{...createState(data),script:20001}),step=0;
 while(s.mode!=='ended' && step++<18000){
  assert.notEqual(s.mode,'error',s.error);inspect(s,step,trial);s.history=[];
  if(s.mode==='page')s=advance(data,s);
  else if(s.mode==='choice'){
   choices.add(`${s.script}:${s.pc}`);
   const options=s.choices.map((c,i)=>({c,i})).filter(({c})=>!c.disabled&&c.cost<=readVariable(s,8));
   assert.ok(options.length);const selected=options[Math.floor(random()*options.length)].i;trace.push([s.script,s.pc,selected]);s=choose(data,s,selected);
  }else if(s.mode==='logic'){
   inspect(finishLogic(data,{...s,answers:{}}),step,trial);
   for(const f of getLogic(data,s).fields.filter(f=>logicCondition(s,f))){const candidates=f.choices.filter(c=>c.id&&s.flags.includes(c.id));if(candidates.length)s=setAnswer(data,s,f.id,candidates[Math.floor(random()*candidates.length)].id);}
   answersByLogic[getLogic(data,s).id]={...s.answers};
   s=finishLogic(data,s);
  }else if(s.mode==='confirm'){confirmations.push(true);s=confirmResult(data,s,true);}
  else throw new Error(`Unexpected ${s.mode}`);
 }
 assert.equal(s.mode,'ended');
 trialRoutes.push({entry:20001,trace,answersByLogic,confirmations,end:s.script,randomIndex:0});
}
fs.writeFileSync('output/localization/chapter-one-trials.json',JSON.stringify({sourceSha256:data.sourceSha256,routes:trialRoutes}));
for(const kind of ['science','occult']){const filename=`chapter-one-${kind}.json`;replayRoute(data,localizationRoute(filename,JSON.parse(fs.readFileSync(`tests/fixtures/${filename}`,'utf8'))),{inspect:(s,step)=>inspect(s,step,kind)});}
const routeExecuted=executedText.size;
const isolated=[];
for(const fragment of allText.filter(t=>!executedText.has(t.key))){
 if(executedText.has(fragment.key))continue;
 const instructions=data.scripts[fragment.script].instructions;
 const at=instructions.findIndex(i=>i.offset===fragment.offset);
 let start=at;
 while(start>=0 && ![3,102].includes(instructions[start].op))start--;
 assert.ok(start>=0);
 const s=run(data,{...createState(data),script:fragment.script,pc:start});
 assert.notEqual(s.mode,'error',s.error);
 inspect(s,start,`isolated-${fragment.script}-${start}`);
 isolated.push({script:fragment.script,pc:start,offset:instructions[start].offset,mode:s.mode});
}
fs.writeFileSync('output/localization/chapter-one-source-coverage.json',JSON.stringify({gameSha256:createHash('sha256').update(fs.readFileSync('public/game/game.json')).digest('hex'),sourceSha256:data.sourceSha256,textInstructions:allText.length,routeExecuted,executed:executedText.size,isolated,missing:allText.filter(t=>!executedText.has(t.key))},null,2));
fs.writeFileSync(file,[...entries.values()].map(e=>JSON.stringify(e)).join('\n')+'\n');
console.log(JSON.stringify({added:entries.size-before,choices:choices.size,pages:pages.size,total:entries.size}));

stampCorpus(file);
