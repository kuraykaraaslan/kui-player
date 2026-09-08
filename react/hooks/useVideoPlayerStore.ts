import { useStore } from './useStore.js';
import type { VideoPlayerStore, VideoPlayerStoreApi } from '../../modules/videoplayer/videoplayer.store.js';
import { useVideoPlayerEngine } from './useVideoPlayerEngine.js';

export function useVideoPlayerStore<T>(selector: (s: VideoPlayerStore) => T): T {
  const engine = useVideoPlayerEngine();
  return useStore(engine.store, selector);
}

export function useVideoPlayerStoreApi(): VideoPlayerStoreApi {
  return useVideoPlayerEngine().store;
}
