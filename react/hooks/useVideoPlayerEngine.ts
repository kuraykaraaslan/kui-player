import { useContext } from 'react';
import { VideoPlayerEngineContext } from '../VideoPlayerEngineContext';

export function useVideoPlayerEngine() {
  const engine = useContext(VideoPlayerEngineContext);
  if (!engine) throw new Error('useVideoPlayerEngine must be used inside <VideoPlayer>');
  return engine;
}
