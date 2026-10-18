/** Source provenance for localization. The original VM text remains authoritative. */
export type RichPart = {
  text: string;
  color?: number;
  size?: number;
  keyword?: number;
  fresh?: boolean;
  name?: number;
};
export type TranslatedPart = { text: string; ref?: number } | { ref: number; text?: never };
export type RichTranslation = { source: string; parts: TranslatedPart[]; status: 'draft' | 'reviewed' };
export function sourceSignature(parts: RichPart[]): string {
  return JSON.stringify(parts.map(part => ({ text: part.name !== undefined ? `{name:${part.name}}` : part.text, color: part.keyword !== undefined ? undefined : part.color, size: part.size, keyword: part.keyword, name: part.name })));
}
/** A compact lookup key; the full signature is also checked, so collisions cannot substitute text. */
export function richKey(id: string, parts: RichPart[]): string {
  let hash = 2166136261;
  for (const char of sourceSignature(parts)) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 16777619);
  }
  return `${id}.${(hash >>> 0).toString(16)}`;
}
export function validTranslationText(value: unknown): value is string {
  // eslint-disable-next-line no-control-regex -- Deliberately reject embedded control characters in authored text.
  return typeof value === 'string' && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uFFFD\u202a-\u202e\u2066-\u2069]/u.test(value);
}
export function validateRichTranslation(parts: RichPart[], translation: RichTranslation): void {
  if (translation.source !== sourceSignature(parts)) throw new Error('Translation source has changed');
  if (!Array.isArray(translation.parts) || !translation.parts.length) throw new Error('Empty translation');
  const required = parts.flatMap((part, index) => part.name !== undefined || part.keyword !== undefined || part.color || part.size ? [index] : []);
  const used: number[] = [];
  for (const part of translation.parts) {
    if (part.ref === undefined) {
      if (!validTranslationText(part.text)) throw new Error('Translation text is missing or contains invalid controls');
    } else {
      if (!Number.isInteger(part.ref) || !parts[part.ref]) throw new Error('Unknown translation reference');
      used.push(part.ref);
      if (parts[part.ref].name !== undefined && part.text !== undefined) throw new Error('Player names cannot be overwritten');
      if (part.text !== undefined && !validTranslationText(part.text)) throw new Error('Invalid translated reference');
      if (required.includes(part.ref) && parts[part.ref].text.trim() && part.text !== undefined && !part.text.trim()) throw new Error('Required reference cannot be erased');
    }
  }
  if (required.some(index => used.filter(ref => ref === index).length !== 1)) throw new Error('Missing or repeated name, keyword or emphasis');
  if (!translation.parts.some(part => part.ref !== undefined || (part.text ?? "").trim())) throw new Error('Blank translation');
}
export function translateParts(parts: RichPart[], translation: RichTranslation): RichPart[] {
  validateRichTranslation(parts, translation);
  return translation.parts.map(part => part.ref === undefined
    ? { text: part.text ?? "" }
    : { ...parts[part.ref], text: part.text ?? parts[part.ref].text });
}
export function validRichParts(value: RichPart[] | undefined, keywords: Record<string, string>): boolean {
  return value === undefined || (Array.isArray(value) && value.length <= 10000 && value.every(part =>
    part && typeof part.text === 'string' && part.text.length <= 10000 &&
    (part.name === undefined || part.name === 0 || part.name === 1) &&
    (part.color === undefined || (Number.isInteger(part.color) && part.color >= 0 && part.color <= 15)) &&
    (part.size === undefined || (Number.isInteger(part.size) && part.size >= -10 && part.size <= 10)) &&
    (part.keyword === undefined || Object.hasOwn(keywords, part.keyword)) &&
    (part.fresh === undefined || typeof part.fresh === 'boolean')));
}
