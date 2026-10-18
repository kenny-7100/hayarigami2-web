import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLocale, resolveLocale, localizedUrl } from '../src/i18n/locale.ts';
const available = ['zh-Hans', 'zh-Hant', 'ja', 'en', 'ar'];
test('locale negotiation respects shared URL, saved choice, then browser priority', () => {
  assert.equal(resolveLocale('/ja/', 'ar', ['en-US'], available), 'ja');
  assert.equal(resolveLocale('/', 'ar', ['en-US'], available), 'ar');
  assert.equal(resolveLocale('/', null, ['fr-FR', 'zh-TW', 'en'], available), 'zh-Hant');
  assert.equal(resolveLocale('/', 'bad', ['fr-FR'], available), 'en');
  assert.equal(resolveLocale('/ar/', 'ja', ['en'], ['ja', 'en']), 'ja');
});
test('regional language aliases are supported without prefix false positives', () => {
  for (const tag of ['zh-TW', 'zh-HK', 'zh-Hant', 'zh_MO']) assert.equal(matchLocale(tag), 'zh-Hant');
  for (const tag of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh']) assert.equal(matchLocale(tag), 'zh-Hans');
  assert.equal(matchLocale('EN-us'), 'en');
  assert.equal(matchLocale('ar-EG'), 'ar');
  assert.equal(matchLocale('jargon'), null);
  assert.equal(matchLocale('english'), null);
});
test('language navigation preserves route, query and hash and canonicalizes aliases', () => {
  assert.equal(localizedUrl('https://example.test/zh-CN/?slot=3#story', 'ja'), '/ja/?slot=3#story');
  assert.equal(localizedUrl('/en/chapter/2?route=science#choice', 'ar'), '/ar/chapter/2?route=science#choice');
  assert.equal(localizedUrl('/', 'en'), '/en/');
  assert.equal(localizedUrl('/ja', 'en'), '/en/');
});

import fs from 'node:fs';
import path from 'node:path';
test('authored UI catalogs cover the reference keys and preserve named parameters', () => {
  const root = new URL('../localization/ui/', import.meta.url);
  const reference = JSON.parse(fs.readFileSync(new URL('en.json', root), 'utf8'));
  const placeholders = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const file of fs.readdirSync(root).filter(file => file.endsWith('.json') && file !== 'source.json')) {
    const catalog = JSON.parse(fs.readFileSync(new URL(file, root), 'utf8'));
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(reference).sort(), file);
    for (const [key, text] of Object.entries(catalog)) {
      assert.equal(typeof text, 'string', `${file}:${key}`);
      assert.ok(text.trim(), `${file}:${key}`);
      assert.deepEqual(placeholders(text), placeholders(key), `${file}:${key}`);
      assert.ok(!/[\uFFFD\u202A-\u202E\u2066-\u2069]/u.test(text), `${file}:${key}: unexpected replacement or bidi control`);
    }
    assert.ok(available.includes(path.basename(file, '.json')) || ['hi','es','fr','bn','pt','ru','id','ur','de','mr','vi','te','tr','ta'].includes(path.basename(file, '.json')));
  }
});

import { richKey, sourceSignature, translateParts } from '../src/i18n/richText.ts';
import { localizePage, renderParts } from '../src/i18n/gameCatalog.ts';
test('rich translations reorder player names and retain keyword identity and highlight style', () => {
  const parts = [{text:'姓',name:0,color:0,size:0},{text:'名',name:1,color:0,size:0},{text:'发现了',color:0,size:0},{text:'〔线索〕',keyword:7,color:2,size:0,fresh:true}];
  const translation = {source:sourceSignature(parts),status:'draft',parts:[{ref:1},{text:' '},{ref:0},{text:' found '},{ref:3,text:'a clue'}]};
  const page = renderParts(translateParts(parts, translation));
  assert.equal(page.text, '名 姓 found a clue');
  const keywordSpan = page.spans.find(span => span.keyword === 7);
  assert.ok(keywordSpan);
  assert.equal(page.text.slice(keywordSpan.start, keywordSpan.end), 'a clue');
  assert.deepEqual(page.spans.filter(span => span.name !== undefined).map(span => span.name), [1,0]);
  const known = parts.map(part => part.keyword ? {...part,fresh:false,color:7} : part);
  assert.equal(richKey('page.1', parts), richKey('page.1', known));
  assert.equal(renderParts(translateParts(known,translation)).spans.find(span => span.keyword === 7).color,7);
  const custom = parts.map(part => part.name === 0 ? {...part,text:'Custom'} : part);
  assert.equal(richKey('page.1', parts),richKey('page.1',custom));
  assert.match(renderParts(translateParts(custom,translation)).text,/Custom/);
  assert.throws(()=>translateParts(parts,{...translation,parts:[{text:'removed all references'}]}));
  assert.throws(()=>translateParts(parts,{...translation,parts:[{ref:0,text:'Overwrite'},{ref:1},{ref:3}]}));
  assert.throws(()=>translateParts(parts,{...translation,source:'stale'}));
});
test('legacy pages only acquire a translation after exact full-source matching', () => {
  const parts=[{text:'Hello '},{text:'Name',name:1}];
  const key=richKey('page.1:10',parts);
  const catalog={locale:'en',sourceSha256:'test',strings:{},rich:{[key]:{source:sourceSignature(parts),status:'draft',parts:[{text:'Greetings '},{ref:1}]}}};
  const legacy={id:'1:10',script:1,offset:10,text:'Hello Custom',background:null};
  assert.equal(localizePage(catalog,legacy,['Surname','Custom']).text,'Greetings Custom');
  assert.equal(localizePage(catalog,{...legacy,text:'Different branch'},['Surname','Custom']).text,'Different branch');
  assert.equal(legacy.text,'Hello Custom');
});
test('all authored story entries preserve required source references', () => {
  for(const file of fs.readdirSync('localization/story').filter(file=>file.endsWith('.json'))) {
    const catalog=JSON.parse(fs.readFileSync(`localization/story/${file}`,'utf8'));
    for(const [key,entry] of Object.entries(catalog.rich)) {
      const parts=JSON.parse(entry.source);
      assert.doesNotThrow(()=>translateParts(parts,entry),`${file}:${key}`);
    }
  }
});

import { validPlayerName } from '../src/i18n/names.ts';
test('player names count graphemes and permit shaping joiners without bidi controls',()=>{
 for(const name of ['Alexandra','عبد الرحمن','தமிழ்','తెలుగు','किरण','শুভ্র','A\u0301'.repeat(32),'👩‍💻'.repeat(32)])assert.equal(validPlayerName(name),true,name);
 for(const name of ['', ' '.repeat(3),'x'.repeat(33),'x\u0000','x\u202e','x\u2066'])assert.equal(validPlayerName(name),false,name);
});

import { formatMessage, shortenChartLabel } from '../src/i18n/format.ts';
test('numeric interpolation follows locale and isolates mixed-direction values',()=>{
 assert.equal(formatMessage('ar','القيمة {number}: {name}',{number:1234,name:'Junya'}),`القيمة \u2068${new Intl.NumberFormat('ar').format(1234)}\u2069: \u2068Junya\u2069`);
 assert.equal(formatMessage('en','Keep {missing}',{}),'Keep {missing}');
 assert.equal(shortenChartLabel('Short'),'Short');
 assert.ok(shortenChartLabel('Donaudampfschifffahrtsgesellschaft').endsWith('…'));
 assert.ok(!shortenChartLabel('👩‍💻'.repeat(20)).includes('�'));
});

import { localizeChoice } from '../src/i18n/gameCatalog.ts';
test('legacy choices match their complete source and safely ignore malformed candidates', () => {
  const parts = [{text:'Ask '},{text:'Name',name:1}];
  const id = 'choice.2.45.0';
  const entry = {source:sourceSignature(parts),status:'draft',parts:[{text:'Fragen: '},{ref:1}]};
  const catalog = {locale:'de',sourceSha256:'test',strings:{},rich:{[`${id}.bad`]:{source:'null',parts:[]},[richKey(id,parts)]:entry}};
  assert.equal(localizeChoice(catalog,id,{text:'Ask Alex'},['Smith','Alex']),'Fragen: Alex');
  assert.equal(localizeChoice(catalog,id,{text:'Ask someone else'},['Smith','Alex']),'Ask someone else');
  assert.equal(localizeChoice(catalog,id,{text:'Ask Alex'}),'Ask Alex');
  assert.equal(localizeChoice(catalog,id,{text:'Ask Alex',parts:[{text:'Ask '},{text:'Alex',name:1}]},['Smith','Alex']),'Fragen: Alex');
});

import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
test('catalog loading rejects broken provenance, references, and stale source before rendering', () => {
  for (const file of fs.readdirSync('localization/story').filter(file=>file.endsWith('.json'))) {
    const catalog=JSON.parse(fs.readFileSync(`localization/story/${file}`,'utf8'));
    assert.doesNotThrow(()=>validateGameCatalog(catalog,catalog.locale,catalog.sourceSha256),file);
  }
  const parts=[{text:'Name',name:0}];
  const key=richKey('page.1',parts);
  const valid={locale:'en',sourceSha256:'test',strings:{},rich:{[key]:{source:sourceSignature(parts),status:'draft',parts:[{ref:0}]}}};
  assert.throws(()=>validateGameCatalog(valid,'en','stale'));
  for(const source of ['null','{}','[null]','[{"text":4}]']) {
    assert.throws(()=>validateGameCatalog({...valid,rich:{[key]:{...valid.rich[key],source}}},'en','test'));
  }
  assert.throws(()=>validateGameCatalog({...valid,rich:{[key]:{...valid.rich[key],parts:[{ref:99}]}}},'en','test'));
  assert.throws(()=>validateGameCatalog({...valid,strings:{name:{source:'Name',text:' ',status:'draft'}}},'en','test'));
});

test('language store keeps URL precedence, back navigation, subscribers and unavailable storage working', async () => {
  const saved = new Map([['hs2.locale','ja']]);
  const listeners = {};
  let href = 'https://example.test/ar/?slot=2#story';
  const urls=[];
  const mocks={
    window:{addEventListener:(type,callback)=>{listeners[type]=callback;}},
    document:{documentElement:{lang:'',dir:''}},
    navigator:{languages:['de-DE'],language:'de-DE'},
    location:{get href(){return href;},get pathname(){return new URL(href).pathname;},get search(){return new URL(href).search;}},
    history:{state:{test:1},replaceState:(_state,_title,url)=>{href=new URL(url,href).href;urls.push(['replace',url]);},pushState:(_state,_title,url)=>{href=new URL(url,href).href;urls.push(['push',url]);}},
    localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}
  };
  const descriptors=Object.fromEntries(Object.keys(mocks).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  try {
    for(const [key,value] of Object.entries(mocks))Object.defineProperty(globalThis,key,{configurable:true,value});
    const store=await import('../src/i18n/store.ts');
    store.initializeLocale();
    assert.equal(store.getLocale(),'ar');
    assert.equal(document.documentElement.dir,'rtl');
    assert.equal(urls.length,1);
    store.initializeLocale();
    assert.equal(urls.length,1);
    let updates=0;
    const unsubscribe=store.subscribeLocale(()=>updates++);
    store.changeLocale('de');
    assert.equal(new URL(href).pathname,'/de/');
    assert.equal(new URL(href).search,'?slot=2');
    assert.equal(new URL(href).hash,'#story');
    assert.equal(saved.get('hs2.locale'),'de');
    assert.equal(document.documentElement.dir,'ltr');
    assert.equal(updates,1);
    href='https://example.test/ar/?slot=2#story';
    listeners.popstate();
    assert.equal(store.getLocale(),'ar');
    assert.equal(saved.get('hs2.locale'),'ar');
    mocks.localStorage.setItem=()=>{throw new Error('blocked');};
    assert.doesNotThrow(()=>store.changeLocale('ur'));
    assert.equal(document.documentElement.lang,'ur');
    assert.equal(new URL(href).pathname,'/ur/');
    unsubscribe();
    const previous=updates;
    store.changeLocale('en');
    assert.equal(updates,previous);
  } finally {
    for(const [key,descriptor] of Object.entries(descriptors)) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
  }
});

import { prepareBatch, mergeBatch } from '../scripts/localization_batch.mjs';
test('offline batches retain scene context and reject stale, repeated, overwritten or incomplete translations', () => {
  const parts=[{text:'Hello '},{text:'Name',name:0}];
  const key=richKey('page.1:20',parts);
  const corpus=[{key,source:sourceSignature(parts),text:'Hello Name',script:1,step:1,route:'opening'}];
  const catalog={locale:'en',sourceSha256:'test',strings:{},rich:{}};
  const batch=prepareBatch(corpus,catalog,{route:'opening',limit:1});
  assert.equal(batch.entries.length,1);
  assert.equal(batch.entries[0].context[0].text,'Hello Name');
  assert.throws(()=>mergeBatch(corpus,catalog,batch));
  batch.entries[0].parts=[{text:'Greetings '},{ref:1}];
  const merged=mergeBatch(corpus,catalog,batch);
  assert.equal(merged.rich[key].status,'draft');
  assert.equal(Object.keys(catalog.rich).length,0);
  assert.equal(prepareBatch(corpus,merged).entries.length,0);
  assert.throws(()=>mergeBatch(corpus,merged,batch));
  assert.throws(()=>mergeBatch(corpus,catalog,{...batch,sourceSha256:'stale'}));
  assert.throws(()=>mergeBatch(corpus,catalog,{...batch,entries:[...batch.entries,...batch.entries]}));
  assert.throws(()=>mergeBatch(corpus,catalog,{...batch,entries:[{...batch.entries[0],source:'[]'}]}));
  assert.throws(()=>prepareBatch(corpus,catalog,{limit:101}));
});

test('translation validation rejects hidden direction overrides and erased emphasis without blocking shaping joiners', () => {
  const parts=[{text:'clue',keyword:1,color:2}];
  const base={source:sourceSignature(parts),status:'draft'};
  for(const text of ['', '  ', 'clue\u202e', 'clue\u0000', '�']) assert.throws(()=>translateParts(parts,{...base,parts:[{ref:0,text}]}));
  assert.doesNotThrow(()=>translateParts(parts,{...base,parts:[{ref:0,text:'می\u200cروم'}]}));
});

import { localizedString } from '../src/i18n/gameCatalog.ts';
test('untranslated and absent optional graph descriptions never dereference a missing catalog entry', () => {
  const catalog = {locale:'en', sourceSha256:'test', strings:{}, rich:{}};
  assert.equal(localizedString(catalog, 'logic.5.description.0', undefined), undefined);
  assert.equal(localizedString(null, 'logic.5.description.0', ''), '');
  assert.equal(localizedString(catalog, 'missing', '原文'), '原文');
  const localized = {...catalog, strings:{title:{source:'原文',text:'Translated',status:'draft'}}};
  assert.equal(localizedString(localized, 'title', '原文'), 'Translated');
  assert.equal(localizedString(localized, 'title', 'changed'), 'changed');
});
