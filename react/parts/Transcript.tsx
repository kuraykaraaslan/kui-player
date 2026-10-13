import { useEffect, useRef, useState } from 'react';
import { useFormatTime, useTranslate } from '../i18n/index.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from '../hooks/useVideoPlayerStore.js';
import type { VttCue } from '../../modules/videoplayer/videoplayer.vtt.js';

type Props = { src: string; offset: number };

/** The whole subtitle track as readable text: the current line is marked, any line seeks. */
export default function Transcript({ src, offset }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const formatTime = useFormatTime();
  const time = useVideoPlayerStore((s) => s.currentTime);
  const [loaded, setLoaded] = useState<{ src: string; cues: VttCue[] } | null>(null);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      fetch(src, { signal: controller.signal }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
      import('../../modules/videoplayer/videoplayer.subtitles.parse.js'),
    ])
      .then(([text, { parseSubtitles }]) => { if (!cancelled) setLoaded({ src, cues: parseSubtitles(text, src) }); })
      .catch(() => { if (!cancelled) setLoaded({ src, cues: [] }); });
    return () => { cancelled = true; controller.abort(); };
  }, [src]);

  const cues = loaded?.src === src ? loaded.cues : null;
  const shifted = time - offset;
  const active = cues ? cues.findIndex((c) => shifted >= c.start && shifted < c.end) : -1;

  // Keep the spoken line in view, without yanking the page around.
  useEffect(() => { activeRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [active]);

  return (
    <section className="kui-transcript" aria-label={t('transcript')}>
      {cues === null && <p className="kui-modal-sub" role="status">…</p>}
      {cues !== null && cues.length === 0 && <p className="kui-modal-sub">{t('noTranscript')}</p>}
      {cues !== null && cues.length > 0 && (
        <ol className="kui-transcript-list">
          {cues.map((cue, i) => (
            <li key={`${cue.start}-${i}`} ref={i === active ? activeRef : undefined} aria-current={i === active ? 'true' : undefined}>
              <button type="button" className="kui-search-hit" onClick={() => engine.seek(cue.start + offset)}>
                <span className="kui-search-time">{formatTime(cue.start + offset)}</span>
                <span>{cue.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
