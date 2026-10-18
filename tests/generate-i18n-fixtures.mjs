// Replay the real prologue for multilingual name input and mixed-direction presentation.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createState, run, advance, submitName, validateSave } from '../src/game/engine.ts';
const bytes = readFileSync('public/game/game.json');
const data = JSON.parse(bytes);
const fixtures = {};
let state = run(data, createState(data));
for (let step = 0; step < 100; step++) {
  if (state.mode === 'input') {
    fixtures[`name-${state.input.field}`] = validateSave(data, state);
    state = submitName(data, state, state.input.field === 0 ? 'Smith' : 'ليلى');
  } else if (state.mode === 'page') {
    if (state.page.parts?.some(part => part.name !== undefined)) {
      fixtures['mixed-names'] = validateSave(data, state);
      break;
    }
    state = advance(data, state);
  } else throw new Error(`Unexpected prologue mode ${state.mode}`);
}
if (Object.keys(fixtures).length !== 3) throw new Error('Missing real name input fixtures');
mkdirSync('output/qa/i18n', {recursive:true});
writeFileSync('output/qa/i18n/fixtures.json', JSON.stringify(fixtures));
writeFileSync('output/qa/i18n/report.json', JSON.stringify({dataSha256:createHash('sha256').update(bytes).digest('hex')}));
console.log(`Generated ${Object.keys(fixtures).join(', ')} from the real prologue.`);
