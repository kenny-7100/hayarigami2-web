/** Build a compact set of real, strictly replayed traces. No synthetic flags. */
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {replayRoute} from '../scripts/replay_route.mjs';
import {choose,readVariable,run} from '../src/game/engine.ts';
const original=JSON.parse(readFileSync('public/game/game.json'));
mkdirSync('tests/fixtures/remaining',{recursive:true});
const report={};
for(let chapter=2;chapter<=8;chapter++){
 const all=new Set(),candidates=[];let visited;
 const data={...original,scripts:new Proxy(original.scripts,{get(t,k){if(t[k])visited.add(`script:${k}`);return t[k]}})};
 const paths=[...readdirSync(`output/routes-${chapter}`).filter(f=>f!=='report.json'&&f.endsWith('.json')).map(f=>`output/routes-${chapter}/${f}`),...readdirSync('tests/fixtures').filter(f=>f.startsWith(`chapter-${chapter}-`)).map(f=>`tests/fixtures/${f}`)];
 for(const path of paths){
  const route=JSON.parse(readFileSync(path));visited=new Set();
  replayRoute(data,route,{inspect(s){
   if(s.mode==='credits'){ const skip=run(data,{...s,history:[],mode:'running',script:s.chapterEntry===90001?7099:6099,pc:0,callStack:[],creditLines:[]});if(skip.mode==='error')throw Error(skip.error); }
   if(s.mode==='choice'){
    visited.add(`choice:${s.script}:${s.pc}`);
    for(let i=0;i<s.choices.length;i++)if(!s.choices[i].disabled&&s.choices[i].cost<=readVariable(s,8)){
     const next=choose(data,s,i);if(next.mode==='error')throw Error(next.error);visited.add(`option:${s.script}:${s.pc}:${i}`);
    }
   }
   s.history=[];
  }});
  candidates.push({path,route,visited});for(const key of visited)all.add(key);
 }
 const uncovered=new Set(all),selected=[];
 while(uncovered.size){
  candidates.sort((a,b)=>[...b.visited].filter(k=>uncovered.has(k)).length-[...a.visited].filter(k=>uncovered.has(k)).length);
  const next=candidates.shift();selected.push(next.route);for(const key of next.visited)uncovered.delete(key);
 }
 const entry=(chapter+1)*10000+1,reachable=new Set(),pending=[entry];
 while(pending.length){const id=pending.pop();if(reachable.has(id))continue;reachable.add(id);for(const t of original.scripts[id].instructions)if([101,1301].includes(t.op))pending.push(t.args[0]+(t.args[1]??0)*65536);}
 const missing=[...reachable].filter(id=>!all.has(`script:${id}`)).sort((a,b)=>a-b);
 const orphan=Object.keys(original.scripts).map(Number).filter(id=>id>=entry-1&&id<entry+9999&&!reachable.has(id));
 const missingChoices=[...reachable].flatMap(id=>original.scripts[id].instructions.flatMap((t,i)=>t.op===103&&!all.has(`choice:${id}:${i+1}`)?[`${id}:${i+1}`]:[]));
 report[chapter]={entry,routes:selected.length,records:[...all].filter(k=>k.startsWith('script:')).length,choices:[...all].filter(k=>k.startsWith('choice:')).length,options:[...all].filter(k=>k.startsWith('option:')).length,missing,orphan,missingChoices};
 writeFileSync(`tests/fixtures/remaining/chapter-${chapter}.json`,JSON.stringify({routes:selected,coverage:[...all].sort()}));
 console.log(chapter,report[chapter]);
}
writeFileSync('output/remaining-coverage.json',JSON.stringify(report,null,2));
