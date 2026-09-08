import { useEffect } from 'react';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';

type Props = {
  title?: string;
  poster?: string;
  artist?: string;
  album?: string;
  onNext?: () => void;
  onPrevious?: () => void;
};

type MediaSessionLike = {
  metadata: MediaMetadata | null;
  playbackState?: 'none' | 'paused' | 'playing';
  setActionHandler(action: string, handler: ((details: { seekTime?: number; seekOffset?: number }) => void) | null): void;
  setPositionState?(state: { duration: number; playbackRate: number; position: number }): void;
};

/**
 * Hands the OS what it needs to draw media controls on the lock screen, in the
 * notification shade and on the keyboard's media keys. Lazy, because a page
 * that never plays does not need it, and it is inert where unsupported.
 */
export default function MediaSessionController({ title, poster, artist, album, onNext, onPrevious }: Props) {
  const engine = useVideoPlayerEngine();

  useEffect(() => {
    const session = (navigator as Navigator & { mediaSession?: MediaSessionLike }).mediaSession;
    const Metadata = (window as unknown as {
      MediaMetadata?: new (init: Record<string, unknown>) => MediaMetadata;
    }).MediaMetadata;
    if (!session) return;

    if (Metadata) {
      session.metadata = new Metadata({
        title: title ?? document.title,
        artist,
        album,
        artwork: poster ? [{ src: poster, sizes: '512x512' }] : [],
      });
    }

    const handlers: [string, ((d: { seekTime?: number; seekOffset?: number }) => void) | null][] = [
      ['play', () => engine.play()],
      ['pause', () => engine.pause()],
      ['seekbackward', (d) => engine.seekBy(-(d.seekOffset ?? 10))],
      ['seekforward', (d) => engine.seekBy(d.seekOffset ?? 10)],
      ['seekto', (d) => { if (typeof d.seekTime === 'number') engine.seek(d.seekTime); }],
      ['stop', () => engine.pause()],
      ['previoustrack', onPrevious ?? null],
      ['nexttrack', onNext ?? null],
    ];

    for (const [action, handler] of handlers) {
      // Unsupported actions throw rather than no-op, per the spec.
      try { session.setActionHandler(action, handler); } catch { /* not supported here */ }
    }

    let lastPosition = -1;
    const unsubscribe = engine.store.subscribe((state) => {
      session.playbackState = state.playing ? 'playing' : 'paused';
      // The OS scrubber only needs a coarse position; updating it on every
      // timeupdate would be dozens of calls a second for no visible gain.
      const position = Math.floor(state.currentTime);
      if (position === lastPosition || !Number.isFinite(state.duration) || state.duration <= 0) return;
      lastPosition = position;
      try {
        session.setPositionState?.({
          duration: state.duration,
          playbackRate: state.speed,
          position: Math.min(position, state.duration),
        });
      } catch { /* position outside the reported duration */ }
    });

    return () => {
      unsubscribe();
      for (const [action] of handlers) {
        try { session.setActionHandler(action, null); } catch { /* ignore */ }
      }
      session.metadata = null;
      session.playbackState = 'none';
    };
  }, [engine, title, poster, artist, album, onNext, onPrevious]);

  return null;
}
