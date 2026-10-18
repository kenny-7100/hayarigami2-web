/** Long-label stress mode is only wired to the development QA entry. */
export function expandedMessage(message: string): string {
  return `⟦ ${message} ${'·'.repeat(Math.ceil(message.length * 0.6))} ⟧`;
}
export function shortenChartLabel(text: string): string {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(item => item.segment);
  let width = 0;
  const output: string[] = [];
  for (const char of graphemes) {
    width += /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Tamil}\p{Script=Telugu}]/u.test(char) ? 1 : .62;
    if (width > 7.3) return `${output.join('')}…`;
    output.push(char);
  }
  return text;
}

export function formatMessage(locale: string, message: string, values: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (token, key: string) => {
    if (!Object.hasOwn(values, key)) return token;
    const value = typeof values[key] === 'number' ? new Intl.NumberFormat(locale).format(values[key]) : values[key];
    // Isolate interpolated names/numbers from surrounding RTL punctuation.
    return `\u2068${value}\u2069`;
  });
}
