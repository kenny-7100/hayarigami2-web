/** Offline exploration only. Emitted traces must pass strict replay before acceptance. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createState,run,advance,choose,readVariable,getLogic,logicCondition,setAnswer,finishLogic,confirmResult,validateSave } from '../src/game/engine.ts';
const original=JSON.parse(readFileSync('public/game/game.json'));
const chapter=Number(process.argv[2] ?? 2), trials=Number(process.argv[3] ?? 100);
const entry=(chapter+1)*10000+1;
let seed=7;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
const scripts=new Set(),choices=new Map(),options=new Set(),modes=new Set(),ends=new Map(),opcodes=new Set();
const data={...original,scripts:new Proxy(original.scripts,{get(target,key){const s=target[key];if(s)scripts.add(Number(key));return s}})};
const hints={};
for(const script of Object.values(original.scripts).filter(s=>s.id>=(chapter+1)*10000&&s.id<(chapter+2)*10000)){
 if(!script.instructions.some(t=>t.op===802&&t.args[1]===522))continue;
 let field;
 for(let i=0;i<script.instructions.length;i++){
  const t=script.instructions[i];
  if(t.op===2006)field=t.args[0]&255;
  if(field===undefined||t.op!==108||t.args[1]<4600||t.args[1]>=5300)continue;
  let depth=0,cost=0;
  for(let j=i+1;j<script.instructions.length;j++){
   const x=script.instructions[j];
   if(x.op===108)depth++;
   if(x.op===109){if(!depth)break;depth--;}
   if(x.op===802&&x.args[1]===522)cost+=x.args[0];
  }
  const values=hints[field]??={};values[t.args[1]]=Math.min(values[t.args[1]]??Infinity,cost);
 }
}
console.log('Source grade candidates',hints);
function fill(s,bad=false){
 for(const field of getLogic(data,s).fields.filter(f=>logicCondition(s,f))){
  const available=field.choices.filter(c=>c.id&&s.flags.includes(c.id));
  if(!available.length)throw Error(`No available candidate ${s.script}:${field.id}`);
  const ranked=available.slice().sort((a,b)=>(hints[field.id]?.[a.id]??99)-(hints[field.id]?.[b.id]??99));
  const choice=bad?available[Math.floor(random()*available.length)]:ranked[0];
  s=setAnswer(data,s,field.id,choice.id);
 }
 return s;
}
mkdirSync(`output/routes-${chapter}`,{recursive:true});
for(let trial=0;trial<trials;trial++){
 const beforeCoverage=scripts.size+options.size;
 const trace=[],answersByLogic={},stops=new Set(),pages=new Set();
 let s=run(data,{...createState(data),script:entry,randomIndex:trial%1000});
 let steps=0;
 while(s.mode!=='ended'&&steps++<20000){
  if(s.mode==='error')throw Error(`${trial}: ${s.error}`);
  modes.add(s.mode);stops.add(s.script);if(s.page)pages.add(s.page.id);
  s.history=[];
  if(s.mode==='page'||s.mode==='credits')s=advance(data,s);
  else if(s.mode==='choice'){
   const key=`${s.script}:${s.pc}`;
   const available=s.choices.flatMap((c,i)=>!c.disabled&&c.cost<=readVariable(s,8)?[i]:[]);
   if(!available.length)throw Error('No available choice');
   choices.set(key,s.choices.map(c=>c.text));
   // Explore new branches first; seeded sampling keeps repeatable alternative routes.
   const fresh=available.filter(i=>!options.has(`${key}:${i}`));
   const pool=fresh.length?fresh:available;
   const selection=trial===0?available[0]:pool[Math.floor(random()*pool.length)];
   options.add(`${key}:${selection}`);trace.push([s.script,s.pc,selection]);
   s=choose(data,s,selection);
  }else if(s.mode==='logic'){
   const bad=trial%5===4;
   s=fill(s,bad);answersByLogic[s.logicId]={...s.answers};
   s=finishLogic(data,s);
  }else if(s.mode==='confirm')s=confirmResult(data,s,true);
  else throw Error(`Unexpected mode ${s.mode}`);
 }
 if(s.mode!=='ended')throw Error(`budget ${trial} ${s.script}:${s.pc} ${s.mode}`);
 validateSave(data,s);
 const score=readVariable(s,10),penalty=readVariable(s,1);
 const key=`${s.script}-${score}-${penalty}-${s.flags.filter(f=>f>=2400&&f<2430).join("_")}`;
 if(scripts.size+options.size>beforeCoverage)writeFileSync(`output/routes-${chapter}/coverage-${trial}.json`,JSON.stringify({entry,randomIndex:trial%1000,trace,answersByLogic,end:s.script,score,penalty}));
 if(!ends.has(key)){
  const route={entry,randomIndex:trial%1000,trace,answersByLogic,end:s.script,score,penalty};
  writeFileSync(`output/routes-${chapter}/${key}.json`,JSON.stringify(route));
  ends.set(key,{trial,steps,choices:trace.length,flags:s.flags,stops:[...stops],pages:pages.size});
  console.log('ENDING',chapter,key,'trial',trial,'steps',steps,'choices',trace.length);
 }
 if(trial%10===0)console.log('PROGRESS',trial,'records',scripts.size,'choices',choices.size,'options',options.size);
}
const report={chapter,entry,trials,scriptIds:[...scripts].sort((a,b)=>a-b),choices:Object.fromEntries(choices),options:[...options],modes:[...modes],ends:Object.fromEntries(ends)};
writeFileSync(`output/routes-${chapter}/report.json`,JSON.stringify(report));
console.log('DONE',chapter,scripts.size,choices.size,ends.size);
