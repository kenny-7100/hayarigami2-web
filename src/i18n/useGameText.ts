import { useCallback } from 'react';
import { useGameCatalog } from './gameContext';
import { localizedString } from './gameCatalog';
export function useGameText() {
  const catalog = useGameCatalog();
  return useCallback((key: string, source: string) => localizedString(catalog, key, source), [catalog]);
}
