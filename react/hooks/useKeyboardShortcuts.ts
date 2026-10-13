import { useEffect, useRef, type RefObject } from 'react';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine.js';
import { SPEEDS } from '../../modules/videoplayer/videoplayer.constants.js';
import { chapterJumpTarget, skippableAt } from '../../modules/videoplayer/videoplayer.chapters.js';
import type { Chapter } from '../../modules/videoplayer/videoplayer.vtt.js';
import { lookupShortcut, type Keymap } from '../../modules/videoplayer/videoplayer.shortcuts.js';

type Options = {
  containerRef: RefObject<HTMLDivElement | null>;
  engine: VideoPlayerEngine;
  keymap: Keymap;
  /** Number of subtitle tracks; `c` does nothing without any. */
  subtitleCount: number;
  onToggleHelp: () => void;
  onToggleStats: () => void;
  chapters: readonly Chapter[];
};

/** Frame length when the real rate is unknown — the video element does not expose it. */
const FRAME_SECONDS = 1 / 30;

export function useKeyboardShortcuts({ containerRef, engine, keymap, subtitleCount, onToggleHelp, onToggleStats, chapters }: Options) {
  // Latest-value ref so the listener is attached once and never goes stale.
  const live = useRef({ keymap, subtitleCount, onToggleHelp, onToggleStats, chapters });
  useEffect(() => { live.current = { keymap, subtitleCount, onToggleHelp, onToggleStats, chapters }; });
  const lastCaption = useRef(0);

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

      if (e.key === 'Escape') {
        if (s.showSettings) { e.preventDefault(); s.setShowSettings(false); s.setSettingsView('main'); }
        // Emulated fullscreen gets no browser-provided escape hatch — wire one.
        else if (s.fakeFullscreen) { e.preventDefault(); engine.exitFullscreen(c); }
        return;
      }

      // Modified keys belong to the browser and the screen reader (Ctrl+L, Alt+←…).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const { keymap: map, subtitleCount: tracks, onToggleHelp: toggleHelp, onToggleStats: toggleStats, chapters: chapterList } = live.current;
      const action = lookupShortcut(map, e.key, e.shiftKey);
      if (!action) return;
      e.preventDefault();

      switch (action) {
        case 'playPause': engine.togglePlay(); break;
        case 'seekBack': engine.seekBy(-10); break;
        case 'seekForward': engine.seekBy(10); break;
        case 'volumeUp': engine.setVolume(s.volume + 0.1); break;
        case 'volumeDown': engine.setVolume(s.volume - 0.1); break;
        case 'mute': engine.toggleMute(); break;
        case 'fullscreen': engine.toggleFullscreen(c); break;
        case 'pip': void engine.togglePictureInPicture(); break;
        case 'captions':
          if (tracks === 0) break;
          if (s.selectedSubtitle === null) s.setSelectedSubtitle(Math.min(lastCaption.current, tracks - 1));
          else { lastCaption.current = s.selectedSubtitle; s.setSelectedSubtitle(null); }
          break;
        case 'percent':
          if (s.duration > 0 && !s.isLive) engine.seek((Number(e.key) / 10) * s.duration);
          break;
        // Frame stepping only makes sense paused; while playing it would be a surprise nudge.
        case 'frameBack': if (!s.playing) engine.seekBy(-FRAME_SECONDS); break;
        case 'frameForward': if (!s.playing) engine.seekBy(FRAME_SECONDS); break;
        case 'faster': engine.setSpeed(SPEEDS.find((v) => v > s.speed) ?? SPEEDS[SPEEDS.length - 1]!); break;
        case 'slower': engine.setSpeed([...SPEEDS].reverse().find((v) => v < s.speed) ?? SPEEDS[0]!); break;
        case 'start': engine.seek(0); break;
        case 'end': if (s.duration > 0) engine.seek(s.duration); break;
        case 'help': toggleHelp(); break;
        case 'stats': toggleStats(); break;
        case 'skip': {
          const skippable = skippableAt(chapterList, s.currentTime);
          if (skippable) engine.seek(skippable.to);
          break;
        }
        case 'prevChapter': case 'nextChapter': {
          const to = chapterJumpTarget(chapterList, s.currentTime, action === 'nextChapter' ? 'next' : 'previous');
          if (to !== null) engine.seek(to);
          break;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [containerRef, engine]);
}
