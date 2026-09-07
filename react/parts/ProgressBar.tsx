import { forwardRef } from 'react';

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
    progress, buffered, seekHoverRatio, hoverTime, valueText,
    onSeek, onSeekMouseMove, onSeekLeave, onScrubStart, onScrubMove, onScrubEnd,
    onSeekBy, onSeekToRatio,
  },
  ref,
) {
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
      aria-label="Seek"
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
      <div ref={ref} className="kui-seek-track">
        <div className="kui-seek-buffered" style={{ width: `${buffered}%` }} />
        <div className="kui-seek-played" style={{ width: `${progress}%` }} />
        {seekHoverRatio !== null && (
          <div className="kui-seek-hover" style={{ width: `${seekHoverRatio * 100}%` }} />
        )}
        <div className="kui-seek-thumb" style={{ left: `calc(${progress}% - 7px)` }} />
        {hoverTime && seekHoverRatio !== null && (
          <div className="kui-seek-tip" style={{ left: `${seekHoverRatio * 100}%` }}>{hoverTime}</div>
        )}
      </div>
    </div>
  );
});
