// Real script blocks for focused presentation QA; not a complete route proof.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createState, run, advance, validateSave } from '../src/game/engine.ts';
const bytes = readFileSync('public/game/game.json');
const data = JSON.parse(bytes);
const fixtures = {};
for (const [name, script, op] of [['keyword',10301,2001], ['dictionary',2,2013], ['emphasis',1,205]]) {
  const instructions = data.scripts[script].instructions;
  let index = instructions.findIndex(i => i.op === op);
  while (instructions[index].op !== 3) index--;
  let previous = index - 1;
  while (previous >= 0 && instructions[previous].op !== 3) previous--;
  const state = createState(data); state.script = script; state.pc = Math.max(0, previous);
  // Source image is deliberately explicit for this isolated block fixture.
  state.layers = { 0: { asset: 196, alpha: 1 } };
  const before = run(data, state);
  fixtures[`${name}-before`] = validateSave(data, before);
  const after = advance(data, before);
  fixtures[name] = validateSave(data, after);
}
mkdirSync('output/qa/text', {recursive:true});
writeFileSync('output/qa/text/fixtures.json', JSON.stringify(fixtures));
writeFileSync('output/qa/text/report.json', JSON.stringify({dataSha256:createHash('sha256').update(bytes).digest('hex')}));
console.log(Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,[v.page?.text,v.page?.acquisitions]])));
