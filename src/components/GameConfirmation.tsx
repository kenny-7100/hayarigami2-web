import { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../i18n/useTranslation';

/** A game-styled modal; showModal confines focus even above the save/chapter panel. */
export function GameConfirmation({ title, message, confirmLabel, onResolve }: {
  title: string;
  message: string;
  confirmLabel: string;
  onResolve: (confirmed: boolean) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    cancel.current?.focus();
    return () => element.close();
  }, []);
  function resolve(confirmed: boolean) {
    // Close first so focus returns to the invoking control before the action runs.
    dialog.current?.close();
    onResolve(confirmed);
  }
  return <dialog ref={dialog} className="game-confirmation" role="alertdialog"
    aria-labelledby={titleId} aria-describedby={messageId}
    onKeyDown={event => {
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.shiftKey && document.activeElement === cancel.current) {
        event.preventDefault(); confirm.current?.focus();
      } else if (!event.shiftKey && document.activeElement === confirm.current) {
        event.preventDefault(); cancel.current?.focus();
      }
    }}
    onCancel={event => { event.preventDefault(); resolve(false); }}>
    <div className="confirmation-copy">
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
    </div>
    <div className="confirmation-actions">
      <button ref={cancel} className="secondary" onClick={() => resolve(false)}>{t('取消')}</button>
      <button ref={confirm} className="primary" onClick={() => resolve(true)}>{confirmLabel}</button>
    </div>
  </dialog>;
}
