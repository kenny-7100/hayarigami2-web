import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { localizationRoute } from '../scripts/localization_routes.mjs';

test('both legacy first-chapter fixtures enter the translation corpus without changing their evidence', () => {
  for (const branch of ['science', 'occult']) {
    const file = `chapter-one-${branch}.json`;
    const input = JSON.parse(readFileSync(`tests/fixtures/${file}`, 'utf8'));
    const original = structuredClone(input);
    const route = localizationRoute(file, input);
    assert.equal(route.entry, 20001);
    assert.ok(route.trace.length > 0);
    assert.deepEqual(input, original);
    assert.deepEqual(route.answers, input.answers);
    assert.deepEqual(route.trace, input.trace);
  }
});

test('all discovered chapter fixtures have explicit replay inputs; malformed new routes fail closed', () => {
  const files = readdirSync('tests/fixtures').filter(file => /^chapter-(?:one|[2-8])-.+\.json$/.test(file));
  assert.ok(files.length >= 2);
  for (const file of files) {
    assert.doesNotThrow(() => localizationRoute(file, JSON.parse(readFileSync(`tests/fixtures/${file}`, 'utf8'))));
  }
  for (const [file, input] of [
    ['chapter-one-new.json', { trace: [] }],
    ['chapter-2-science.json', { trace: [] }],
    ['chapter-one-science.json', {}],
    ['chapter-2-science.json', { entry: 30001, trace: null }],
  ]) assert.throws(() => localizationRoute(file, input), /Invalid localization route fixture/);
});

import { prepareBatch } from '../scripts/localization_batch.mjs';
test('branch translation context never combines unrelated random trials', () => {
 const corpus = [
  {key:'a',route:'branches',trial:1,step:8,text:'before',source:'[]'},
  {key:'b',route:'branches',trial:1,step:9,text:'current',source:'[]'},
  {key:'c',route:'branches',trial:2,step:9,text:'different branch',source:'[]'},
 ];
 const batch=prepareBatch(corpus,{rich:{a:{source:'[]'}},locale:'zh-Hans',sourceSha256:'test'},{limit:1});
 assert.deepEqual(batch.entries[0].context.map(e=>e.key),['a','b']);
});
