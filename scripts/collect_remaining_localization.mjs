/** Extend translation corpus using the chapter's deterministic branch test strategy. */
import fs from 'node:fs';
import { scopeFor } from './translation_workbench.mjs';
import { stampCorpus } from './localization_provenance.mjs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createState, run, advance, choose, readVariable, getLogic, logicCondition, setAnswer, finishLogic, confirmResult, submitName } from '../src/game/engine.ts';
import { replayRoute } from './replay_route.mjs';
import { walk } from '../tests/chapter-walk.mjs';
import { richKey, sourceSignature } from '../src/i18n/richText.ts';
const entry=Number(process.argv[2]);
assert.ok([1,10001,50001,60001,70001,80001,90001].includes(entry),'Pass a remaining chapter entry');
const chapter=entry===1?-1:Math.floor(entry/10000)-1;
const prefix=`remaining-${entry}`;
const data=JSON.parse(fs.readFileSync('public/game/game.json','utf8'));
const executedText=new Set(), allText=[];
const scope=scopeFor(data,entry);
for(const script of Object.values(data.scripts).filter(s=>scope.scripts.has(s.id))){
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
 const add=(id,parts,context)=>{if(!parts?.length)return;const key=richKey(id,parts),source=sourceSignature(parts);if(entries.has(key)){assert.equal(entries.get(key).source,source);return;}entries.set(key,{key,source,...context,route:`${prefix}-branches`,step,trial});};
 if(s.page){pages.add(s.page.id);add(`page.${s.page.id}`,s.page.parts,{kind:'page',script:s.page.script,page:s.page.id,text:s.page.text});}
 s.choices.forEach((c,i)=>add(`choice.${s.script}.${s.pc}.${i}`,c.parts,{kind:'choice',script:s.script,text:c.text}));
}
const trialRoutes=[];
for(let trial=0;trial<(entry===80001||entry===90001||entry===1?1:300);trial++){
 const trace=[], answersByLogic={}, confirmations=[];
 let s=run(data,{...createState(data),script:entry}),step=0;
 while(s.mode!=='ended' && step++<18000){
  assert.notEqual(s.mode,'error',s.error);inspect(s,step,trial);s.history=[];
  if(s.mode==='input'){s=submitName(data,s,s.names[s.input.field]);continue;}
  if(s.mode==='page'||s.mode==='credits')s=advance(data,s);
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
 trialRoutes.push({entry,trace,answersByLogic,confirmations,end:s.script,randomIndex:0});
}
fs.writeFileSync(`output/localization/${prefix}-trials.json`,JSON.stringify({sourceSha256:data.sourceSha256,routes:trialRoutes}));
if(chapter>=4){
 const fixtures=JSON.parse(fs.readFileSync(`tests/fixtures/remaining/chapter-${chapter}.json`,'utf8'));
 fixtures.routes.forEach((route,index)=>replayRoute(data,route,{inspect:(s,step)=>{inspect(s,step,`verified-${index}`);s.history=[];}}));
 for(const name of fs.readdirSync('tests/fixtures').filter(n=>n.startsWith(`chapter-${chapter}-`)&&n.endsWith('.json')))replayRoute(data,JSON.parse(fs.readFileSync(`tests/fixtures/${name}`)),{inspect:(s,step)=>{inspect(s,step,name);if(s.mode==='logic')inspect(finishLogic(data,{...s,answers:{}}),step,`${name}-empty`);s.history=[];}});
}
if(entry===10001){
 for(const route of ['science','occult'])for(const bad of [false,true]){
  let step=0;
  walk(route,{bad,bundle:data,inspect:s=>{inspect(s,step++,`walk-${route}-${bad?'bad':'good'}`);s.history=[];}});
 }
}
const routeExecuted=executedText.size;
const isolated=[];
if(entry===70001){
 // Orphan 75026 shares a page boundary across condition blocks. Replaying from
 // its own entry with field 6 = 5230 (op2006 at 4430592 writes var0) produces the variant;
 // starting at the preceding op3 would include the other branch's prefix.
 let state=run(data,{...createState(data),script:75026,answers:{6:5230}});
 for(let step=0;state.mode==='page'&&step<100;step++){
  inspect(state,step,'isolated-75026-answer-5230');
  state=advance(data,state);
 }
 assert.notEqual(state.mode,'error',state.error);
 isolated.push({script:75026,pc:0,answers:{6:5230},provenance:'orphan-script conditional replay; not route coverage'});
}
// Preserve unobserved source text without presenting direct block execution as a
// reachable playthrough. The report retains every source location and predicate.
for(const fragment of allText.filter(t=>!executedText.has(t.key))){
 if(executedText.has(fragment.key)||fragment.script===7000&&fragment.text===' ')continue;
 const instructions=data.scripts[fragment.script].instructions;
 const at=instructions.findIndex(i=>i.offset===fragment.offset);
 let start=at;
 while(start>=0&&![3,102].includes(instructions[start].op))start--;
 assert.ok(start>=0,`No text block for ${fragment.key}`);
 const state=run(data,{...createState(data),script:fragment.script,pc:start});
 assert.notEqual(state.mode,'error',state.error);
 inspect(state,start,`isolated-${fragment.script}-${start}`);
 isolated.push({script:fragment.script,pc:start,offset:instructions[start].offset,mode:state.mode,provenance:'direct-source-block; not route coverage'});
}
fs.writeFileSync(`output/localization/${prefix}-source-coverage.json`,JSON.stringify({entry,gameSha256:createHash('sha256').update(fs.readFileSync('public/game/game.json')).digest('hex'),sourceSha256:data.sourceSha256,textInstructions:allText.length,routeExecuted,executed:executedText.size,isolated,missing:allText.filter(t=>!executedText.has(t.key))},null,2));
fs.writeFileSync(file,[...entries.values()].map(e=>JSON.stringify(e)).join('\n')+'\n');
console.log(JSON.stringify({entry,added:entries.size-before,choices:choices.size,pages:pages.size,total:entries.size}));

stampCorpus(file);
