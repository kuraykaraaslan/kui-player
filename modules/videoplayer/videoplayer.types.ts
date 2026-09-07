export type QualityOption = { label: string; value: string };
export type SubtitleTrack = { label: string; srclang?: string; src: string };
export type AudioTrackOption = { label: string; language?: string };

export type VideoSource = { src: string; type?: string };
export type SubtitleFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type SettingsView =
  | 'main'
  | 'quality'
  | 'speed'
  | 'subtitles'
  | 'subtitle-size'
  | 'language';

export type CastState = 'unavailable' | 'available' | 'connecting' | 'connected';

/**
 * A `MediaError` flattened into something the store can hold and the UI can render.
 * `code` mirrors `MediaError.code` (1–4); `0` means the element reported an error
 * without one (rare, but `video.error` is nullable).
 */
export type PlayerError = {
  code: number;
  /** Machine-readable name, e.g. `MEDIA_ERR_SRC_NOT_SUPPORTED`. */
  name: string;
  /** Human-readable message suitable for the error overlay. */
  message: string;
  /** Whether a retry has a plausible chance of succeeding (network / decode). */
  recoverable: boolean;
};

export type VideoPlayerProps = {
  src: string | VideoSource | (string | VideoSource)[];
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  startMuted?: boolean;
  qualities?: QualityOption[];
  defaultQuality?: string;
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  onQualityChange?: (value: string) => void;
  onAudioTrackChange?: (index: number) => void;
  /**
   * Play inline on iOS Safari instead of handing off to the native fullscreen
   * player. Defaults to `true` — turning it off means our chrome is never seen
   * on iPhone.
   */
  playsInline?: boolean;
  controlsVisible?: boolean;
  autoHideControls?: boolean;
  onControlsVisibilityChange?: (visible: boolean) => void;
  enableCast?: boolean;
  onCastStateChange?: (state: CastState) => void;
  className?: string;
};

// ─── internal Cast SDK type surface ──────────────────────────────────────────

export type CastSession = {
  getCastDevice: () => { friendlyName: string } | null;
  loadMedia: (request: unknown) => Promise<void>;
};
export type CastContextInstance = {
  setOptions: (opts: { receiverApplicationId: string; autoJoinPolicy: string }) => void;
  getCastState: () => string;
  getCurrentSession: () => CastSession | null;
  requestSession: () => Promise<void>;
  endCurrentSession: (stopCasting: boolean) => void;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
};
export type RemotePlayer = {
  isPaused: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  isMuted: boolean;
  isConnected: boolean;
};
export type RemotePlayerController = {
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  playOrPause: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  muteOrUnmute: () => void;
  stop: () => void;
};
export type CastFrameworkNs = {
  CastContext: { getInstance: () => CastContextInstance };
  CastContextEventType: { CAST_STATE_CHANGED: string };
  RemotePlayer: new () => RemotePlayer;
  RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
  RemotePlayerEventType: { ANY_CHANGE: string };
};
export type ChromeCastNs = {
  AutoJoinPolicy: { ORIGIN_SCOPED: string };
  Image: new (url: string) => unknown;
  media: {
    DEFAULT_MEDIA_RECEIVER_APP_ID: string;
    MediaInfo: new (contentId: string, contentType: string) => { metadata?: unknown };
    GenericMediaMetadata: new () => { title?: string; images?: unknown[] };
    LoadRequest: new (mediaInfo: unknown) => { currentTime?: number };
  };
};
