import { cn } from '../../libs/utils/cn.js';
import { Icon } from '../icons/index.js';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';
import { SUBTITLE_SIZES } from '../../modules/videoplayer/videoplayer.constants.js';
import type { GestureFeedback } from '../hooks/useTouchGestures.js';
import type { PlayerError, SubtitleFontSize } from '../../modules/videoplayer/videoplayer.types.js';

export function CastOverlay({ castDeviceName, title }: { castDeviceName: string | null; title?: string }) {
  return (
    <div className="kui-overlay kui-overlay--cast">
      <Icon name="cast" className="kui-cast-icon" />
      <p className="kui-cast-name">
        {castDeviceName ? `Casting to ${castDeviceName}` : 'Casting to device'}
      </p>
      {title && <p className="kui-cast-title">{title}</p>}
    </div>
  );
}

export function LoadingOverlay() {
  return (
    <div className="kui-overlay kui-overlay--loading">
      <Icon name="spinner" className="kui-spinner kui-spin" />
    </div>
  );
}

/**
 * Shown whenever the element reports a fatal `MediaError`. Replaces the spinner —
 * a failed source must never leave the player spinning forever.
 */
export function ErrorOverlay({
  error, retrying, onRetry,
}: {
  error: PlayerError;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="kui-overlay kui-overlay--error" role="alert" aria-live="assertive">
      <Icon name="alert" className="kui-error-icon" />
      <p className="kui-error-message">{error.message}</p>
      <p className="kui-error-code">{error.name}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className="kui-btn-outline">
        <Icon name="retry" className={cn(retrying && 'kui-spin')} />
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}

export function CenterPlayOverlay({ playing }: { playing: boolean }) {
  return (
    <div className={cn('kui-overlay kui-overlay--center', playing && 'is-playing')} aria-hidden="true">
      <div className="kui-center-play">
        <Icon name="play" />
      </div>
    </div>
  );
}

/**
 * The transient hint a touch gesture leaves behind — the skip bubble, the 2×
 * badge, the volume/brightness meter, the scrub preview. Purely informational,
 * so it never takes pointer events.
 */
export function GestureOverlay({ feedback }: { feedback: GestureFeedback }) {
  if (!feedback) return null;

  if (feedback.kind === 'seek') {
    const forward = feedback.seconds > 0;
    return (
      <div className={cn('kui-gesture-side', forward ? 'kui-gesture-side--right' : 'kui-gesture-side--left')} aria-hidden="true">
        <div className="kui-gesture-bubble">
          <Icon name={forward ? 'skipForward' : 'skipBack'} />
          <span>{Math.abs(feedback.seconds)}s</span>
        </div>
      </div>
    );
  }

  const body = feedback.kind === 'rate'
    ? <span>{feedback.rate}× speed</span>
    : feedback.kind === 'scrub'
      ? (
        <>
          <span>{formatTime(feedback.time)}</span>
          <span className="kui-muted">
            {feedback.delta >= 0 ? '+' : '−'}{formatTime(Math.abs(feedback.delta))}
          </span>
        </>
      )
      : (
        <>
          <Icon name={feedback.kind === 'volume' ? 'volumeHigh' : 'brightness'} />
          <span className="kui-meter">
            <span className="kui-meter-fill" style={{ width: `${Math.round(feedback.value * 100)}%` }} />
          </span>
          <span className="kui-meter-value">{Math.round(feedback.value * 100)}%</span>
        </>
      );

  return (
    <div className="kui-gesture-pill" aria-hidden="true">
      <div className="kui-gesture-card">{body}</div>
    </div>
  );
}

export function SubtitleOverlay({
  cueText, effectiveControls, subtitleFontSize,
}: {
  cueText: string;
  effectiveControls: boolean;
  subtitleFontSize: SubtitleFontSize;
}) {
  return (
    <div className={cn('kui-subtitles', effectiveControls && 'is-raised')}>
      <span className="kui-subtitle-text" style={{ fontSize: SUBTITLE_SIZES[subtitleFontSize] }}>
        {cueText}
      </span>
    </div>
  );
}
