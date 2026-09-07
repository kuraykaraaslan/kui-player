import { forwardRef } from 'react';

type ProgressBarProps = {
  progress: number;
  buffered: number;
  seekHoverX: number | null;
  seekHoverPct: number | null;
  hoverTime: string | null;
  onSeek: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSeekLeave: () => void;
  onScrubStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Spoken position, e.g. "1:12 of 4:20" — a bare percentage is meaningless here. */
  valueText: string;
};

/**
 * The forwarded ref lands on the *visual* bar, which is what position maths
 * measures; the interactive box around it is padded out to a 44px touch target
 * without making the bar itself look chunky.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  {
    progress, buffered, seekHoverX, seekHoverPct, hoverTime, valueText,
    onSeek, onSeekMouseMove, onSeekLeave, onScrubStart, onScrubMove, onScrubEnd,
  },
  ref,
) {
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
    >
      <div ref={ref} className="kui-seek-track">
        <div className="kui-seek-buffered" style={{ width: `${buffered}%` }} />
        <div className="kui-seek-played" style={{ width: `${progress}%` }} />
        {seekHoverPct !== null && (
          <div className="kui-seek-hover" style={{ width: `${seekHoverPct}%` }} />
        )}
        <div className="kui-seek-thumb" style={{ left: `calc(${progress}% - 7px)` }} />
        {hoverTime && seekHoverX !== null && (
          <div className="kui-seek-tip" style={{ left: seekHoverX }}>{hoverTime}</div>
        )}
      </div>
    </div>
  );
});
