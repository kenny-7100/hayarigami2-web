import { useSyncExternalStore } from 'react';
import { getLocale, initializeLocale, subscribeLocale } from './store';
initializeLocale();
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => 'zh-Hans' as const);
}
