import type { MediaAdapter } from './adapters/adapter.types.js';

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

export type CastState = 'unavailable' | 'available' | 'connecting' | 'connected' | 'error';

/** One entry in a Cast queue. `src` is the only required field. */
export type CastQueueItem = {
  src: string;
  /** MIME type; defaults to `video/mp4`. */
  type?: string;
  title?: string;
  poster?: string;
  /** Where the receiver should start this item. */
  startTime?: number;
  /** Subtitle tracks to hand to the receiver alongside the media. */
  subtitles?: SubtitleTrack[];
};

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

/** Which touch gestures are live. `true` enables the safe defaults. */
export type GestureOptions = {
  /** Double-tap the left/right half to seek ∓10s. Default `true`. */
  doubleTapSeek?: boolean;
  /** Seconds a double-tap seeks. Default `10`. */
  seekStep?: number;
  /** Hold to play at 2×, release to restore. Default `true`. */
  longPressSpeed?: boolean;
  /** Rate applied while holding. Default `2`. */
  longPressRate?: number;
  /** Drag vertically on the right half to change volume. Default `true`. */
  verticalVolume?: boolean;
  /** Drag vertically on the left half to dim the picture. Default `false`. */
  verticalBrightness?: boolean;
  /** Drag horizontally to scrub. Default `true`. */
  horizontalScrub?: boolean;
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
  /** Streaming adapters to consult for `src` — see `createHlsAdapter`. */
  adapters?: MediaAdapter[];
  /** Show the Picture-in-Picture button where the browser supports it. Default `true`. */
  enablePictureInPicture?: boolean;
  /** Touch gestures. `false` disables them entirely. Default `true`. */
  gestures?: boolean | GestureOptions;
  /** Go fullscreen automatically when a phone is rotated to landscape. Default `false`. */
  autoFullscreenOnLandscape?: boolean;
  /** On iOS, use the OS video player for fullscreen instead of emulating it. Default `false`. */
  preferNativeIosFullscreen?: boolean;
  controlsVisible?: boolean;
  autoHideControls?: boolean;
  onControlsVisibilityChange?: (visible: boolean) => void;
  enableCast?: boolean;
  /**
   * Cast a playlist instead of the single current source. The first item is
   * loaded on connect; the receiver owns the rest of the queue.
   */
  castQueue?: CastQueueItem[];
  /** A custom receiver application id — brand the TV side of the session. */
  castReceiverAppId?: string;
  onCastStateChange?: (state: CastState) => void;
  className?: string;
};

// ─── internal Cast SDK type surface ──────────────────────────────────────────

export type CastMediaSession = {
  currentTime?: number;
  queueNext: (success: () => void, error: (e: unknown) => void) => void;
  queuePrev: (success: () => void, error: (e: unknown) => void) => void;
  editTracksInfo: (request: unknown, success: () => void, error: (e: unknown) => void) => void;
  getEstimatedTime?: () => number;
};
export type CastSession = {
  getCastDevice: () => { friendlyName: string } | null;
  loadMedia: (request: unknown) => Promise<void>;
  queueLoad?: (request: unknown) => Promise<void>;
  getMediaSession?: () => CastMediaSession | null;
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
    MediaInfo: new (contentId: string, contentType: string) => {
      metadata?: unknown;
      tracks?: unknown[];
    };
    GenericMediaMetadata: new () => { title?: string; images?: unknown[] };
    LoadRequest: new (mediaInfo: unknown) => { currentTime?: number; activeTrackIds?: number[] };
    QueueLoadRequest?: new (items: unknown[]) => { startIndex?: number; repeatMode?: string };
    QueueItem?: new (mediaInfo: unknown) => { startTime?: number };
    Track?: new (id: number, type: string) => {
      trackContentId?: string;
      trackContentType?: string;
      subtype?: string;
      name?: string;
      language?: string;
    };
    TrackType?: { TEXT: string };
    TextTrackType?: { SUBTITLES: string };
    EditTracksInfoRequest?: new (activeTrackIds: number[]) => unknown;
    RepeatMode?: { OFF: string };
  };
};
