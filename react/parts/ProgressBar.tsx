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
      className="relative -my-3 flex h-11 cursor-pointer touch-none items-center group/seek"
      onClick={onSeek}
      onMouseMove={onSeekMouseMove}
      onMouseLeave={onSeekLeave}
      onPointerDown={onScrubStart}
      onPointerMove={onScrubMove}
      onPointerUp={onScrubEnd}
      onPointerCancel={onScrubEnd}
    >
      <div ref={ref} className="relative h-1.5 w-full rounded-full bg-white/20 transition-all group-hover/seek:h-2">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${buffered}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        {seekHoverPct !== null && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${seekHoverPct}%` }} />
        )}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover/seek:opacity-100"
          style={{ left: `calc(${progress}% - 7px)` }}
        />
        {hoverTime && seekHoverX !== null && (
          <div
            className="pointer-events-none absolute -top-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-xs text-white"
            style={{ left: seekHoverX }}
          >
            {hoverTime}
          </div>
        )}
      </div>
    </div>
  );
});
