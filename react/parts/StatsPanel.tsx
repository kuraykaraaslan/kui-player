import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useTranslate } from '../i18n/index.js';
import { diagnosticRows, diagnosticsText } from '../../modules/videoplayer/videoplayer.diagnostics.js';

const REFRESH_MS = 1000;

/**
 * Read-only "stats for nerds". No live region: a table that changes every
 * second would make a screen reader talk over the video, so the values are
 * simply there to be read when asked for.
 */
export default function StatsPanel({ onClose }: Readonly<{ onClose: () => void }>) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true, onClose);
  const [snapshot, setSnapshot] = useState(() => engine.getDiagnostics());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setSnapshot(engine.getDiagnostics()), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [engine]);

  const label = (key: string) => t(`stats.${key}` as 'stats.adapter');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText(snapshot, label));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable: the values are on screen to copy by hand */ }
  };

  return (
    <div className="kui-modal" role="dialog" aria-modal="true" aria-label={t('stats')} onClick={(e) => e.stopPropagation()}>
      <div className="kui-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="kui-modal-card" ref={cardRef} tabIndex={-1}>
        <div className="kui-modal-head">
          <h2>{t('stats')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="kui-modal-close">
            <Icon name="close" />
          </button>
        </div>
        <dl className="kui-modal-body kui-stats">
          {diagnosticRows(snapshot).map((row) => (
            <div key={row.key} className="kui-shortcut-row">
              <dt>{label(row.key)}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="kui-modal-foot">
          <button type="button" className="kui-btn-outline" onClick={() => { void copy(); }}>
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
      </div>
    </div>
  );
}
