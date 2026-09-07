import { useEffect, type MutableRefObject, type RefObject } from 'react';
import { useTouchGestures } from '../hooks/useTouchGestures.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { GestureOverlay } from './Overlays.js';
import type { GestureOptions } from '../../modules/videoplayer/videoplayer.types.js';

type Props = {
  containerRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  gestures?: boolean | GestureOptions;
  enabled: boolean;
  /** Lets the chrome ignore the click a touch gesture leaves behind. */
  suppressRef: MutableRefObject<() => boolean>;
};

/**
 * Touch gestures and their on-screen hints, behind a lazy boundary loaded only
 * on coarse-pointer devices. A mouse-and-keyboard visitor never downloads the
 * gesture engine, and a phone gets it right after first paint.
 */
export default function GestureLayer({ containerRef, videoRef, gestures, enabled, suppressRef }: Props) {
  const engine = useVideoPlayerEngine();
  const { feedback, suppressClick } = useTouchGestures({ containerRef, videoRef, engine, gestures, enabled });

  useEffect(() => {
    suppressRef.current = suppressClick;
    return () => { suppressRef.current = () => false; };
  }, [suppressRef, suppressClick]);

  return <GestureOverlay feedback={feedback} />;
}
