import { useId } from 'react';
import { useTranslation } from '../i18n/useTranslation';

export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const { t } = useTranslation();
  return <div className="collection-search">
    <label htmlFor={id}>{t('搜索')}</label>
    <div>
      <input id={id} type="search" value={value} onChange={event => onChange(event.target.value)} autoComplete="off" dir="auto" />
      {value && <button type="button" onClick={() => { onChange(''); document.getElementById(id)?.focus(); }}>{t('清除搜索')}</button>}
    </div>
  </div>;
}
