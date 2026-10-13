import { useState, type CSSProperties, type ComponentType } from 'react';
// Type-only: erased at build time, so the facade entry never bundles the player.
import type { VideoPlayerComponentProps } from './VideoPlayer.js';

export type VideoPlayerFacadeProps = VideoPlayerComponentProps & {
  /** Poster shown until the click. Also fixes the box size, so nothing jumps on load. */
  poster?: string;
  /** CSS `aspect-ratio` of the cover and of the player (default `16 / 9`). */
  aspectRatio?: string;
  /** Accessible name of the play button (default `Play`; the title is appended). */
  playLabel?: string;
  /** Start downloading the player when the pointer or focus arrives (default `true`). */
  prefetch?: boolean;
};

type PlayerModule = { VideoPlayer: ComponentType<VideoPlayerComponentProps> };

// One shared import per page: the module system dedupes, this just keeps the promise.
let pending: Promise<PlayerModule> | null = null;
const loadPlayer = (): Promise<PlayerModule> =>
  (pending ??= import('@kuraykaraaslan/kui-player/react').catch((error: unknown) => {
    pending = null;   // let a retry try again after a network failure
    throw error;
  }));

const boxStyle = (aspectRatio: string): CSSProperties => ({
  position: 'relative', width: '100%', aspectRatio, background: '#000', overflow: 'hidden',
});

/**
 * A poster and a play button, and nothing else, until the viewer clicks. Only
 * then is the player downloaded — keeping it, hls.js and the stylesheet off the
 * page's critical path. Import it from `@kuraykaraaslan/kui-player/facade`.
 *
 * The click that loads the player also starts playback: the player mounts with
 * `autoPlay`, which the browser allows because the viewer just interacted.
 */
export function VideoPlayerFacade({
  aspectRatio = '16 / 9', playLabel = 'Play', prefetch = true, ...player
}: VideoPlayerFacadeProps) {
  const [Player, setPlayer] = useState<PlayerModule['VideoPlayer'] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');

  if (Player) return <Player {...player} autoPlay />;

  const warm = () => { if (prefetch) void loadPlayer().catch(() => { /* retried on click */ }); };
  const start = () => {
    setState('loading');
    loadPlayer().then(
      (m) => setPlayer(() => m.VideoPlayer),
      () => setState('failed'),
    );
  };

  const label = player.title ? `${playLabel} ${player.title}` : playLabel;
  return (
    <div style={boxStyle(aspectRatio)} className={player.className}>
      {player.poster && (
        <img
          src={player.poster}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <button
        type="button"
        onClick={start}
        onPointerEnter={warm}
        onFocus={warm}
        disabled={state === 'loading'}
        aria-label={label}
        aria-busy={state === 'loading'}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', border: 0, padding: 0,
          background: 'transparent', cursor: 'pointer',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '4.5rem', height: '4.5rem', borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)', color: '#fff',
          }}
        >
          <svg viewBox="0 0 24 24" width="2rem" height="2rem" fill="currentColor" focusable="false">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </button>
      {state === 'failed' && (
        <p role="alert" style={{ position: 'absolute', insetInline: 0, bottom: '0.5rem', margin: 0, textAlign: 'center', color: '#fff', fontSize: '0.875rem' }}>
          Could not load the player. Click to retry.
        </p>
      )}
    </div>
  );
}
