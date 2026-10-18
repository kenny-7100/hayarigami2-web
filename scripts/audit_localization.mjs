/** Report actual localization coverage. --complete is a release gate, not a translation shortcut. */
import fs from 'node:fs';
import { localeDefinitions } from '../src/i18n/locale.ts';
import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
const game = JSON.parse(fs.readFileSync('public/game/game.json', 'utf8'));
const uiReference = JSON.parse(fs.readFileSync('localization/ui/en.json', 'utf8'));
const source = fs.existsSync('output/localization/source.jsonl') ? fs.readFileSync('output/localization/source.jsonl','utf8').trim().split('\n').map(JSON.parse) : [];
const routeSource = fs.existsSync('output/localization/routes.jsonl') ? fs.readFileSync('output/localization/routes.jsonl','utf8').trim().split('\n').map(JSON.parse) : [];
const errors=[];
const coverageBlockers = ['Raw script fragments are not yet exhaustively linked to displayed translations, including conditional variants and chapter zero branches', 'Embedded image text has not yet been inventoried and localized'];
const report={coverageBlockers,scope:'18 languages / 19 locales; route corpus is not exhaustive source coverage',locales:{},errors};
for(const locale of Object.keys(localeDefinitions)) {
 const uiPath=`localization/ui/${locale}.json`;
 const ui=fs.existsSync(uiPath)?JSON.parse(fs.readFileSync(uiPath,'utf8')):{};
 const missingUI=Object.keys(uiReference).filter(key=>!ui[key]);
 if(missingUI.length)errors.push(`${locale}: ${missingUI.length} UI entries missing`);
 const storyPath=`localization/story/${locale}.json`;
 const story=fs.existsSync(storyPath)?JSON.parse(fs.readFileSync(storyPath,'utf8')):{strings:{},rich:{}};
 try { validateGameCatalog(story,locale,game.sourceSha256); } catch(error) { errors.push(`${locale}: ${error.message}`); }
 const plain=source.filter(entry=>entry.kind!=='script-fragment'&&entry.kind!=='pageText');
 const match=entry=>story.strings[entry.key]?.source===entry.source;
 const translated=routeSource.filter(entry=>story.rich[entry.key]?.source===entry.source);
 report.locales[locale]={ui:Object.keys(ui).length,uiRequired:Object.keys(uiReference).length,missingUI,
  plainAuthored:plain.filter(match).length,plainRequired:plain.length,
  richAuthored:Object.keys(story.rich).length,richMatchedToRoutes:translated.length,routePassages:routeSource.length,
  richReviewed:translated.filter(entry=>story.rich[entry.key].status==='reviewed').length};
 if(process.argv.includes('--complete')) {
  if(!source.length||!routeSource.length)errors.push('Source inventories must be generated before release');
  if(plain.some(entry=>!match(entry)||story.strings[entry.key].status!=='reviewed'))errors.push(`${locale}: plain game text incomplete or unreviewed`);
  if(translated.length!==routeSource.length||translated.some(entry=>story.rich[entry.key].status!=='reviewed'))errors.push(`${locale}: route story text incomplete or unreviewed`);
 }
}
if(process.argv.includes('--complete')) errors.push(...coverageBlockers);
fs.mkdirSync('output/localization',{recursive:true});
fs.writeFileSync('output/localization/coverage.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
