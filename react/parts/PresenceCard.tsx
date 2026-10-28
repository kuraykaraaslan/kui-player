import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../hooks/useStore.js';
import { useDictionary, useTranslate } from '../i18n/index.js';
import type { PresenceGroup } from '../../modules/videoplayer/videoplayer.presence.js';

type Props = {
  group: PresenceGroup;
  /**
   * `page`: one prompt over the whole page, for a group of players.
   * `player`: inside a single player that has its own presence check.
   */
  mode: 'page' | 'player';
};

/** The "Still watching?" question, with the countdown and the answer. */
export default function PresenceCard({ group, mode }: Props) {
  const t = useTranslate();
  const dictionary = useDictionary();
  const remaining = useStore(group.store, (s) => s.remainingMs);
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  // Focus the answer, and give focus back to wherever it was when the question goes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    button.current?.focus();
    return () => { if (before?.isConnected) before.focus?.(); };
  }, []);

  const card = (
    <div
      className={mode === 'page' ? 'kui-presence kui-presence--page' : 'kui-presence kui-presence--player'}
      role="alertdialog"
      aria-modal={mode === 'page' ? true : undefined}
      aria-labelledby={titleId}
      aria-describedby={textId}
      dir={dictionary.dir ?? 'ltr'}
      onKeyDown={(e) => {
        // Escape is the usual way to wave a question away: here that means "yes, still here".
        if (e.key === 'Escape') { e.stopPropagation(); group.confirm(); }
      }}
    >
      <div className="kui-presence-card">
        <p id={titleId} className="kui-presence-title">{t('presenceTitle')}</p>
        <p id={textId} className="kui-presence-text">{t('presenceCountdown', { seconds })}</p>
        <button ref={button} type="button" className="kui-presence-btn" onClick={() => group.confirm()}>
          {t('presenceContinue')}
        </button>
      </div>
    </div>
  );

  return mode === 'page' ? createPortal(card, document.body) : card;
}
