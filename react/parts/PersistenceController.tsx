import { useEffect, useState } from 'react';
import { PlayerStorage, type PersistOptions } from '../../modules/videoplayer/videoplayer.persist.js';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useTranslate } from '../i18n/index.js';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';

type Props = {
  options: PersistOptions;
  src: string;
  subtitles?: SubtitleTrack[];
};

const WRITE_INTERVAL_MS = 5000;

/**
 * Remembers preferences across sources and position per source, and offers to
 * pick up where the viewer left off. Lazy and opt-in — with `persist` unset the
 * player touches no storage at all.
 */
export default function PersistenceController({ options, src, subtitles }: Props) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  // Built once: the options object is usually a fresh literal every render.
  const [storage] = useState(() => new PlayerStorage(options));
  const [resumeTo, setResumeTo] = useState<number | null>(() => storage.readPosition(src)?.time ?? null);
  const [lastSrc, setLastSrc] = useState(src);

  // A new source means a new offer — derived during render rather than in an
  // effect, so it never renders one frame with the previous source's position.
  if (lastSrc !== src) {
    setLastSrc(src);
    setResumeTo(storage.readPosition(src)?.time ?? null);
  }

  // Preferences are source-independent, so they are applied once on mount.
  useEffect(() => {
    const prefs = storage.readPreferences();
    if (!prefs) return;
    const s = engine.store.getState();
    if (typeof prefs.volume === 'number') engine.setVolume(prefs.volume);
    if (prefs.muted !== undefined && prefs.muted !== s.muted) engine.toggleMute();
    if (typeof prefs.speed === 'number') engine.setSpeed(prefs.speed);
    if (prefs.subtitleFontSize) s.setSubtitleFontSize(prefs.subtitleFontSize);
    if (prefs.subtitleLanguage && subtitles) {
      const index = subtitles.findIndex((track) => track.srclang === prefs.subtitleLanguage);
      if (index >= 0) s.setSelectedSubtitle(index);
    }
  }, [engine, storage, subtitles]);

  useEffect(() => {
    let lastWrite = 0;
    return engine.store.subscribe((state, previous) => {
      if (state.volume !== previous.volume || state.muted !== previous.muted
        || state.speed !== previous.speed || state.subtitleFontSize !== previous.subtitleFontSize
        || state.selectedSubtitle !== previous.selectedSubtitle) {
        storage.writePreferences({
          volume: state.volume,
          muted: state.muted,
          speed: state.speed,
          subtitleFontSize: state.subtitleFontSize,
          subtitleLanguage: state.selectedSubtitle === null
            ? null
            : subtitles?.[state.selectedSubtitle]?.srclang ?? null,
        });
      }

      if (state.currentTime === previous.currentTime) return;
      const now = Date.now();
      if (now - lastWrite < WRITE_INTERVAL_MS) return;
      lastWrite = now;
      storage.writePosition(src, state.currentTime, state.duration);
    });
  }, [engine, storage, src, subtitles]);

  // The offer is exactly that — an offer. A player that silently jumps twelve
  // minutes in is a player people stop trusting.
  if (resumeTo === null) return null;

  return (
    <div className="kui-resume" role="status">
      <span>{t('resumeFrom', { time: formatTime(resumeTo) })}</span>
      <button
        type="button"
        className="kui-btn-outline"
        onClick={() => { engine.seek(resumeTo); setResumeTo(null); }}
      >
        {t('resume')}
      </button>
      <button
        type="button"
        className="kui-resume-dismiss"
        onClick={() => { storage.clearPosition(src); setResumeTo(null); }}
        aria-label={t('dismiss')}
      >
        ×
      </button>
    </div>
  );
}
