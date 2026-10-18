import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {replayRoute} from '../scripts/replay_route.mjs';
import {choose,advance,run,createState,validateSave,readVariable,confirmResult,finishLogic} from '../src/game/engine.ts';
const data=JSON.parse(readFileSync('public/game/game.json'));
for(const file of readdirSync('tests/fixtures').filter(f=>/^chapter-[2-8]-.+\.json$/.test(f)))test(`remaining complete route and full-history saves: ${file}`,()=>{
 const route=JSON.parse(readFileSync(`tests/fixtures/${file}`));let count=0,credits=0;
 const result=replayRoute(data,route,{checkSaves:true,inspect(s){
  count++;
  if(s.mode==='credits'){
   credits++;const next=advance(data,s);assert.notEqual(next.mode,'error',next.error);
   const skip=run(data,{...s,mode:'running',script:s.chapterEntry===90001?7099:6099,pc:0,callStack:[],creditLines:[]});
   assert.notEqual(skip.mode,'error',skip.error);validateSave(data,skip);
  }
  if(s.mode==='confirm'&&!data.scripts[s.script].instructions.some(t=>t.op===1006)){
   const back=confirmResult(data,s,false);assert.equal(back.mode,'logic');assert.deepEqual(back.answers,s.answers);validateSave(data,back);
  }
  if(s.mode==='logic'){
   const missing=finishLogic(data,{...s,answers:{}});assert.notEqual(missing.mode,'confirm');assert.notEqual(missing.mode,'error',missing.error);
  }
  if(count%200===0&&s.mode==='page'){
   const saved=JSON.stringify(s);advance(data,s);assert.equal(JSON.stringify(s),saved,'advancing must not mutate previous history or scene');
  }
 }});
 assert.ok(count>30);assert.ok(result.state.history.length>20);
 if(route.end===47099){assert.ok(credits>=30);assert.ok(result.state.flags.includes(2419)&&result.state.flags.includes(2420));}
 if(route.entry===90001)assert.ok(credits>=20);
 console.log(file,count,'stops',credits,'credit cards');
});
test('source RNG table, 32-bit jumps and audited subscript restrictions',()=>{
 const synthetic={...data,entry:999,scripts:{...data.scripts,999:{id:999,instructions:[{op:1304,args:[10,2],offset:1},{op:2,args:[],offset:2}]}}};
 for(let i=0;i<1000;i++){
  const s=run(synthetic,{...createState(synthetic),randomIndex:i});
  assert.equal(s.mode,'ended');assert.equal(readVariable(s,2),data.randomTable[i]%10);assert.equal(s.randomIndex,(i+10)%1000);
 }
 const invalid={...synthetic,scripts:{...synthetic.scripts,999:{id:999,instructions:[{op:1301,args:[30001,0],offset:1}]}}};
 assert.match(run(invalid,createState(invalid)).error,/未审计/);
 const high=run(data,{...createState(data),script:90001});assert.notEqual(high.mode,'error',high.error);assert.equal(high.chapterEntry,90001);
});
for(let chapter=2;chapter<=8;chapter++)test(`chapter ${chapter}: every reachable record and choice, source-proven unreachable records`,()=>{
 const fixture=JSON.parse(readFileSync(`tests/fixtures/remaining/chapter-${chapter}.json`));
 const covered=new Set();
 const observed={...data,scripts:new Proxy(data.scripts,{get(t,k){if(t[k])covered.add(`script:${k}`);return t[k]}})};
 for(const route of fixture.routes)replayRoute(observed,route,{inspect(s){
  if(s.mode==='credits'){
   const skip=run(observed,{...s,history:[],mode:'running',script:s.chapterEntry===90001?7099:6099,pc:0,callStack:[],creditLines:[]});assert.notEqual(skip.mode,'error',skip.error);
  }
  if(s.mode==='choice'){
   covered.add(`choice:${s.script}:${s.pc}`);
   for(let i=0;i<s.choices.length;i++)if(!s.choices[i].disabled&&s.choices[i].cost<=readVariable(s,8)){
    const next=choose(observed,s,i);assert.notEqual(next.mode,'error',next.error);covered.add(`option:${s.script}:${s.pc}:${i}`);
   }
  }
  s.history=[];
 }});
 assert.deepEqual([...covered].sort(),fixture.coverage);
 const entry=(chapter+1)*10000+1,reachable=new Set(),pending=[entry];
 while(pending.length){const id=pending.pop();if(reachable.has(id))continue;reachable.add(id);for(const t of data.scripts[id].instructions)if([101,1301].includes(t.op))pending.push(t.args[0]+(t.args[1]??0)*65536);}
 for(const id of reachable){
  assert.ok(covered.has(`script:${id}`),`uncovered reachable record ${id}`);
  data.scripts[id].instructions.forEach((t,i)=>{if(t.op===103)assert.ok(covered.has(`choice:${id}:${i+1}`),`uncovered choice ${id}:${i+1}`)});
 }
 const orphan=Object.keys(data.scripts).map(Number).filter(id=>id>=entry-1&&id<entry+9999&&!reachable.has(id));
 const expected={2:[39700,39999],3:[],4:[50501,58003,58004,58005,58007,58008,58009,58010,58011,58012,58013,58014,59201,59202,59203,59204,59205,59206,59207,59208,59209,59210,59211,59998],5:[],6:[75026,75027,75028,75029,75030,75034,75041,75055,79001,79002,79003,79008,79009,79010,79011,79012,79013],7:[],8:[]};
 assert.deepEqual(orphan,expected[chapter]);
});
