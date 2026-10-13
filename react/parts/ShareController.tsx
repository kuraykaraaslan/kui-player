import { useEffect, useState } from 'react';
import { buildShareUrl, readUrlTime } from '../../modules/videoplayer/videoplayer.share.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from '../hooks/useVideoPlayerStore.js';
import { useTranslate } from '../i18n/index.js';

export type ShareOptions = {
  /** Query/hash parameter name (default `t`). */
  param?: string;
  /** Called with the link instead of copying it — for your own share UI. */
  onShare?: (url: string, seconds: number) => void;
};

type Props = { options: ShareOptions; src: string };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* no async clipboard, or permission refused: fall through */ }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try { return document.execCommand('copy'); } finally { area.remove(); }
}

/**
 * Honours `?t=` on load and offers "share from here". Opt-in. The URL time is
 * applied once per source and, because the persistence offer is a prompt rather
 * than a seek, it already yields to an explicit link (see VideoPlayer).
 */
export default function ShareController({ options, src }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const duration = useVideoPlayerStore((s) => s.duration);
  const [message, setMessage] = useState('');
  const param = options.param ?? 't';
  const [applied, setApplied] = useState<string | null>(null);

  // `seek` clamps to the duration, which is 0 until metadata arrives — so wait.
  if (duration > 0 && applied !== src) {
    setApplied(src);
    const start = readUrlTime(window.location.href, param);
    if (start !== null && start < duration) engine.seek(start);
  }

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(id);
  }, [message]);

  const share = async () => {
    const seconds = engine.store.getState().currentTime;
    const url = buildShareUrl(window.location.href, seconds, param);
    if (options.onShare) { options.onShare(url, seconds); return; }
    setMessage(t((await copyText(url)) ? 'linkCopied' : 'linkCopyFailed'));
  };

  return (
    <>
      <button type="button" className="kui-share" onClick={() => { void share(); }}>
        {t('shareFromHere')}
      </button>
      <span className="kui-sr-only" role="status" aria-live="polite">{message}</span>
    </>
  );
}
