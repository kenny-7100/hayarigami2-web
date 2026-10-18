/** Locale negotiation is independent of React, storage and the game VM. */
export const localeDefinitions = {
  'zh-Hans': { label: '简体中文', direction: 'ltr' },
  'zh-Hant': { label: '繁體中文', direction: 'ltr' },
  ja: { label: '日本語', direction: 'ltr' },
  en: { label: 'English', direction: 'ltr' },
  ar: { label: 'العربية', direction: 'rtl' },
  hi: { label: 'हिन्दी', direction: 'ltr' },
  es: { label: 'Español', direction: 'ltr' },
  fr: { label: 'Français', direction: 'ltr' },
  bn: { label: 'বাংলা', direction: 'ltr' },
  pt: { label: 'Português', direction: 'ltr' },
  ru: { label: 'Русский', direction: 'ltr' },
  id: { label: 'Bahasa Indonesia', direction: 'ltr' },
  ur: { label: 'اردو', direction: 'rtl' },
  de: { label: 'Deutsch', direction: 'ltr' },
  mr: { label: 'मराठी', direction: 'ltr' },
  vi: { label: 'Tiếng Việt', direction: 'ltr' },
  te: { label: 'తెలుగు', direction: 'ltr' },
  tr: { label: 'Türkçe', direction: 'ltr' },
  ta: { label: 'தமிழ்', direction: 'ltr' },
} as const;
export type Locale = keyof typeof localeDefinitions;
export const preferenceKey = 'hs2.locale';
export function matchLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const tag = value.trim().replaceAll('_', '-').toLowerCase();
  if (/^zh(?:-|$)/.test(tag)) {
    return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans';
  }
  const language = tag.split('-')[0];
  if (Object.hasOwn(localeDefinitions, language)) return language as Locale;
  return null;
}
export function localeFromPath(pathname: string): Locale | null {
  return matchLocale(pathname.split('/')[1]);
}
/** An explicit shared URL takes precedence over a saved preference. */
export function resolveLocale(pathname: string, saved: string | null, languages: readonly string[], available: readonly Locale[]): Locale {
  for (const candidate of [localeFromPath(pathname), matchLocale(saved), ...languages.map(matchLocale)]) {
    if (candidate && available.includes(candidate)) return candidate;
  }
  return available.includes('en') ? 'en' : available[0] ?? 'zh-Hans';
}
/** Preserve query, fragment and the rest of the route when changing language. */
export function localizedUrl(input: string, locale: Locale): string {
  const url = new URL(input, 'https://local.invalid');
  const segments = url.pathname.split('/');
  if (localeFromPath(url.pathname)) segments.splice(1, 1);
  url.pathname = `/${locale}${segments.join('/') || '/'}`;
  return `${url.pathname}${url.search}${url.hash}`;
}
