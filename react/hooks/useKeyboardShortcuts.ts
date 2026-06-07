import { useEffect, type RefObject } from 'react';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';

type Options = {
  containerRef: RefObject<HTMLDivElement | null>;
  engine: VideoPlayerEngine;
};

export function useKeyboardShortcuts({ containerRef, engine }: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const c = containerRef.current;
      if (!c) return;
      const focused = document.activeElement;
      if (!c.contains(focused) && focused !== c) return;

      const s = engine.store.getState();

      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); engine.togglePlay(); break;
        case 'ArrowLeft':  e.preventDefault(); engine.seekBy(-10); break;
        case 'ArrowRight': e.preventDefault(); engine.seekBy(10);  break;
        case 'ArrowUp':    e.preventDefault(); engine.setVolume(s.volume + 0.1); break;
        case 'ArrowDown':  e.preventDefault(); engine.setVolume(s.volume - 0.1); break;
        case 'm': e.preventDefault(); engine.toggleMute(); break;
        case 'f': e.preventDefault(); if (c) engine.toggleFullscreen(c); break;
        case 'Escape':
          if (s.showSettings) { e.preventDefault(); s.setShowSettings(false); s.setSettingsView('main'); }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [containerRef, engine]);
}
