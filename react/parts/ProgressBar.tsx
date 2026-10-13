import type { AdSpan } from '../../modules/videoplayer/videoplayer.adbreaks.js';
import { forwardRef } from 'react';
import { useTranslate } from '../i18n/index.js';
import { ChapterTrack } from './ChapterTrack.js';
import { SeekPreview } from './SeekPreview.js';
import type { Chapter, StoryboardTile } from '../../modules/videoplayer/videoplayer.vtt.js';

type ProgressBarProps = {
  progress: number;
  buffered: number;
  /** Pointer position over the bar, 0–1, or `null` when it is elsewhere. */
  seekHoverRatio: number | null;
  hoverTime: string | null;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekLeave: () => void;
  onScrubStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Keyboard seeking while the bar has focus: ±seconds, or an absolute ratio. */
  onSeekBy: (delta: number) => void;
  onSeekToRatio: (ratio: number) => void;
  /** Spoken position, e.g. "1:12 of 4:20" — a bare percentage is meaningless here. */
  valueText: string;
  duration: number;
  /** Seconds the pointer is hovering, for the preview. */
  hoverSeconds: number | null;
  chapters: Chapter[];
  /** Ad-break spans as percentages of the bar. */
  adSpans?: AdSpan[];
  /** Bar heights 0–1: draws a waveform behind the played part. */
  peaks?: number[] | null;
  /** The A-B loop range as a percentage span. */
  loopSpan?: { left: number; width: number } | null;
  tiles: StoryboardTile[];
};

const ARROW_STEP_S = 5;
const PAGE_STEP_RATIO = 0.1;

/**
 * The forwarded ref lands on the *visual* bar, which is what position maths
 * measures; the interactive box around it is padded out to a 44px touch target
 * without making the bar itself look chunky.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  {
    progress, buffered, seekHoverRatio, hoverTime, valueText, duration,
    hoverSeconds, chapters, tiles, adSpans, loopSpan, peaks,
    onSeek, onSeekMouseMove, onSeekLeave, onScrubStart, onScrubMove, onScrubEnd,
    onSeekBy, onSeekToRatio,
  },
  ref,
) {
  const t = useTranslate();
  // The bar is a real slider, so it handles its own keys and stops them from
  // reaching the player-wide shortcuts, which would seek twice.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    switch (e.key) {
      case 'ArrowLeft':  handled(); onSeekBy(-ARROW_STEP_S); break;
      case 'ArrowRight': handled(); onSeekBy(ARROW_STEP_S); break;
      case 'PageDown':   handled(); onSeekToRatio(progress / 100 - PAGE_STEP_RATIO); break;
      case 'PageUp':     handled(); onSeekToRatio(progress / 100 + PAGE_STEP_RATIO); break;
      case 'Home':       handled(); onSeekToRatio(0); break;
      case 'End':        handled(); onSeekToRatio(1); break;
      default: break;
    }
  };

  return (
    <div
      role="slider"
      aria-label={t('seek')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-valuetext={valueText}
      tabIndex={0}
      className="kui-seek"
      onClick={onSeek}
      onMouseMove={onSeekMouseMove}
      onMouseLeave={onSeekLeave}
      onPointerDown={onScrubStart}
      onPointerMove={onScrubMove}
      onPointerUp={onScrubEnd}
      onPointerCancel={onScrubEnd}
      onKeyDown={onKeyDown}
    >
      <div ref={ref} className={peaks ? 'kui-seek-track kui-seek-track--wave' : 'kui-seek-track'}>
        {peaks && <WaveformBars peaks={peaks} progress={progress} />}
        <div className="kui-seek-buffered" style={{ width: `${buffered}%` }} />
        <ChapterTrack chapters={chapters} duration={duration} progress={progress} />
        {loopSpan && (
          <div className="kui-loop-range" style={{ insetInlineStart: `${loopSpan.left}%`, width: `${loopSpan.width}%` }} aria-hidden="true" />
        )}
        {adSpans?.map((a) => (
          <div key={a.id} className="kui-adbreak" style={{ insetInlineStart: `${a.left}%`, width: `${a.width}%` }} aria-hidden="true" />
        ))}
        <div className="kui-seek-played" style={{ width: `${progress}%` }} />
        {seekHoverRatio !== null && (
          <div className="kui-seek-hover" style={{ width: `${seekHoverRatio * 100}%` }} />
        )}
        <div className="kui-seek-thumb" style={{ insetInlineStart: `${progress}%` }} />
        {hoverTime && seekHoverRatio !== null && (
          (tiles.length > 0 || chapters.length > 0)
            ? (
              <SeekPreview
                ratio={seekHoverRatio}
                time={hoverSeconds ?? 0}
                label={hoverTime}
                tiles={tiles}
                chapters={chapters}
                duration={duration}
              />
            )
            : <div className="kui-seek-tip" style={{ insetInlineStart: `${seekHoverRatio * 100}%` }}>{hoverTime}</div>
        )}
      </div>
    </div>
  );
});

/**
 * Two layers of the same bars: the full wave dimmed, and the played part on
 * top, clipped to the playhead. The slider around it keeps all the keyboard
 * and screen-reader behaviour; this is only what it looks like.
 */
function WaveformBars({ peaks, progress }: Readonly<{ peaks: number[]; progress: number }>) {
  const bar = 100 / peaks.length;
  const path = peaks
    .map((p, i) => {
      const h = Math.max(4, p * 100);
      return `M${(i * bar + bar * 0.15).toFixed(3)} ${((100 - h) / 2).toFixed(2)}h${(bar * 0.7).toFixed(3)}v${h.toFixed(2)}h-${(bar * 0.7).toFixed(3)}z`;
    })
    .join('');
  return (
    <>
      <svg className="kui-wave kui-wave--base" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg>
      <svg
        className="kui-wave kui-wave--played"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ clipPath: `inset(0 ${100 - Math.max(0, Math.min(100, progress))}% 0 0)` }}
      >
        <path d={path} />
      </svg>
    </>
  );
}
