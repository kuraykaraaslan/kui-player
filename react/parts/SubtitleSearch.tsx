import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons/index.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useFormatTime, useTranslate } from '../i18n/index.js';
import type { VttCue } from '../../modules/videoplayer/videoplayer.vtt.js';

type Props = {
  src: string;
  /** Subtitle delay in seconds: a cue at `start` is shown at `start + offset`. */
  offset: number;
  onSeek: (time: number) => void;
  onClose: () => void;
};

const MAX_RESULTS = 100;

/** Search the text of the chosen subtitle track and jump to the line. */
export default function SubtitleSearch({ src, offset, onSeek, onClose }: Props) {
  const t = useTranslate();
  const formatTime = useFormatTime();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true, onClose);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState<{ src: string; cues: VttCue[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      fetch(src, { signal: controller.signal })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
      import('../../modules/videoplayer/videoplayer.subtitles.parse.js'),
    ])
      .then(([text, { parseSubtitles }]) => { if (!cancelled) setLoaded({ src, cues: parseSubtitles(text, src) }); })
      .catch(() => { if (!cancelled) setLoaded({ src, cues: [] }); });
    return () => { cancelled = true; controller.abort(); };
  }, [src]);

  const cues = loaded?.src === src ? loaded.cues : null;
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!cues || !needle) return [];
    return cues.filter((c) => c.text.toLowerCase().includes(needle)).slice(0, MAX_RESULTS);
  }, [cues, needle]);

  return (
    <div className="kui-modal" role="dialog" aria-modal="true" aria-labelledby="kui-search-title" onClick={(e) => e.stopPropagation()}>
      <div className="kui-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="kui-modal-card" ref={cardRef} tabIndex={-1}>
        <div className="kui-modal-head">
          <h2 id="kui-search-title">{t('searchSubtitles')}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="kui-modal-close"><Icon name="close" /></button>
        </div>
        <div className="kui-modal-body">
          <input
            className="kui-frametools-input kui-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchSubtitles')}
            autoFocus
          />
          {cues === null && <p className="kui-modal-sub" role="status">…</p>}
          {cues !== null && needle !== '' && matches.length === 0 && <p className="kui-modal-sub" role="status">{t('noMatches')}</p>}
          {matches.length > 0 && (
            <ul className="kui-search-results" aria-label={t('searchSubtitles')}>
              {matches.map((cue) => (
                <li key={`${cue.start}-${cue.text}`}>
                  <button type="button" className="kui-search-hit" onClick={() => { onSeek(cue.start + offset); onClose(); }}>
                    <span className="kui-search-time">{formatTime(cue.start + offset)}</span>
                    <span>{cue.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
