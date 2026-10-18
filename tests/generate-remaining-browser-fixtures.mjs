import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from '../scripts/replay_route.mjs';
import {visibleBackground,setAnswer,getLogic,logicCondition,finishLogic} from '../src/game/engine.ts';
const bytes=readFileSync('public/game/game.json'),data=JSON.parse(bytes),fixtures={};
const routes={2:'end-39000',3:'finale',4:'end-58102',5:'end-64502',6:'end-75090',7:'end-80101',8:'end-90701'};
for(const [chapter,name] of Object.entries(routes)){
 const route=JSON.parse(readFileSync(`tests/fixtures/chapter-${chapter}-${name}.json`));
 replayRoute(data,route,{inspect(s){
  const keys=[`chapter-${chapter}-${s.mode}`];
  if(s.mode==='page'&&visibleBackground(s))keys.push(`chapter-${chapter}-background`);
  if(s.mode==='page'&&(Object.values(s.layers).some(l=>l.alpha>0)||Object.values(s.animations).some(l=>l.alpha>0)))keys.push(`chapter-${chapter}-scene`);
  for(const key of keys)if(!fixtures[key])fixtures[key]=structuredClone({...s,history:s.history.slice(-100)});
  if(s.mode==='logic'){
   let filled=s;for(const f of getLogic(data,s).fields.filter(f=>logicCondition(s,f)))filled=setAnswer(data,filled,f.id,route.answersByLogic[s.logicId][f.id]);
   fixtures[`chapter-${chapter}-filled`]=structuredClone({...filled,history:s.history.slice(-100)});
   const confirm=finishLogic(data,filled);fixtures[`chapter-${chapter}-submission`]=structuredClone({...confirm,history:confirm.history.slice(-100)});
  }
  s.history=[];
 }});
}
mkdirSync('output/qa/all-chapters',{recursive:true});
writeFileSync('output/qa/all-chapters/fixtures.json',JSON.stringify(fixtures));
writeFileSync('output/qa/all-chapters/report.json',JSON.stringify({schemaVersion:1,dataSha256:createHash('sha256').update(bytes).digest('hex'),sourceSha256:data.sourceSha256,locations:Object.keys(fixtures),note:'Real route checkpoints; history trimmed to 100 for UI only.'}));
console.log(Object.keys(fixtures));
