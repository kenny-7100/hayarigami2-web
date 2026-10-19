import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkChapterOne, loadInputs } from '../scripts/check_chapter_one_translation.mjs';
const available = fs.existsSync('output/localization/chapter-one-source-coverage.json');
test('first-chapter authored corpus, dictionary, relations and confirmation are complete', { skip: !available && 'Run npm run i18n:extract for source coverage' }, () => {
 const inputs = loadInputs();
 assert.equal(checkChapterOne(inputs).rich,6050);
 for(const key of ['prompt.23000.139','definitions.52',Object.keys(inputs.catalog.strings).find(k => k.startsWith('logic.3.description.'))]) {
  assert.ok(inputs.catalog.strings[key]);
  const entry = inputs.catalog.strings[key];
  delete inputs.catalog.strings[key];
  assert.throws(() => checkChapterOne(inputs), /Missing\/stale translation/);
  inputs.catalog.strings[key]=entry;
 }
 const passage = inputs.routes.find(e => e.script === 27220);
 assert.ok(passage);
 const entry=inputs.catalog.rich[passage.key];
 delete inputs.catalog.rich[passage.key];
 assert.throws(() => checkChapterOne(inputs), /Missing\/stale translation/);
 inputs.catalog.rich[passage.key]=entry;
 inputs.coverage.gameSha256='stale';
 assert.throws(() => checkChapterOne(inputs), /Stale source coverage/);
});
