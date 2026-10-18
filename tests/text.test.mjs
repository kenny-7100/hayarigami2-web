import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createState, run, advance, validateSave, parseGameData } from '../src/game/engine.ts';
import { presentText } from '../src/game/text.ts';
const data = parseGameData(JSON.parse(readFileSync('public/game/game.json', 'utf8')));
function block(script, opcode) {
  const instructions = data.scripts[script].instructions;
  const site = instructions.findIndex(i => i.op === opcode);
  let start = site;
  while (instructions[start].op !== 3) start--;
  const state = createState(data); state.script = script; state.pc = start;
  return run(data, state);
}
test('actual keyword instruction highlights new / known and collects only once', () => {
  const first = block(10301, 2001);
  assert.equal(first.mode, 'page', first.error);
  assert.ok(first.page.text.includes(`〔${data.keywords[4600]}〕`));
  assert.equal(first.page.spans.find(s => s.keyword === 4600).color, 2);
  assert.deepEqual(first.page.acquisitions, [{ kind: 'keyword', id: 4600 }]);
  const state = createState(data); state.script = 10301; state.pc = data.scripts[10301].instructions.findIndex(i => i.offset === first.page.offset); state.flags = [4600];
  const known = run(data, state);
  assert.equal(known.page.spans.find(s => s.keyword === 4600).color, 7);
  assert.deepEqual(known.page.acquisitions, []);
  assert.deepEqual(validateSave(data, JSON.parse(JSON.stringify(first))), first);
});
test('actual dictionary instructions retain split patched text and collect multiple terms', () => {
  const first = block(2, 2013);
  assert.equal(first.mode, 'page', first.error);
  assert.ok(first.page.text.includes('ＮＳＡ'));
  assert.deepEqual(first.page.acquisitions.map(e => e.id), [2, 3]);
  assert.equal(first.page.spans.some(s => s.keyword), false);
  const state = createState(data); state.script = 2; state.pc = data.scripts[2].instructions.findIndex(i => i.offset === first.page.offset); state.unlocked = [2, 3];
  assert.deepEqual(run(data, state).page.acquisitions, []);
});
test('actual style stack applies high-byte palette and low-byte signed size', () => {
  const first = block(1, 205);
  assert.equal(first.mode, 'page', first.error);
  assert.ok(first.page.spans.some(s => s.color === 1 && s.size === 3));
  assert.deepEqual(first.textStyles, [{color: 0, size: 0}]);
});
test('normalization keeps annotated Unicode ranges and never guesses replaced text', () => {
  const source = '  ——\u2014\n\n\n词语  ';
  const start = source.indexOf('词');
  const page = presentText(source, [{ start, end: start + 2, color: 2, size: 0, keyword: 1 }]);
  assert.equal(page.text, '——\n\n词语');
  assert.equal(page.text.slice(page.spans[0].start, page.spans[0].end), '词语');
  assert.deepEqual(presentText(source, page.spans, '新文案').spans, []);
});
test('legacy save reads and malformed rich metadata is rejected', () => {
  const first = block(10301, 2001);
  const legacy = structuredClone(first);
  delete legacy.bufferSpans; delete legacy.textStyles; delete legacy.pendingAcquisitions;
  delete legacy.page.spans; delete legacy.page.acquisitions;
  legacy.history = [legacy.page]; legacy.adapted.push(205,206);
  assert.equal(validateSave(data, legacy).page.text, first.page.text);
  const invalid = structuredClone(first); invalid.page.spans[0].end = 99999;
  assert.throws(() => validateSave(data, invalid));
  const badEvent = structuredClone(first); badEvent.page.acquisitions[0].kind = 'fake';
  assert.throws(() => validateSave(data, badEvent));
  assert.notEqual(advance(data, validateSave(data, legacy)).mode, 'error');
});
