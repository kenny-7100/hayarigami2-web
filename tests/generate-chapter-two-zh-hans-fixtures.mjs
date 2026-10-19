// Real route checkpoints; shortened histories are UI fixtures only.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {replayRoute} from '../scripts/replay_route.mjs';
import {validateSave, finishLogic} from '../src/game/engine.ts';
const bytes=fs.readFileSync('public/game/game.json'),data=JSON.parse(bytes),fixtures={},locations={},media=new Set();
const save=(name,s)=>{if(fixtures[name])return;fixtures[name]=validateSave(data,{...s,history:s.history.slice(-100)});locations[name]={script:s.script,pc:s.pc,mode:s.mode};};
const routes = [['occult',JSON.parse(fs.readFileSync('tests/fixtures/chapter-2-end-39000.json'))],['science',JSON.parse(fs.readFileSync('tests/fixtures/chapter-2-science.json'))],['bad',JSON.parse(fs.readFileSync('tests/fixtures/chapter-2-end-39992.json'))]];
for(const [kind,route] of routes){
 let lastPage, previous;
 const result=replayRoute(data,route,{inspect(s){
  if(s.mode==='page')lastPage=s;
  if(['logic','confirm','choice'].includes(s.mode))save(`${kind}-${s.mode}`,s);
  if(s.mode==='logic')save(`${kind}-empty`,finishLogic(data,{...s,answers:{}}));
  if(s.mode==='page'){
   save(`${kind}-opening`,s);
   if(s.page.parts.some(p=>p.keyword)){save(`${kind}-keyword`,s);if(previous?.mode==='page')save(`${kind}-before-keyword`,previous);}
   if(s.page.text.length>85)save(`${kind}-long`,s);
   for(const l of Object.values(s.sprites).filter(l=>l.alpha>0)){
    media.add(l.asset);if([2405,2410,2475,2485,2486,2487,2488,2489,2495,4209].includes(l.asset))save(`media-${l.asset}`,s);
   }
  }
  previous=s;
 }});
 save(`${kind}-ending`,lastPage);save(`${kind}-ended`,result.state);
}
fs.mkdirSync('output/qa/ch2-zh-hans',{recursive:true});
fs.writeFileSync('output/qa/ch2-zh-hans/fixtures.json',JSON.stringify(fixtures));
fs.writeFileSync('output/qa/ch2-zh-hans/report.json',JSON.stringify({dataSha256:createHash('sha256').update(bytes).digest('hex'),locations,media:[...media]}));
console.log(locations);
