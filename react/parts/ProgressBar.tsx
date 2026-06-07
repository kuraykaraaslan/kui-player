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
};

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { progress, buffered, seekHoverX, seekHoverPct, hoverTime, onSeek, onSeekMouseMove, onSeekLeave },
  ref,
) {
  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      tabIndex={0}
      className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group/seek hover:h-2 transition-all"
      onClick={onSeek}
      onMouseMove={onSeekMouseMove}
      onMouseLeave={onSeekLeave}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${buffered}%` }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      {seekHoverPct !== null && (
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${seekHoverPct}%` }} />
      )}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
        style={{ left: `calc(${progress}% - 7px)` }}
      />
      {hoverTime && seekHoverX !== null && (
        <div
          className="absolute -top-8 -translate-x-1/2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap"
          style={{ left: seekHoverX }}
        >
          {hoverTime}
        </div>
      )}
    </div>
  );
});
