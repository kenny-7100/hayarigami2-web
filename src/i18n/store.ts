import { localeDefinitions, localizedUrl, matchLocale, preferenceKey, resolveLocale } from './locale.ts';
import type { Locale } from './locale.ts';
const available = Object.keys(localeDefinitions) as Locale[];
const listeners = new Set<() => void>();
let current: Locale = 'zh-Hans';
let initialized = false;
function savedLocale() {
  try { return localStorage.getItem(preferenceKey); } catch { return null; }
}
function readLocation(): Locale {
  // Development fixtures keep their own route; language is carried as a query.
  const path = location.pathname.startsWith('/tests/')
    ? `/${new URLSearchParams(location.search).get('lang') ?? ''}/` : location.pathname;
  return resolveLocale(path, savedLocale(), navigator.languages ?? [navigator.language], available);
}
function apply(locale: Locale, remember: boolean) {
  current = locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDefinitions[locale].direction;
  if (remember) {
    try { localStorage.setItem(preferenceKey, locale); } catch { /* URL remains authoritative. */ }
  }
  listeners.forEach(listener => listener());
}
function urlFor(locale: Locale) {
  if (location.pathname.startsWith('/tests/')) {
    const url = new URL(location.href);
    url.searchParams.set('lang', locale);
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return localizedUrl(location.href, locale);
}
export function initializeLocale() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const locale = readLocation();
  history.replaceState(history.state, '', urlFor(locale));
  apply(locale, false);
  window.addEventListener('popstate', () => apply(readLocation(), true));
}
export function getLocale(): Locale { return current; }
export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function changeLocale(locale: Locale) {
  if (!Object.hasOwn(localeDefinitions, locale)) throw new Error('Unsupported locale');
  if (locale !== current) history.pushState(history.state, '', urlFor(locale));
  apply(locale, true);
}
export function normalizeLocale(value: string) { return matchLocale(value); }
