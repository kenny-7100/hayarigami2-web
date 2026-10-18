import type { Page } from '../game/engine.ts';
import { presentText } from '../game/text.ts';
import type { TextSpan } from '../game/text.ts';
import { richKey, sourceSignature, translateParts, validRichParts, validateRichTranslation, validTranslationText } from './richText.ts';
import type { RichPart, RichTranslation } from './richText.ts';
import type { Locale } from './locale.ts';
export type GameCatalog = {
  locale: Locale;
  sourceSha256: string;
  strings: Record<string, { source: string; text: string; status: 'draft' | 'reviewed' }>;
  rich: Record<string, RichTranslation>;
};
/** Reject a damaged pack before mounting translated content; the provider offers retry. */
export function validateGameCatalog(value: unknown, locale: Locale, sourceSha256: string): asserts value is GameCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid localization package');
  const catalog = value as GameCatalog;
  if (catalog.locale !== locale || catalog.sourceSha256 !== sourceSha256) throw new Error('Localization package does not match the game');
  for (const collection of [catalog.strings, catalog.rich]) {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) throw new Error('Invalid localization entries');
  }
  for (const entry of Object.values(catalog.strings)) {
    if (!entry || typeof entry.source !== 'string' || !validTranslationText(entry.text) || !entry.text.trim() || !['draft', 'reviewed'].includes(entry.status)) throw new Error('Invalid localized string');
  }
  for (const [key, entry] of Object.entries(catalog.rich)) {
    if (!entry || typeof entry.source !== 'string' || !['draft', 'reviewed'].includes(entry.status)) throw new Error('Invalid rich translation');
    const parts = JSON.parse(entry.source) as RichPart[];
    const keywords = Object.fromEntries(Array.isArray(parts) ? parts.filter(part => part?.keyword !== undefined).map(part => [part.keyword, '']) : []);
    if (!Array.isArray(parts) || !validRichParts(parts, keywords)) throw new Error('Invalid translation provenance');
    if (richKey(key.slice(0, key.lastIndexOf('.')), parts) !== key) throw new Error('Invalid translation key');
    validateRichTranslation(parts, entry);
  }
}
export function renderParts(parts: RichPart[]) {
  let text = '';
  const spans: TextSpan[] = [];
  for (const part of parts) {
    if (part.color || part.size || part.keyword !== undefined || part.name !== undefined) spans.push({ start: text.length, end: text.length + part.text.length, color: part.color ?? 0, size: part.size ?? 0, ...(part.name !== undefined ? { name: part.name } : {}), ...(part.keyword !== undefined ? { keyword: part.keyword, fresh: part.fresh } : {}) });
    text += part.text;
  }
  return presentText(text, spans.filter(span => span.end > span.start));
}
export function localizedString(catalog: GameCatalog | null, key: string, source: string): string {
  const entry = catalog?.strings[key];
  return entry && entry.source === source ? entry.text : source;
}
// Catalogs are immutable after loading. Index legacy candidates once, not once per history row.
const legacyIndexes = new WeakMap<GameCatalog, Map<string, { parts: RichPart[]; entry: RichTranslation }[]>>();
function legacyCandidates(catalog: GameCatalog, id: string) {
  let index = legacyIndexes.get(catalog);
  if (!index) {
    index = new Map();
    for (const [key, entry] of Object.entries(catalog.rich)) {
      try {
        const parts = JSON.parse(entry.source) as RichPart[];
        const keywords = Object.fromEntries(Array.isArray(parts) ? parts.filter(part => part?.keyword !== undefined).map(part => [part.keyword, '']) : []);
        if (!Array.isArray(parts) || !validRichParts(parts, keywords)) continue;
        validateRichTranslation(parts, entry);
        const base = key.slice(0, key.lastIndexOf('.'));
        const candidates = index.get(base) ?? [];
        candidates.push({ parts, entry });
        index.set(base, candidates);
      } catch { /* Invalid legacy entries cannot replace original text. */ }
    }
    legacyIndexes.set(catalog, index);
  }
  return index.get(id) ?? [];
}
function findTranslation(catalog: GameCatalog, id: string, source: { text: string; parts?: RichPart[] }, names: string[]) {
  if (source.parts) {
    const entry = catalog.rich[richKey(id, source.parts)];
    return entry?.source === sourceSignature(source.parts) ? { parts: source.parts, entry } : null;
  }
  for (const candidate of legacyCandidates(catalog, id)) {
    if (candidate.parts.some(part => part.name !== undefined && typeof names[part.name] !== 'string')) continue;
    const parts = candidate.parts.map(part => ({ ...part, text: part.name !== undefined ? names[part.name] : part.text }));
    if (renderParts(parts).text === source.text) return { parts, entry: candidate.entry };
  }
  return null;
}
export function localizePage(catalog: GameCatalog | null, page: Page, names: string[]): Page {
  if (!catalog) return page;
  const match = findTranslation(catalog, `page.${page.id}`, page, names);
  return match ? { ...page, ...renderParts(translateParts(match.parts, match.entry)) } : page;
}
export function localizeChoice(catalog: GameCatalog | null, id: string, choice: {text: string; parts?: RichPart[]}, names: string[] = []): string {
  if (!catalog) return choice.text;
  const match = findTranslation(catalog, id, choice, names);
  return match ? renderParts(translateParts(match.parts, match.entry)).text : choice.text;
}
