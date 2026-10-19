/** Local manual-bug intake: locate visible text and preserve existing QA evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {loadWorkbench,inventory,translatedText} from './translation_workbench.mjs';
import {sha256} from './localization_provenance.mjs';
import {validateSave} from '../src/game/engine.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
// Search normalization only: never rewrite source or translations.
const normalize=s=>s.normalize('NFKC').replace(/\s/gu,'');
export function locate(inputs,{text,entry,limit=10}){
 if(typeof text!=='string'||normalize(text).length<2)throw new Error('Provide at least two non-whitespace characters');
 if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('limit must be 1–50');
 const chapters=entry===undefined?[1,...inputs.game.chapters.map(c=>c.entry)]:[entry];
 const found=new Map(),query=normalize(text);
 for(const chapter of chapters)for(const e of inventory(inputs.game,inputs.corpus,chapter).entries){
  const translation=inputs.catalog[e.collection][e.key];
  const current=translation?.source===e.source;
  const displayed=current?translatedText(e,translation):e.text??e.source;
  const source=e.collection==='rich'?JSON.parse(e.source).map(p=>p.text).join(''):e.source;
  if(!normalize(displayed).includes(query)&&!normalize(source).includes(query))continue;
  const existing=found.get(e.key);if(existing){existing.entries.push(chapter);continue;}
  const script=inputs.game.scripts[e.script];
  found.set(e.key,{key:e.key,collection:e.collection,kind:e.kind,entries:[chapter],script:e.script,page:e.page,offset:e.offset,
   route:e.route,trial:e.trial,step:e.step,translationCurrent:current,
   sourceExcerpt:source.slice(0,350),translationExcerpt:displayed.slice(0,350),
   sourceExcerptTruncated:source.length>350,translationExcerptTruncated:displayed.length>350,
   // Page IDs identify the opening text instruction, not necessarily the paused state's pc.
   pageStartPc:e.page&&script?script.instructions.findIndex(i=>i.offset===Number(e.page.split(':').at(-1))):undefined});
 }
 return {query:text,locale:inputs.catalog.locale,entry:entry??null,total:found.size,truncated:found.size>limit,matches:[...found.values()].slice(0,limit)};
}
export function checkpoint(root,inputs,bundle,scene){
 if(!/^[a-z0-9-]+$/.test(bundle)||!scene)throw new Error('Use a valid bundle and exact scene');
 const base=path.join(root,'output/qa',bundle),report=read(path.join(base,'report.json'));
 if(report.dataSha256!==inputs.gameSha256)throw new Error('Stale QA bundle; regenerate it, never replace the hash');
 const fixtures=read(path.join(base,'fixtures.json'));
 if(!Object.hasOwn(fixtures,scene))throw new Error('Scene not found in QA bundle');
 return {state:validateSave(inputs.game,fixtures[scene]),origin:{bundle,scene,reportSha256:sha256(fs.readFileSync(path.join(base,'report.json')))}};
}
export function writeReport(root,inputs,options){
 if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(options.id??''))throw new Error('id must be 1–64 lowercase letters, digits or hyphens');
 if(Boolean(options.bundle)!==Boolean(options.scene))throw new Error('bundle and scene must be supplied together');
 const result=locate(inputs,options);
 const evidence=options.bundle?checkpoint(root,inputs,options.bundle,options.scene):null;
 if(evidence&&options.entry!==undefined&&evidence.state.chapterEntry!==options.entry)throw new Error('Checkpoint chapter does not match entry');
 const bundle=`bug-${options.id}`,directory=path.join(root,'output/qa',bundle);
 const git=args=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return 'unavailable';}};
 const report={version:1,createdAt:new Date().toISOString(),id:options.id,locale:inputs.catalog.locale,
  dataSha256:inputs.gameSha256,sourceSha256:inputs.game.sourceSha256,
  catalogSha256:sha256(fs.readFileSync(path.join(root,`localization/story/${inputs.catalog.locale}.json`))),
  corpusSha256:sha256(fs.readFileSync(path.join(root,'output/localization/routes.jsonl'))),
  gitHead:git(['rev-parse','HEAD']),gitStatus:git(['status','--short']),
  evidence:evidence?.origin??null,checkpoint:evidence?{script:evidence.state.script,pc:evidence.state.pc,mode:evidence.state.mode,historyPages:evidence.state.history.length}:null,
  status:'untriaged',note:'Text matches and an optional existing QA snapshot are candidates, not proof of the player route or bug reproduction.'};
 const url=evidence?`/tests/qa.html?bundle=${bundle}&scene=repro&lang=${encodeURIComponent(inputs.catalog.locale)}`:null;
 const markdown=`# ${options.id}\n\n状态：待复现（工具没有确认 bug，也没有自动修复）\n\n## 玩家观察\n\n- 现象：待填写\n- 预期：待填写\n- 章节 / 路线 / 最近选择：待填写\n- 附近原句：${JSON.stringify(options.text)}\n- 浏览器及版本 / 系统 / CSS 视口 / 缩放 / 字号：待填写\n- 语言：${inputs.catalog.locale}\n- 发生频率：待填写\n- 进入方式（新开局 / 继续 / 读档 / 切章）：待填写\n- 截图或短视频：待填写\n\n## 定位证据\n\n匹配 ${result.total} 条，展示 ${result.matches.length} 条；完整键和上下文线索见 matches.json。不得默选第一项。\n\n${result.matches.map(m=>`- ${m.key}（章节入口 ${m.entries.join(', ')}）`).join('\n')||'- 暂无匹配：缩短原句，核对语言、姓名和版本。'}\n\n版本指纹、工作区状态见 report.json。指纹用于识别差异，并不保存完整代码版本。\n\n${url?`已有 QA 检查点副本：\`${url}\`。它不是玩家实际现场；从该点复验后才能记录“已复现”。历史页数见 report.json，可能源自截短 UI 夹具。`:'尚未附加检查点：先核对真实路线，再使用 qa:replay 或已有检查包。'}\n\n## 修复与验收\n\n- 复现步骤与实际结果：待填写\n- 根因与证据：待填写\n- 修改范围及存档兼容影响：待填写\n- 修复前失败 / 修复后通过的回归：待填写\n- 实际浏览器操作与结果：待填写\n- 未覆盖边界：待填写\n- 结论：待复现 / 已复现 / 修复中 / 待验收 / 已验证 / 非 bug / 暂缓（选择一项并说明）\n`;
 fs.mkdirSync(path.dirname(directory),{recursive:true});
 fs.mkdirSync(directory); // EEXIST protects prior reports and evidence.
 fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(directory,'matches.json'),JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(directory,'REPORT.md'),markdown);
 if(evidence)fs.writeFileSync(path.join(directory,'fixtures.json'),JSON.stringify({repro:evidence.state}));
 return {directory,matches:result.total,url,status:'untriaged'};
}
function main(){
 const [command,...args]=process.argv.slice(2),o={};
 for(let n=0;n<args.length;n+=2){const key=args[n];if(!['--text','--entry','--locale','--limit','--id','--bundle','--scene'].includes(key)||args[n+1]===undefined||Object.hasOwn(o,key.slice(2)))throw new Error('Use locate|report --text quote [--entry 10001 --locale zh-Hans --limit 10 --id bug-id --bundle bundle --scene scene]');o[key.slice(2)]=args[n+1];}
 const inputs=loadWorkbench(o.locale??'zh-Hans'),options={...o,entry:o.entry===undefined?undefined:Number(o.entry),limit:o.limit===undefined?10:Number(o.limit)};
 if(command==='locate')console.log(JSON.stringify(locate(inputs,options),null,2));
 else if(command==='report')console.log(JSON.stringify(writeReport('.',inputs,options),null,2));
 else throw new Error('Command must be locate or report');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
