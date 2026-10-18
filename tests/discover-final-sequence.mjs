import {readFileSync,writeFileSync} from 'node:fs';
import {replayRoute} from '../scripts/replay_route.mjs';
import {enterChapter,advance,choose,readVariable,getLogic,logicCondition,setAnswer,finishLogic,confirmResult,validateSave} from '../src/game/engine.ts';
const data=JSON.parse(readFileSync('public/game/game.json'));
const first=JSON.parse(readFileSync('tests/fixtures/chapter-3-science.json'));
const second=JSON.parse(readFileSync('tests/fixtures/chapter-3-occult.json'));
const previous=replayRoute(data,first,{inspect(s){s.history=[]}}).state;
let s=enterChapter(data,previous,40001),steps=0;
const trace=[];
while(s.mode!=='ended'&&steps++<10000){
 s.history=[];
 if(['page','credits'].includes(s.mode))s=advance(data,s);
 else if(s.mode==='choice'){
  const row=second.trace.find(r=>r[0]===s.script&&r[1]===s.pc);const index=row?.[2]??0;
  console.log('CHOICE',s.script,s.pc,index,s.choices.map(c=>c.text));
  trace.push([s.script,s.pc,index]);s=choose(data,s,index);
 }else if(s.mode==='logic'){
  for(const f of getLogic(data,s).fields.filter(f=>logicCondition(s,f)))s=setAnswer(data,s,f.id,second.answersByLogic[s.logicId][f.id]);
  s=finishLogic(data,s);
 }else if(s.mode==='confirm')s=confirmResult(data,s,true);
 else throw Error(`${s.mode}: ${s.error}`);
}
validateSave(data,s);
console.log('END',s.script,readVariable(s,10),s.flags.filter(f=>f>2400&&f<2430));
const route={...second,previousRoute:first,trace,end:s.script,score:readVariable(s,10),penalty:readVariable(s,1)};
writeFileSync('tests/fixtures/chapter-3-finale.json',JSON.stringify(route));
replayRoute(data,route,{previous,inspect(s){s.history=[]}});
