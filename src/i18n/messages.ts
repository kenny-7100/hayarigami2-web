import { expandedMessage, formatMessage } from "./format";
import type { Locale } from './locale';
const catalogs = import.meta.glob<Record<string, string>>(['../../localization/ui/*.json', '!../../localization/ui/source.json'], { eager: true, import: 'default' });
export function translate(locale: Locale, source: string, values: Record<string, string | number> = {}): string {
  const catalog = catalogs[`../../localization/ui/${locale}.json`];
  const raw = catalog?.[source] ?? source;
  const stress = import.meta.env.DEV && location.pathname.startsWith("/tests/") && new URLSearchParams(location.search).get("stress") === "1";
  const message = stress ? expandedMessage(raw) : raw;
  return formatMessage(locale, message, values);
}
