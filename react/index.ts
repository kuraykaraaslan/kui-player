"use client";

export { VideoPlayer } from './VideoPlayer';
export { VideoPlayerChrome } from './VideoPlayerChrome';
export type { VideoPlayerChromeProps } from './VideoPlayerChrome';
export { VideoPlayerEngineContext } from './VideoPlayerEngineContext';
export { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
export { useVideoPlayerStore, useVideoPlayerStoreApi } from './hooks/useVideoPlayerStore';
export { useTouchGestures } from './hooks/useTouchGestures';
export type { GestureFeedback } from './hooks/useTouchGestures';
export { createHlsAdapter, createDashAdapter, AUTO_QUALITY, AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters';
export type { MediaAdapter, MediaAdapterHost } from '../modules/videoplayer/adapters';

export type {
  VideoPlayerProps,
  VideoSource,
  QualityOption,
  SubtitleTrack,
  AudioTrackOption,
  SubtitleFontSize,
  CastState,
  PlayerError,
  GestureOptions,
} from '../modules/videoplayer/videoplayer.types';

export type { VideoPlayerState, VideoPlayerStore, VideoPlayerStoreApi } from '../modules/videoplayer/videoplayer.store';
