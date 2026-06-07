import { useStore } from 'zustand/react';
import type { VideoPlayerStore, VideoPlayerStoreApi } from '../../modules/videoplayer/videoplayer.store';
import { useVideoPlayerEngine } from './useVideoPlayerEngine';

export function useVideoPlayerStore<T>(selector: (s: VideoPlayerStore) => T): T {
  const engine = useVideoPlayerEngine();
  return useStore(engine.store, selector);
}

export function useVideoPlayerStoreApi(): VideoPlayerStoreApi {
  return useVideoPlayerEngine().store;
}
