/** Explore source grading from real checkpoints; outputs require strict replay. */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {replayRoute} from '../scripts/replay_route.mjs';
import {advance,choose,getLogic,logicCondition,setAnswer,finishLogic,confirmResult,readVariable} from '../src/game/engine.ts';
const data=JSON.parse(readFileSync('public/game/game.json'));
const chapter=Number(process.argv[2]??3);
function tail(s,answers){
 const trace=[];let n=0;
 for(const [f,v] of Object.entries(answers))s=setAnswer(data,s,Number(f),v);
 s=finishLogic(data,s);
 while(s.mode!=='ended'&&n++<6000){
  s.history=[];
  if(s.mode==='page'||s.mode==='credits')s=advance(data,s);
  else if(s.mode==='confirm')s=confirmResult(data,s,true);
  else if(s.mode==='choice'){const i=s.choices.findIndex(c=>!c.disabled&&c.cost<=readVariable(s,8));trace.push([s.script,s.pc,i]);s=choose(data,s,i);}
  else throw Error(`${s.mode}: ${s.error}`);
 }
 if(s.mode!=='ended')throw Error('tail exceeded');
 return {s,trace,score:readVariable(s,10)};
}
let count=0;
for(const file of readdirSync(`output/routes-${chapter}`).filter(f=>f.startsWith(process.argv[3]??'44143-')&&f.endsWith('.json'))){
 const route=JSON.parse(readFileSync(`output/routes-${chapter}/${file}`));let checkpoint;let before=0,seen=0;
 replayRoute(data,route,{inspect(s){if(s.mode==='logic'){checkpoint=structuredClone({...s,history:[]});before=seen;}if(s.mode==='choice')seen++;s.history=[];}});
 if(!checkpoint || (process.argv[4] && !checkpoint.flags.includes(Number(process.argv[4]))))continue;
 let answers={...route.answersByLogic[checkpoint.logicId]};let best=tail(checkpoint,answers);
 for(let pass=0;pass<2;pass++)for(const f of getLogic(data,checkpoint).fields.filter(f=>logicCondition(checkpoint,f))){
  for(const c of f.choices.filter(c=>c.id&&checkpoint.flags.includes(c.id))){
   const candidate={...answers,[f.id]:c.id};const result=tail(checkpoint,candidate);
   if(result.score>best.score){answers=candidate;best=result;}
  }
 }
 const out={...route,trace:[...route.trace.slice(0,before),...best.trace],answersByLogic:{[checkpoint.logicId]:answers},end:best.s.script,score:best.score,penalty:readVariable(best.s,1)};
 replayRoute(data,out,{inspect(s){s.history=[]}});
 const flags=best.s.flags.filter(f=>f>=2400&&f<2430);
 const key=`optimized-${best.s.script}-${best.score}-${flags.join('-')}${process.argv[4] ? `-flag-${process.argv[4]}` : ""}`;
 writeFileSync(`output/routes-${chapter}/${key}.json`,JSON.stringify(out));
 console.log(file,'=>',key);
 if(++count>=12)break;
}
