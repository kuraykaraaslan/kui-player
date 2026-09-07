import { useEffect, type RefObject } from 'react';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine.js';

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

      // A focused slider or text field owns its own arrow/space handling; the
      // player must not seek while someone is dragging the volume with a key.
      const target = e.target as HTMLElement | null;
      const interactive = target?.closest?.('input, textarea, select, [role="slider"], [contenteditable="true"]');
      if (interactive && e.key !== 'Escape') return;

      const s = engine.store.getState();

      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); engine.togglePlay(); break;
        case 'ArrowLeft':  e.preventDefault(); engine.seekBy(-10); break;
        case 'ArrowRight': e.preventDefault(); engine.seekBy(10);  break;
        case 'ArrowUp':    e.preventDefault(); engine.setVolume(s.volume + 0.1); break;
        case 'ArrowDown':  e.preventDefault(); engine.setVolume(s.volume - 0.1); break;
        case 'm': e.preventDefault(); engine.toggleMute(); break;
        case 'f': e.preventDefault(); engine.toggleFullscreen(c); break;
        case 'i': e.preventDefault(); void engine.togglePictureInPicture(); break;
        case 'Escape':
          if (s.showSettings) { e.preventDefault(); s.setShowSettings(false); s.setSettingsView('main'); }
          // Emulated fullscreen gets no browser-provided escape hatch — wire one.
          else if (s.fakeFullscreen) { e.preventDefault(); engine.exitFullscreen(c); }
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [containerRef, engine]);
}
