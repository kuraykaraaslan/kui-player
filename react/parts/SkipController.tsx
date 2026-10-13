import { useEffect, useRef, useState } from 'react';
import { skippableAt } from '../../modules/videoplayer/videoplayer.chapters.js';
import type { Chapter } from '../../modules/videoplayer/videoplayer.vtt.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from '../hooks/useVideoPlayerStore.js';
import { useTranslate } from '../i18n/index.js';

const SHOW_FOR_MS = 8000;

export type SkipOptions = {
  /** Skip intros and recaps without asking (default false). */
  autoSkip?: boolean;
};

/**
 * "Skip intro" / "Skip recap". Appears while the playhead is inside such a
 * chapter and fades out after a few seconds; it never takes focus. The wrapper
 * is a polite live region, so its arrival is announced.
 */
export default function SkipController({ chapters, options }: Readonly<{ chapters: Chapter[]; options: SkipOptions }>) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const time = useVideoPlayerStore((s) => s.currentTime);
  // No duration means no metadata yet: the element may not be attached, and a
  // seek then is silently dropped — which would burn the one-shot auto-skip.
  const ready = useVideoPlayerStore((s) => s.duration > 0);
  const target = skippableAt(chapters, time);
  const index = target?.index ?? -1;
  const [hiddenFor, setHiddenFor] = useState(-1);   // chapter whose button timed out
  const autoSkipped = useRef(-1);
  // Leaving the chapter re-arms the button for the next visit (adjusted during render).
  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    if (index < 0 && hiddenFor !== -1) setHiddenFor(-1);
  }

  useEffect(() => {
    if (index < 0) return;
    const id = window.setTimeout(() => setHiddenFor(index), SHOW_FOR_MS);
    return () => window.clearTimeout(id);
  }, [index]);

  useEffect(() => {
    if (!target) { autoSkipped.current = -1; return; }
    if (!options.autoSkip || !ready) return;
    if (autoSkipped.current === target.index) return;
    autoSkipped.current = target.index;
    engine.seek(target.to);
  }, [engine, options.autoSkip, ready, target]);

  const visible = target !== null && hiddenFor !== index && !options.autoSkip;
  return (
    <div className="kui-skip" role="status">
      {visible && target && (
        <button type="button" className="kui-btn-outline" tabIndex={0} onClick={() => engine.seek(target.to)}>
          {t(target.kind === 'intro' ? 'skipIntro' : 'skipRecap')}
        </button>
      )}
    </div>
  );
}
