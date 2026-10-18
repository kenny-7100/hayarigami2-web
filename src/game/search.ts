/** Match display text, including full-width Japanese input, without mutating source data. */
export function matchesSearch(text: string, query: string): boolean {
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();
  const haystack = normalize(text);
  return normalize(query).split(/\s+/u).every(word => haystack.includes(word));
}
