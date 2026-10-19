// Real route checkpoints; shortened histories are UI fixtures only.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {translateParts, richKey} from '../src/i18n/richText.ts';
import {replayRoute} from '../scripts/replay_route.mjs';
import {validateSave, finishLogic} from '../src/game/engine.ts';
const bytes=fs.readFileSync('public/game/game.json'),data=JSON.parse(bytes),fixtures={},locations={},media=new Set();
const catalog=JSON.parse(fs.readFileSync('localization/story/zh-Hans.json'));
const save=(name,s)=>{if(fixtures[name])return;fixtures[name]=validateSave(data,{...s,history:s.history.slice(-100)});locations[name]={script:s.script,pc:s.pc,mode:s.mode};};
const routes = ['science','occult','science-recollection','end-44143','finale'].map(kind=>[kind,JSON.parse(fs.readFileSync(`tests/fixtures/chapter-3-${kind}.json`))]);
for(const [kind,route] of routes){
 let lastPage, previous, longest, longestLength=0;
 const result=replayRoute(data,route,{inspect(s){
  if(s.mode==='page')lastPage=s;
  if(['logic','confirm','choice','credits'].includes(s.mode))save(`${kind}-${s.mode}`,s);
  if(s.mode==='logic')save(`${kind}-empty`,finishLogic(data,{...s,answers:{}}));
  if(s.mode==='page'){
   save(`${kind}-opening`,s);
   const length=translateParts(s.page.parts,catalog.rich[richKey(`page.${s.page.id}`,s.page.parts)]).map(p=>p.text).join('').length;
   if(length>longestLength){longest=s;longestLength=length;}

   if(s.page.parts.some(p=>p.keyword)){save(`${kind}-keyword`,s);if(previous?.mode==='page')save(`${kind}-before-keyword`,previous);}
   if(s.page.text.length>85)save(`${kind}-long`,s);
   for(const l of Object.values(s.sprites).filter(l=>l.alpha>0)){
    media.add(l.asset);if((l.asset>=2600&&l.asset<2800)||(l.asset>=4200&&l.asset<4400))save(`media-${l.asset}`,s);
   }
  }
  if(s.script===44156||s.script===45099)save(`special-${s.script}`,s);
  previous=s;
 }});
 save(`${kind}-longest`,longest);save(`${kind}-ending`,lastPage);save(`${kind}-ended`,result.state);
}
fs.mkdirSync('output/qa/ch3-zh-hans',{recursive:true});
fs.writeFileSync('output/qa/ch3-zh-hans/fixtures.json',JSON.stringify(fixtures));
fs.writeFileSync('output/qa/ch3-zh-hans/report.json',JSON.stringify({dataSha256:createHash('sha256').update(bytes).digest('hex'),locations,media:[...media]}));
console.log(locations);
