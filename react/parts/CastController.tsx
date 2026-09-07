import { useEffect, type RefObject } from 'react';
import { useGoogleCast } from '../hooks/useGoogleCast.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from '../hooks/useVideoPlayerStore.js';
import { Icon } from '../icons/index.js';
import type {
  CastQueueItem, CastState, SubtitleTrack, VideoSource,
} from '../../modules/videoplayer/videoplayer.types.js';

export type CastApi = {
  toggleCast: () => void;
  next: () => void;
  previous: () => void;
};

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | VideoSource | (string | VideoSource)[];
  title?: string;
  poster?: string;
  subtitles?: SubtitleTrack[];
  queue?: CastQueueItem[];
  receiverAppId?: string;
  onCastStateChange?: (state: CastState) => void;
  onApi: (api: CastApi | null) => void;
};

/**
 * The overlay shown while a session is live. It lives in this chunk because it
 * cannot render without one.
 */
function CastOverlay({
  castDeviceName, title, queueIndex, queueLength, onNext, onPrevious,
}: {
  castDeviceName: string | null;
  title?: string;
  queueIndex: number;
  queueLength: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const queued = queueLength > 1;
  return (
    <div className="kui-overlay kui-overlay--cast">
      <Icon name="cast" className="kui-cast-icon" />
      <p className="kui-cast-name">
        {castDeviceName ? `Casting to ${castDeviceName}` : 'Casting to device'}
      </p>
      {title && <p className="kui-cast-title">{title}</p>}
      {queued && (
        // The queue lives on the receiver, so these are the only controls that
        // can move it — the local element is not playing anything.
        <div className="kui-cast-queue">
          <button type="button" className="kui-btn-outline" onClick={onPrevious} disabled={queueIndex === 0}>
            <Icon name="skipBack" /> Previous
          </button>
          <span className="kui-cast-position">{queueIndex + 1} / {queueLength}</span>
          <button
            type="button"
            className="kui-btn-outline"
            onClick={onNext}
            disabled={queueIndex >= queueLength - 1}
          >
            Next <Icon name="skipForward" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Google Cast, isolated behind a lazy boundary — the Cast SDK plumbing is a
 * few kilobytes that a player without a cast button should never download.
 * It owns the hook, hands `toggleCast` back up, and renders the session overlay.
 */
export default function CastController({
  videoRef, src, title, poster, subtitles, queue, receiverAppId, onCastStateChange, onApi,
}: Props) {
  const engine = useVideoPlayerEngine();
  const { toggleCast, next, previous } = useGoogleCast({
    enableCast: true, videoRef, src, title, poster, subtitles, queue, receiverAppId, engine, onCastStateChange,
  });

  useEffect(() => {
    onApi({ toggleCast: () => { void toggleCast(); }, next, previous });
    return () => onApi(null);
  }, [onApi, toggleCast, next, previous]);

  const castState = useVideoPlayerStore((s) => s.castState);
  const castDeviceName = useVideoPlayerStore((s) => s.castDeviceName);
  const castError = useVideoPlayerStore((s) => s.castError);
  const queueIndex = useVideoPlayerStore((s) => s.castQueueIndex);
  const queueLength = useVideoPlayerStore((s) => s.castQueueLength);

  if (castState === 'connected') {
    return (
      <CastOverlay
        castDeviceName={castDeviceName}
        title={title}
        queueIndex={queueIndex}
        queueLength={queueLength}
        onNext={next}
        onPrevious={previous}
      />
    );
  }
  if (castState === 'error' && castError) {
    return <div className="kui-cast-error" role="status">{castError}</div>;
  }
  return null;
}
