/** Offline, bounded translation tasks. Does not translate, access APIs or certify prose quality. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256, verifyCorpus } from './localization_provenance.mjs';
import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
import { validateRichTranslation, translateParts, validTranslationText } from '../src/i18n/richText.ts';
import { localeDefinitions } from '../src/i18n/locale.ts';
const chapterScopes = JSON.parse(fs.readFileSync(new URL('../localization/chapter-scopes.json',import.meta.url),'utf8')).chapters;
const json = p => JSON.parse(fs.readFileSync(p,'utf8'));
const digest = value => value === undefined ? null : sha256(JSON.stringify(value));
const placeholders = text => (text.match(/\{(?:surname|givenName|name:[01])\}/g) ?? []).sort();

// Same transitive 32-bit jump/call dependency rule as compile_chapter.py; not a reachability claim.
export function scopeFor(game, entry) {
 const chapter = game.chapters.find(c => c.entry === entry);
 if(!chapter && entry !== 1) throw new Error('Use the real chapter entry (e.g. 20001), not its ordinal');
 const ids = new Set(chapter ? Object.values(game.scripts).filter(s => s.id >= chapter.minScript && s.id <= chapter.maxScript).map(s=>s.id) : [1,2,3,4]);
 for(const id of ids) {
  const script=game.scripts[id];
  if(!script) throw new Error(`Missing script ${id}`);
  for(const ins of script.instructions) if([101,1301].includes(ins.op)) ids.add(ins.args[0] + ins.args[1]*65536);
 }
 return { entry, title: chapter?.title ?? '序章', chapter, scripts: ids };
}
export function inventory(game, corpus, entry) {
 const scope=scopeFor(game,entry), plain=new Map(), keywords=new Set(), terms=new Set(), logics=new Set();
 const add=(key,source,kind,extra={})=>{if(typeof source!=='string')throw new Error(`Missing static source ${key}`);if(source.trim())plain.set(key,{key,source,kind,collection:'strings',...extra});};
 if(scope.chapter) add(`chapter.${scope.chapter.id}.title`,scope.title,'chapter');
 for(const id of scope.scripts) game.scripts[id].instructions.forEach((ins,pc)=>{
  if(ins.op===2001) keywords.add(ins.args[0]);
  if(ins.op===2013) terms.add(ins.args[0]);
  if(ins.op===2008) logics.add(ins.args[0]);
  if(ins.op===1310) add(`prompt.${id}.${pc+1}`,ins.label,'confirmation',{script:id,offset:ins.offset});
  if(ins.op===1401) add(`label.${ins.label}`,ins.label,id>=6100&&id<6300?'credit-label':'overlay-label',{script:id,offset:ins.offset});
 });
 const config=chapterScopes[entry];
 if(!config)throw new Error('Chapter scope requires explicit registration');
 for(const id of config.initialTerms)terms.add(id);
 if(config.keywordRange)for(const id of Object.keys(game.keywords))if(Number(id)>=config.keywordRange[0]&&Number(id)<config.keywordRange[1])keywords.add(Number(id));
 for(const id of logics) {
  const logic=game.logics[id];if(!logic)throw new Error(`Missing logic ${id}`);
  for(const [key,source] of Object.entries(logic.descriptions)) add(`logic.${id}.description.${key}`,source,'character-description');
  for(const field of logic.fields) for(const c of field.choices){
   add(`logic.${id}.field.${field.id}.choice.${c.id}`,c.description,'relation-description');
   if(c.id)keywords.add(c.id);
  }
 }
 for(const id of keywords) add(`keywords.${id}`,game.keywords[id],'keywords');
 for(const id of terms) {add(`terms.${id}`,game.terms[id],'terms');add(`definitions.${id}`,game.definitions[id],'definitions');}
 const rich=corpus.filter(e=>scope.scripts.has(e.script)).map(e=>({...e,collection:'rich'}));
 return { scope, entries:[...rich,...plain.values()] };
}
export function translatedText(entry, translation) {
 if(!translation)return null;
 return entry.collection==='rich' ? translateParts(JSON.parse(entry.source),translation).map(p=>p.text).join('') : translation.text;
}
export function progress(entries,catalog) {
 const groups={};
 for(const e of entries){const g=groups[e.collection]??={required:0,missing:0,stale:0,draft:0,reviewed:0};g.required++;
 const t=catalog[e.collection][e.key];g[!t?'missing':t.source!==e.source?'stale':t.status]++;}
 return groups;
}
export function relevantRules(glossary,entry,source) {
 return (glossary?.rules??[]).filter(r=>(!r.entries||r.entries.includes(entry))&&r.source.some(term=>source.includes(term)));
}
export function prepareTask({game,corpus,catalog,glossary,gameSha256}, {entry,kind='rich',limit=20,maxChars=6000,route,key,keys}) {
 if(!['rich','strings'].includes(kind)||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(maxChars)||maxChars<100||maxChars>50000)throw new Error('Use kind rich|strings, limit 1–100, chars 100–50000');
 const {entries,scope}=inventory(game,corpus,entry);
 if(keys!==undefined&&(!Array.isArray(keys)||!keys.length||keys.length>limit||keys.some(k=>typeof k!=='string')||new Set(keys).size!==keys.length||key))throw new Error('Use unique keys within limit, without key');
 const requested=keys??(key?[key]:null);
 if(requested&&requested.some(k=>!entries.some(e=>e.key===k)))throw new Error('Key is not in the selected chapter scope');
 const candidates=entries.filter(e=>requested?requested.includes(e.key):e.collection===kind&&(!route||e.route===route)&&catalog[e.collection][e.key]?.source!==e.source);
 if(key&&!candidates.length)throw new Error('Key is not in the selected chapter scope');
 const selected=[];let chars=0;
 for(const e of candidates){const count=(e.text??e.source).length;if(selected.length&&(selected.length>=limit||chars+count>maxChars))break;selected.push(e);chars+=count;}
 if(keys&&selected.length!==keys.length)throw new Error('Revision keys exceed character budget');
 if(!selected.length)throw new Error('No missing entries in this scope; use --key for an explicit revision');
 return {version:2,locale:catalog.locale,entry,title:scope.title,sourceSha256:game.sourceSha256,gameSha256,
  instructions:['Edit translation and notes only. Keep keys, source and baseHash unchanged.','Use complete scene context; adjacent corpus entries are representative observations, not an exhaustive route transcript.','Preserve all required refs, unknown speaker/subject, uncertainty and route-specific clues.','Warnings require a contextual note; imports remain draft. No API calls.'],sourceCharacters:chars,oversizeSingleEntry:chars>maxChars,
  entries:selected.map(e=>{
   const old=catalog[e.collection][e.key],parts=e.collection==='rich'?JSON.parse(e.source):null;
   const context=e.collection==='rich'?corpus.filter(n=>n.route===e.route&&n.trial===e.trial&&Math.abs(n.step-e.step)<=2).slice(0,12).map(n=>({key:n.key,step:n.step,script:n.script,text:n.text,translation:catalog.rich[n.key]?.source===n.source?translatedText({...n,collection:'rich'},catalog.rich[n.key]):null})):[];
   return {key:e.key,collection:e.collection,kind:e.kind,source:e.source,baseHash:digest(old),location:{script:e.script,page:e.page,offset:e.offset,route:e.route,trial:e.trial,step:e.step},
    requiredRefs:parts?.flatMap((p,ref)=>p.name!==undefined||p.keyword!==undefined||p.color||p.size?[{ref,...p}]:[])??[],
    glossary:relevantRules(glossary,entry,e.text??e.source),context,
    contextNotice:context.length?'Deduplicated observation window; use i18n:context for an actual route transcript.':'No adjacent observed context; investigate source/route before translating.',
    previousTranslation:old??null,translation:old?.source===e.source?(e.collection==='rich'?{parts:old.parts}:{text:old.text}):null,notes:''};
  })};
}
export function checkTask(inputs,task) {
 const {game,corpus,catalog,glossary,gameSha256}=inputs,errors=[],warnings=[];
 if(task.version!==2||task.locale!==catalog.locale||task.sourceSha256!==game.sourceSha256||task.gameSha256!==gameSha256)throw new Error('Task locale/game fingerprint changed; prepare a fresh task');
 if(!Array.isArray(task.entries)||!task.entries.length||task.entries.length>100)throw new Error('Invalid task size');
 const byKey=new Map(inventory(game,corpus,task.entry).entries.map(e=>[e.key,e]));const seen=new Set();
 for(const item of task.entries) {
  try {
   if(seen.has(item.key))throw new Error('Duplicate task key');seen.add(item.key);
   const source=byKey.get(item.key);
   if(!source||source.collection!==item.collection||source.source!==item.source)throw new Error('Unknown key or changed source');
   if(digest(catalog[item.collection][item.key])!==item.baseHash)throw new Error('Translation edit conflict; regenerate this task');
   if(typeof item.notes!=='string')throw new Error('Notes must be text');
   if(item.baseHash!==null&&!item.notes.trim())throw new Error('Revisions require a reason in notes');
   if(!item.translation)throw new Error('Translation is not filled');
   const t={...item.translation,source:item.source,status:'draft'};
   if(item.collection==='rich')validateRichTranslation(JSON.parse(item.source),t);
   else if(!validTranslationText(t.text)||!t.text.trim())throw new Error('Blank text or invalid Unicode controls');
   const text=translatedText(source,t), original=source.collection==='rich'?JSON.parse(source.source).map(p=>p.text).join(''):source.source;
   if(JSON.stringify(placeholders(original))!==JSON.stringify(placeholders(text)))throw new Error('Name placeholders changed');
   const add=message=>warnings.push({key:item.key,message,acknowledged:!!item.notes.trim()});
   if(catalog.locale==='zh-Hans'&&/[\u3041-\u3096\u30a1-\u30fa]/u.test(text))add('Japanese kana remains; inspect names, case identifiers or untranslated refs');
   if(text===original)add('Translation equals source; explain intentional retention');
   const digits=s=>(s.normalize('NFKC').match(/\d+/g)??[]).sort();
   if(JSON.stringify(digits(text))!==JSON.stringify(digits(original)))add('Numbers differ; inspect time, date, amount or a documented source typo');
   for(const rule of relevantRules(glossary,task.entry,original))for(const term of rule.avoid)if(text.includes(term))add(`Glossary ${rule.id}: found ${term}; preferred ${rule.preferred}`);
  }catch(error){errors.push({key:item.key,message:error.message});}
 }
 return {errors,warnings,canApply:!errors.length&&warnings.every(w=>w.acknowledged),editorialStatus:'draft; structural checks are not narrative review'};
}
export function mergeTask(inputs,task) {
 const report=checkTask(inputs,task);
 if(!report.canApply)throw new Error(`Task is not ready: ${JSON.stringify(report)}`);
 const catalog=structuredClone(inputs.catalog);
 for(const e of task.entries)catalog[e.collection][e.key]={source:e.source,...(e.collection==='rich'?{parts:e.translation.parts}:{text:e.translation.text}),status:'draft'};
 validateGameCatalog(catalog,catalog.locale,inputs.game.sourceSha256);
 return catalog;
}
export function loadWorkbench(locale,root='.') {
 if(!Object.hasOwn(localeDefinitions,locale))throw new Error('Unsupported locale');
 const read=p=>fs.readFileSync(path.join(root,p));
 const gameBytes=read('public/game/game.json'), bytes=read('output/localization/routes.jsonl');
 verifyCorpus(bytes,gameBytes,JSON.parse(read('output/localization/routes.jsonl.manifest.json')));
 const catalog=JSON.parse(read(`localization/story/${locale}.json`)),game=JSON.parse(gameBytes);
 validateGameCatalog(catalog,locale,game.sourceSha256);
 const glossaryPath=path.join(root,`localization/glossaries/${locale}.json`);
 return {game,corpus:bytes.toString().trim().split('\n').map(JSON.parse),catalog,gameSha256:sha256(gameBytes),glossary:fs.existsSync(glossaryPath)?json(glossaryPath):null};
}
// Lock plus per-entry optimistic comparison: disjoint tasks can merge, stale edits cannot overwrite.
export function applyTaskFile(root,locale,task) {
 const target=path.join(root,`localization/story/${locale}.json`),lock=`${target}.lock`,temp=`${target}.${process.pid}.tmp`;
 const fd=fs.openSync(lock,'wx');
 try {
  const inputs=loadWorkbench(locale,root),before=fs.readFileSync(target),catalog=mergeTask(inputs,task);
  const archive=path.join(root,'localization/task-archive',locale,`${sha256(JSON.stringify(task))}.json`);
  fs.mkdirSync(path.dirname(archive),{recursive:true});
  if(!fs.existsSync(archive))fs.writeFileSync(archive,JSON.stringify({task,validation:checkTask(inputs,task)},null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(temp,JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});
  if(!fs.readFileSync(target).equals(before))throw new Error('Catalog changed during apply; no overwrite performed');
  fs.renameSync(temp,target);
  return {applied:task.entries.length,archive,reviewed:false};
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);fs.closeSync(fd);fs.unlinkSync(lock);}
}
function main() {
 const [command,...args]=process.argv.slice(2),o={};
 for(let i=0;i<args.length;i+=2){if(!['--locale','--entry','--kind','--limit','--chars','--route','--key','--keys','--file'].includes(args[i])||args[i+1]===undefined)throw new Error('Use status|prepare|check|apply --locale xx --entry 20001 [--kind rich|strings --limit 20 --chars 6000 --route name --key key | --keys json-file --file path]');if(o[args[i].slice(2)]!==undefined)throw new Error('Duplicate option');o[args[i].slice(2)]=args[i+1];}
 const inputs=loadWorkbench(o.locale);
 if(command==='status'){
  const {scope,entries}=inventory(inputs.game,inputs.corpus,Number(o.entry));
  console.log(JSON.stringify({entry:scope.entry,title:scope.title,scriptCount:scope.scripts.size,counts:progress(entries,inputs.catalog),routes:[...new Set(entries.filter(e=>e.route).map(e=>e.route))],scope:'compiled dependency closure + collected route variants; not proof of exhaustive source execution',sourceCoverageGate:scope.entry===20001?'npm run i18n:check:chapter-one':scope.entry===30001?'npm run i18n:check:chapter-two':scope.entry===40001?'npm run i18n:check:chapter-three':'npm run i18n:check:remaining',mediaReview:'separate inventory and browser review required'},null,2));
 }else if(command==='prepare'){
  if(!o.file)throw new Error('--file required');
  const task=prepareTask(inputs,{entry:Number(o.entry),kind:o.kind,limit:o.limit===undefined?20:Number(o.limit),maxChars:o.chars===undefined?6000:Number(o.chars),route:o.route,key:o.key,keys:o.keys?json(o.keys):undefined});
  fs.mkdirSync(path.dirname(o.file),{recursive:true});fs.writeFileSync(o.file,JSON.stringify(task,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({file:o.file,entries:task.entries.length,sourceCharacters:task.sourceCharacters,oversizeSingleEntry:task.oversizeSingleEntry}));
 }else if(['check','apply'].includes(command)){
  if(!o.file)throw new Error('--file required');const task=json(o.file);
  if(o.entry!==undefined&&Number(o.entry)!==task.entry)throw new Error('Task chapter mismatch');
  if(command==='apply')console.log(JSON.stringify(applyTaskFile('.',o.locale,task),null,2));
  else {const report=checkTask(inputs,task);console.log(JSON.stringify(report,null,2));if(!report.canApply)process.exitCode=1;}
 }else throw new Error('Command must be status, prepare, check or apply');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
