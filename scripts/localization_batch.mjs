/** Contextual, offline translation batches. No network services or automatic translation. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localeDefinitions } from '../src/i18n/locale.ts';
import { validateGameCatalog } from '../src/i18n/gameCatalog.ts';
import { validateRichTranslation } from '../src/i18n/richText.ts';

export function prepareBatch(corpus, catalog, { route, limit = 20 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Batch limit must be 1–100');
  const selected = corpus.filter(entry => (!route || entry.route === route) && catalog.rich[entry.key]?.source !== entry.source).slice(0, limit);
  return {
    version: 1, locale: catalog.locale, sourceSha256: catalog.sourceSha256,
    note: 'Translate complete passages in context. Preserve every required ref. Draft only; importing is not review.',
    entries: selected.map(entry => {
      const nearby = corpus.filter(item => item.route === entry.route && Math.abs(item.step - entry.step) <= 2);
      return {
        key: entry.key, source: entry.source, text: entry.text, route: entry.route, step: entry.step,
        script: entry.script, context: nearby.map(item => ({ key: item.key, text: item.text, step: item.step })),
        parts: null, translatorNotes: '',
      };
    }),
  };
}

export function mergeBatch(corpus, catalog, batch) {
  if (batch.version !== 1 || batch.locale !== catalog.locale || batch.sourceSha256 !== catalog.sourceSha256) throw new Error('Batch locale or source fingerprint changed');
  if (!Array.isArray(batch.entries) || !batch.entries.length || batch.entries.length > 100) throw new Error('Invalid batch size');
  const byKey = new Map(corpus.map(entry => [entry.key, entry]));
  const seen = new Set();
  const rich = { ...catalog.rich };
  for (const entry of batch.entries) {
    if (!entry || seen.has(entry.key)) throw new Error('Duplicate or invalid batch entry');
    seen.add(entry.key);
    const source = byKey.get(entry.key);
    if (!source || source.source !== entry.source) throw new Error(`Source changed or key is unknown: ${entry.key}`);
    if (catalog.rich[entry.key]) throw new Error(`Existing translation requires explicit editing and review: ${entry.key}`);
    if (typeof entry.translatorNotes !== 'string') throw new Error(`Translator notes must be text: ${entry.key}`);
    const translation = { source: entry.source, parts: entry.parts, status: 'draft' };
    validateRichTranslation(JSON.parse(entry.source), translation);
    rich[entry.key] = translation;
  }
  const merged = { ...catalog, rich };
  validateGameCatalog(merged, catalog.locale, catalog.sourceSha256);
  return merged;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--locale', '--route', '--limit', '--file'].includes(args[i]) || args[i + 1] === undefined) throw new Error('Use export/import --locale <locale> --file <path> [--route <route>] [--limit 20]');
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!Object.hasOwn(localeDefinitions, options.locale) || !options.file) throw new Error('A supported --locale and --file are required');
  const corpus = fs.readFileSync('output/localization/routes.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
  const catalogPath = `localization/story/${options.locale}.json`;
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const game = JSON.parse(fs.readFileSync('public/game/game.json', 'utf8'));
  validateGameCatalog(catalog, options.locale, game.sourceSha256);
  if (command === 'export') {
    const batch = prepareBatch(corpus, catalog, { route: options.route, limit: options.limit === undefined ? 20 : Number(options.limit) });
    if (!batch.entries.length) throw new Error('No untranslated passages match this route');
    fs.mkdirSync(path.dirname(options.file), { recursive: true });
    fs.writeFileSync(options.file, JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
    console.log(`Prepared ${batch.entries.length} passages for ${options.locale}: ${options.file}`);
  } else if (command === 'import') {
    const batch = JSON.parse(fs.readFileSync(options.file, 'utf8'));
    const merged = mergeBatch(corpus, catalog, batch);
    const temporary = `${catalogPath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(merged, null, 2) + '\n');
    fs.renameSync(temporary, catalogPath);
    console.log(`Imported ${batch.entries.length} draft passages for ${options.locale}; narrative review is still required.`);
  } else throw new Error('Command must be export or import');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
