import { useEffect, type RefObject } from 'react';
import { useGoogleCast } from '../hooks/useGoogleCast';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine';
import type { CastState, VideoSource } from '../../modules/videoplayer/videoplayer.types';

export type CastApi = { toggleCast: () => void };

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | VideoSource | (string | VideoSource)[];
  title?: string;
  poster?: string;
  onCastStateChange?: (state: CastState) => void;
  onApi: (api: CastApi | null) => void;
};

/**
 * Google Cast, isolated behind a lazy boundary — the Cast SDK plumbing is a
 * few kilobytes that a player without a cast button should never download.
 * Renders nothing; it exists to own the hook and hand its `toggleCast` back up.
 */
export default function CastController({ videoRef, src, title, poster, onCastStateChange, onApi }: Props) {
  const engine = useVideoPlayerEngine();
  const { toggleCast } = useGoogleCast({
    enableCast: true, videoRef, src, title, poster, engine, onCastStateChange,
  });

  useEffect(() => {
    onApi({ toggleCast: () => { void toggleCast(); } });
    return () => onApi(null);
  }, [onApi, toggleCast]);

  return null;
}
