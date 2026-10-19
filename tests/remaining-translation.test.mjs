import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkbench,inventory} from '../scripts/translation_workbench.mjs';
import {checkRemaining,loadReports} from '../scripts/check_remaining_translation.mjs';
test('all remaining chapters have current authored text and accounted source sites',()=>{
 assert.equal(checkRemaining(loadWorkbench('zh-Hans'),loadReports()).chapters.length,7);
});
test('remaining gate rejects missing translations, stale coverage, hidden gaps and inline terminology drift',()=>{
 const i=loadWorkbench('zh-Hans'),r=loadReports();
 r[90001].missing.pop();assert.throws(()=>checkRemaining(i,r),/spacing/);
 const fresh=loadReports();fresh[1].gameSha256='stale';assert.throws(()=>checkRemaining(i,fresh),/Stale/);
 const first=inventory(i.game,i.corpus,10001).entries.find(e=>e.collection==='rich');
 delete i.catalog.rich[first.key];
 assert.throws(()=>checkRemaining(i,loadReports()),/Missing/);
 const altered=loadWorkbench('zh-Hans');altered.catalog.strings['keywords.5214'].text='错误校名';
 assert.throws(()=>checkRemaining(altered,loadReports()),/Keyword/);
});
