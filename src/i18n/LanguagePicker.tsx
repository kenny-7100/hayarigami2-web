import { localeDefinitions } from './locale';
import type { Locale } from './locale';
import { changeLocale } from './store';
import { useTranslation } from './useTranslation';
/** Autonyms remain identifiable even if the user cannot read the current UI. */
export function LanguagePicker() {
  const { locale, t } = useTranslation();
  return <label className="language-picker">
    <span aria-hidden="true">文 / A</span>
    <select aria-label={t("语言")} value={locale} onChange={event => changeLocale(event.target.value as Locale)}>
      {Object.entries(localeDefinitions).map(([code, entry]) => <option key={code} value={code} lang={code} dir={entry.direction}>{entry.label}</option>)}
    </select>
  </label>;
}
