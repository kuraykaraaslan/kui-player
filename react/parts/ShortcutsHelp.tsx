import { useRef } from 'react';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useTranslate } from '../i18n/index.js';
import {
  describeKey, DEFAULT_SHORTCUTS, type Keymap, type ShortcutAction,
} from '../../modules/videoplayer/videoplayer.shortcuts.js';

const ACTIONS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[];

/** `?`-opened key list. Reads the live keymap, so remapped keys show as remapped. */
export default function ShortcutsHelp({ keymap, onClose }: Readonly<{ keymap: Keymap; onClose: () => void }>) {
  const t = useTranslate();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true, onClose);

  // Group the active keys back under their action, in the default display order.
  const byAction = new Map<ShortcutAction, string[]>();
  for (const [key, action] of keymap) byAction.set(action, [...(byAction.get(action) ?? []), key]);

  return (
    <div className="kui-modal" role="dialog" aria-modal="true" aria-labelledby="kui-shortcuts-title" onClick={(e) => e.stopPropagation()}>
      <div className="kui-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="kui-modal-card" ref={cardRef} tabIndex={-1}>
        <div className="kui-modal-head">
          <h2 id="kui-shortcuts-title">{t('shortcuts')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="kui-modal-close">
            <Icon name="close" />
          </button>
        </div>
        <dl className="kui-modal-body kui-shortcuts">
          {ACTIONS.filter((a) => byAction.has(a)).map((a) => {
            const keys = byAction.get(a) ?? [];
            // Ten digit keys collapse to one "0–9" chip.
            const shown = a === 'percent' ? ['0–9'] : keys.map(describeKey);
            return (
              <div key={a} className="kui-shortcut-row">
                <dt>{shown.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
                <dd>{t(`shortcut.${a}`)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
