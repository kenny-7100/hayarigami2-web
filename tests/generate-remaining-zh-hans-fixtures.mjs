/** Actual translated longest pages and interaction checkpoints. UI histories capped at 100. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {translateParts,richKey} from '../src/i18n/richText.ts';
import {replayRoute} from '../scripts/replay_route.mjs';
import {walk} from './chapter-walk.mjs';
import {validateSave,finishLogic} from '../src/game/engine.ts';
const bytes=fs.readFileSync('public/game/game.json'),data=JSON.parse(bytes),fixtures={},locations={},media=new Set();
const catalog=JSON.parse(fs.readFileSync('localization/story/zh-Hans.json'));
const save=(name,s)=>{if(!s||fixtures[name])return;fixtures[name]=validateSave(data,{...s,history:s.history.slice(-100)});locations[name]={script:s.script,pc:s.pc,mode:s.mode};};
function visit(kind,runner){let previous,lastPage,longest,longestLength=0;
 const result=runner(s=>{
  if(['logic','confirm','choice','credits'].includes(s.mode))save(`${kind}-${s.mode}`,s);
  if(s.mode==='logic')save(`${kind}-empty`,finishLogic(data,{...s,answers:{}}));
  if(s.mode==='page'){
   lastPage=s;save(`${kind}-opening`,s);
   const length=translateParts(s.page.parts,catalog.rich[richKey(`page.${s.page.id}`,s.page.parts)]).map(p=>p.text).join('').length;
   if(length>longestLength){longest=s;longestLength=length;}
   if(s.page.parts.some(p=>p.keyword)){save(`${kind}-keyword`,s);if(previous?.mode==='page')save(`${kind}-before-keyword`,previous);}
   for(const layer of Object.values(s.sprites).filter(l=>l.alpha>0)){media.add(layer.asset);if(layer.asset>=2000)save(`media-${layer.asset}`,s);}
  }previous=s;
 });save(`${kind}-longest`,longest);save(`${kind}-ending`,lastPage);save(`${kind}-ended`,result.state);
}
for(const route of ['science','occult'])for(const bad of [false,true])visit(`zero-${route}-${bad?'bad':'good'}`,inspect=>walk(route,{bad,bundle:data,inspect}));
for(const chapter of [4,5,6,7,8])for(const filename of fs.readdirSync('tests/fixtures').filter(n=>n.startsWith(`chapter-${chapter}-`)&&n.endsWith('.json'))){const route=JSON.parse(fs.readFileSync(`tests/fixtures/${filename}`));visit(filename.slice(0,-5),inspect=>replayRoute(data,route,{inspect}));}
fs.mkdirSync('output/qa/remaining-zh-hans',{recursive:true});
fs.writeFileSync('output/qa/remaining-zh-hans/fixtures.json',JSON.stringify(fixtures));
fs.writeFileSync('output/qa/remaining-zh-hans/report.json',JSON.stringify({dataSha256:createHash('sha256').update(bytes).digest('hex'),locations,media:[...media]}));
console.log({fixtures:Object.keys(fixtures).length,media:[...media]});
