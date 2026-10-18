import { createContext, useContext } from 'react';
import type { GameCatalog } from './gameCatalog';
export const GameTranslationContext = createContext<GameCatalog | null>(null);
export const useGameCatalog = () => useContext(GameTranslationContext);
