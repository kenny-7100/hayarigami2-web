/** Unicode presentation metadata; never decodes native font bytes. */
export type TextStyle = { color: number; size: number };
export type TextSpan = TextStyle & { start: number; end: number; keyword?: number; fresh?: boolean };
export type Acquisition = { kind: 'keyword' | 'term'; id: number };
export const plainStyle: TextStyle = { color: 0, size: 0 };
export const cleanText = (text: string) => text.trim().replace(/—{3}/g, '——').replace(/\n{3,}/g, '\n\n');

// Annotate before normalization so contraction and trimming cannot shift a highlight.
export function presentText(source: string, spans: TextSpan[], replacement?: string) {
  const text = cleanText(replacement ?? source);
  if (replacement !== undefined && replacement !== source) {
    // Editorial tutorial replacements are whole-page Unicode text. Only retain
    // unambiguous literal spans; never color a guessed substring in a translation.
    const mapped: TextSpan[] = [];
    let cursor = 0;
    for (const span of spans) {
      const value = cleanText(source.slice(span.start, span.end));
      const start = value ? text.indexOf(value, cursor) : -1;
      if (start >= 0 && text.indexOf(value, start + 1) < 0) {
        mapped.push({ ...span, start, end: start + value.length });
        cursor = start + value.length;
      }
    }
    return { text, spans: mapped };
  }
  let chars = source.split('').map((char, index) => ({ char, span: spans.findIndex(s => index >= s.start && index < s.end) }));
  const start = source.length - source.trimStart().length;
  chars = chars.slice(start, source.trimEnd().length);
  const compact: typeof chars = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i].char === '—' && chars[i + 1]?.char === '—' && chars[i + 2]?.char === '—') {
      compact.push(chars[i], chars[i + 1]); i += 2;
    } else if (chars[i].char === '\n' && chars[i + 1]?.char === '\n' && chars[i + 2]?.char === '\n') {
      compact.push(chars[i], chars[i + 1]);
      while (chars[i + 1]?.char === '\n') i++;
    } else compact.push(chars[i]);
  }
  const mapped: TextSpan[] = [];
  for (let i = 0; i < compact.length;) {
    const start = i, index = compact[i].span;
    while (i < compact.length && compact[i].span === index) i++;
    if (index >= 0) mapped.push({ ...spans[index], start, end: i });
  }
  return { text, spans: mapped };
}
export function validStyle(s: TextStyle): boolean {
  return !!s && Number.isInteger(s.color) && s.color >= 0 && s.color <= 15 && Number.isInteger(s.size) && s.size >= -10 && s.size <= 10;
}
export function validSpans(spans: TextSpan[] | undefined, text: string, keywords: Record<string, string> = {}): boolean {
  return spans === undefined || (Array.isArray(spans) && spans.length <= 10000 && spans.every((s, i) => validStyle(s) && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= (i ? spans[i - 1].end : 0) && s.end > s.start && s.end <= text.length && (s.keyword === undefined || !!keywords[s.keyword]) && (s.fresh === undefined || typeof s.fresh === 'boolean')));
}
