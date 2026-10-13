import { useEffect, useRef, useState } from 'react';
import { planSignSync } from '../../modules/videoplayer/videoplayer.signsync.js';
import { Icon } from '../icons/index.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useTranslate } from '../i18n/index.js';

export type SignLanguageOptions = {
  /** The interpreter's video. Its timeline must match the main video's. */
  src: string;
  /** Where to dock it (default `bottom-left`). */
  corner?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Drift, in seconds, tolerated before it is re-aligned (default 0.3). */
  maxDrift?: number;
};

/**
 * A small second video that follows the main one: same position, same rate,
 * paused whenever the main video is paused or buffering. It is muted — the
 * interpreter's audio is not the point, and two audio tracks would fight.
 */
export default function SignLanguageVideo({ options }: Readonly<{ options: SignLanguageOptions }>) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hidden) return;
    const sync = () => {
      const s = engine.store.getState();
      const plan = planSignSync({
        mainTime: s.currentTime,
        mainPlaying: s.playing,
        mainRate: s.speed,
        mainWaiting: s.loading || s.seeking,
        signTime: video.currentTime,
        signPaused: video.paused,
        signRate: video.playbackRate,
        threshold: options.maxDrift,
      });
      if (plan.seekTo !== undefined) video.currentTime = plan.seekTo;
      if (plan.rate !== undefined) video.playbackRate = plan.rate;
      if (plan.play) void video.play().catch(() => { /* autoplay refused: stays paused, resyncs on the next change */ });
      if (plan.pause) video.pause();
    };
    sync();
    return engine.store.subscribe(sync);
  }, [engine, hidden, options.maxDrift]);

  if (hidden) return null;
  return (
    <div className="kui-sign" data-kui-corner={options.corner ?? 'bottom-left'}>
      <video
        ref={videoRef}
        src={options.src}
        muted
        playsInline
        preload="auto"
        aria-label={t('signLanguageVideo')}
        className="kui-sign-video"
      />
      <button type="button" className="kui-mini-btn kui-sign-close" onClick={() => setHidden(true)} aria-label={t('close')}>
        <Icon name="close" />
      </button>
    </div>
  );
}
