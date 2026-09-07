"use client";

export { VideoPlayer } from './VideoPlayer.js';
export type { VideoPlayerComponentProps } from './VideoPlayer.js';
export { Icon, IconProvider } from './icons/index.js';
export type { IconName, IconOverrides } from './icons/index.js';
export { PLAYER_CSS, injectPlayerStyles, usePlayerStyles } from './styles/index.js';
export { VideoPlayerChrome } from './VideoPlayerChrome.js';
export type { VideoPlayerChromeProps } from './VideoPlayerChrome.js';
export { VideoPlayerEngineContext } from './VideoPlayerEngineContext.js';
export { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine.js';
export { useVideoPlayerStore, useVideoPlayerStoreApi } from './hooks/useVideoPlayerStore.js';
export type { GestureFeedback } from './hooks/useTouchGestures.js';
// Adapters live on the core entry (`@kuraykaraaslan/kui-player`) so that the
// React bundle never carries streaming code an app may not use.
export { AUTO_QUALITY, AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters/adapter.types.js';
export type { MediaAdapter, MediaAdapterHost } from '../modules/videoplayer/adapters/adapter.types.js';

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
} from '../modules/videoplayer/videoplayer.types.js';

export type { VideoPlayerState, VideoPlayerStore, VideoPlayerStoreApi } from '../modules/videoplayer/videoplayer.store.js';
