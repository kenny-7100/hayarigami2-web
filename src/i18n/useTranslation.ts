import { useCallback } from 'react';
import { useLocale } from './useLocale';
import { translate } from './messages';
export function useTranslation() {
  const locale = useLocale();
  const t = useCallback((source: string, values: Record<string, string | number> = {}) => translate(locale, source, values), [locale]);
  return { locale, t };
}
