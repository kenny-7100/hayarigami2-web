import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { validateGameCatalog } from './gameCatalog';
import type { GameCatalog } from './gameCatalog';
import { GameTranslationContext } from './gameContext';
import { useTranslation } from './useTranslation';
import { LanguagePicker } from './LanguagePicker';
const loaders = import.meta.glob<GameCatalog>('../../localization/story/*.json', { import: 'default' });
export function GameLocaleProvider({ sourceSha256, children }: { sourceSha256: string; children: ReactNode }) {
  const { locale, t } = useTranslation();
  const [catalog, setCatalog] = useState<GameCatalog | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ready = catalog?.locale === locale && catalog.sourceSha256 === sourceSha256;
  useEffect(() => {
    let active = true;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const loader = loaders[`../../localization/story/${locale}.json`];
    (loader ? loader() : Promise.reject(new Error('Localization package is missing'))).then(value => {
      validateGameCatalog(value, locale, sourceSha256);
      if (active) {
        setCatalog(value);
        requestAnimationFrame(() => { if (active && focused?.isConnected && document.activeElement === document.body) focused.focus(); });
      }
    }).catch(error => {
      if (active) { console.error('Localization loading failed', error); setFailure(locale); }
    });
    return () => { active = false; };
  }, [locale, sourceSha256, attempt]);
  return <GameTranslationContext.Provider value={ready ? catalog : null}>
    {!ready && <main className="loading">
      <LanguagePicker />
      <p role={failure === locale ? 'alert' : 'status'}>{t(failure === locale ? '游戏资源暂时无法加载，请检查网络后重试。' : '正在加载游戏…')}</p>
      {failure === locale && <button className="secondary" onClick={() => { setFailure(null); setAttempt(value => value + 1); }}>{t('重新加载')}</button>}
    </main>}
    {/* Keep the reader mounted while changing languages: no lost game position or draft answer. */}
    <div style={{ display: ready ? 'contents' : 'none' }} aria-hidden={!ready}>{children}</div>
  </GameTranslationContext.Provider>;
}
