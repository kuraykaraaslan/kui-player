import { useEffect, useState } from 'react';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useTranslate } from '../i18n/index.js';
import type { PlaylistItem } from '../../modules/videoplayer/videoplayer.types.js';

type Props = {
  playlist: PlaylistItem[];
  index: number;
  onSelect: (index: number) => void;
  /** Seconds to wait before advancing. `0` advances immediately. */
  countdown?: number;
};

/**
 * Advances through a playlist when an item finishes, after a countdown the
 * viewer can cancel — autoplaying the next thing without a way out is how
 * players lose people's trust.
 */
export default function PlaylistController({ playlist, index, onSelect, countdown = 8 }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lastIndex, setLastIndex] = useState(index);

  // A new item cancels any pending countdown, adjusted during render.
  if (lastIndex !== index) {
    setLastIndex(index);
    if (remaining !== null) setRemaining(null);
  }

  const next = playlist[index + 1];

  useEffect(() => {
    return engine.on('complete', () => {
      if (!next) return;
      if (countdown <= 0) { onSelect(index + 1); return; }
      setRemaining(countdown);
    });
  }, [engine, next, index, onSelect, countdown]);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      const advance = setTimeout(() => { setRemaining(null); onSelect(index + 1); }, 0);
      return () => clearTimeout(advance);
    }
    const timer = setTimeout(() => setRemaining((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining, index, onSelect]);

  if (remaining === null || !next) return null;

  return (
    <div className="kui-up-next" role="status">
      {next.poster && <span className="kui-up-next-art" style={{ backgroundImage: `url(${next.poster})` }} />}
      <span className="kui-up-next-text">
        {t('playingNext', { seconds: remaining, title: next.title ?? '' })}
      </span>
      <button type="button" className="kui-btn-outline" onClick={() => { setRemaining(null); onSelect(index + 1); }}>
        {t('next')}
      </button>
      <button type="button" className="kui-resume-dismiss" onClick={() => setRemaining(null)} aria-label={t('cancel')}>
        ×
      </button>
    </div>
  );
}
