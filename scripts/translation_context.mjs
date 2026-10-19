/** Reconstruct adjacent stops from a verified route instead of guessing after deduplication. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { richKey, sourceSignature } from '../src/i18n/richText.ts';
import { replayRoute } from './replay_route.mjs';
import { localizationRoute } from './localization_routes.mjs';
import { loadWorkbench, translatedText } from './translation_workbench.mjs';
export function replayContext(game,catalog,route,key,{radius=3,occurrence=1}={}) {
 if(!Number.isInteger(radius)||radius<0||radius>10||!Number.isInteger(occurrence)||occurrence<1)throw new Error('Radius 0–10 and occurrence >= 1 required');
 const ring=[],result=[];let matchStep=null,hits=0,choiceIndex=0;
 const item=(id,parts)=>{const source=sourceSignature(parts),k=richKey(id,parts),entry={key:k,source,collection:'rich'};return {key:k,parts,text:parts.map(p=>p.text).join(''),translation:catalog.rich[k]?.source===source?translatedText(entry,catalog.rich[k]):null};};
 replayRoute(game,route,{inspect(state,step){
  const stop={step,script:state.script,pc:state.pc,mode:state.mode,page:state.page?item(`page.${state.page.id}`,state.page.parts):null,choices:state.choices.map((c,i)=>({...item(`choice.${state.script}.${state.pc}.${i}`,c.parts),disabled:c.disabled,cost:c.cost})),selectedChoice:state.mode==='choice'?(route.trace[choiceIndex++]?.[2]??null):null};
  const match=stop.page?.key===key||stop.choices.some(c=>c.key===key);
  if(match&&++hits===occurrence){matchStep=step;result.push(...ring,stop);}
  else if(matchStep!==null&&step<=matchStep+radius)result.push(stop);
  ring.push(stop);if(ring.length>radius)ring.shift();
  state.history=[];
 }});
 if(matchStep===null)throw new Error('Key/occurrence not found on this route; do not infer context from a different branch');
 return {key,occurrence,routeEntry:route.entry,matchedStep:matchStep,stops:result,note:'Actual consecutive replay stops. No speaker inferred. Full route ending validated; history cleared only for collection.'};
}
function main(){
 const o={};const args=process.argv.slice(2);for(let i=0;i<args.length;i+=2){if(!['--locale','--route','--key','--radius','--occurrence','--file','--index'].includes(args[i])||args[i+1]===undefined)throw new Error('Use --locale xx --route fixture.json --key key --file output.json [--radius 3 --occurrence 1 --index 0]');o[args[i].slice(2)]=args[i+1];}
 if(!o.file||!o.route||!o.key)throw new Error('route, key and file required');
 const inputs=loadWorkbench(o.locale),fixture=JSON.parse(fs.readFileSync(o.route,'utf8'));
 const raw=o.index===undefined?fixture:fixture.routes?.[Number(o.index)];if(!raw)throw new Error('Route index missing');
 const route=localizationRoute(path.basename(o.route),raw);
 const report=replayContext(inputs.game,inputs.catalog,route,o.key,{radius:o.radius===undefined?3:Number(o.radius),occurrence:o.occurrence===undefined?1:Number(o.occurrence)});
 fs.mkdirSync(path.dirname(o.file),{recursive:true});fs.writeFileSync(o.file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({file:o.file,stops:report.stops.length,matchedStep:report.matchedStep}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
