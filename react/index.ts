"use client";

export { VideoPlayer } from './VideoPlayer';
export type { VideoPlayerComponentProps } from './VideoPlayer';
export { Icon, IconProvider } from './icons';
export type { IconName, IconOverrides } from './icons';
export { PLAYER_CSS, injectPlayerStyles, usePlayerStyles } from './styles';
export { VideoPlayerChrome } from './VideoPlayerChrome';
export type { VideoPlayerChromeProps } from './VideoPlayerChrome';
export { VideoPlayerEngineContext } from './VideoPlayerEngineContext';
export { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
export { useVideoPlayerStore, useVideoPlayerStoreApi } from './hooks/useVideoPlayerStore';
export { useTouchGestures } from './hooks/useTouchGestures';
export type { GestureFeedback } from './hooks/useTouchGestures';
// Adapters live on the core entry (`@kuraykaraaslan/kui-player`) so that the
// React bundle never carries streaming code an app may not use.
export { AUTO_QUALITY, AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters/adapter.types';
export type { MediaAdapter, MediaAdapterHost } from '../modules/videoplayer/adapters/adapter.types';

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
