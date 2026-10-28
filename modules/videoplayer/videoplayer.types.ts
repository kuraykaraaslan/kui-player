import type { MediaAdapter } from './adapters/adapter.types.js';
import type { Chapter } from './videoplayer.vtt.js';
import type { LiveInput } from './videoplayer.live.js';
import type { PresenceGroup, PresenceOptions } from './videoplayer.presence.js';

export type QualityOption = { label: string; value: string };
export type SubtitleTrack = {
  label: string;
  srclang?: string;
  src: string;
  /**
   * Fetch and time this track in the player instead of handing it to the
   * element's text-track machinery. Set for files the viewer drops in (their
   * object URLs have no extension to go by); needed whenever a delay applies.
   */
  local?: boolean;
};
/** `description` is audio description for blind and low-vision viewers. */
export type AudioTrackKind = 'main' | 'description' | 'commentary';
export type AudioTrackOption = { label: string; language?: string; kind?: AudioTrackKind };

export type VideoSource = { src: string; type?: string };

/**
 * One of several addresses for the same stream — "Standard" and "High", say.
 * Unlike `src` (a list of fallbacks for the browser to pick from), the viewer
 * chooses between these in the quality menu.
 */
export type AlternateSource = {
  /** Shown in the quality menu. */
  label: string;
  src: string;
  /** MIME type, when the address does not say (`.m3u8`, `.mp4`). */
  type?: string;
};
export type SubtitleFontSize = 'sm' | 'md' | 'lg' | 'xl';
/** How cue text is separated from the picture behind it. */
export type SubtitleEdge = 'none' | 'shadow' | 'outline';
export type SubtitleFont = 'sans' | 'serif' | 'mono';
export type SettingsView =
  | 'main'
  | 'quality'
  | 'speed'
  | 'subtitles'
  | 'subtitle-size'
  | 'subtitle-style'
  | 'chapters'
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
  /**
   * What the source itself said when it refused the request — the `message` of
   * a JSON answer or a short plain-text body. Shown under `message`, verbatim.
   */
  detail?: string;
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

/** One entry in a playlist. Everything but `src` falls back to the player's props. */
export type PlaylistItem = {
  /** Required unless `playlist` is given, in which case the list provides it. */
  src?: string | VideoSource | (string | VideoSource)[];
  /** Play through a list, advancing when each item ends. */
  playlist?: PlaylistItem[];
  /** Controlled playlist position; omit to let the player own it. */
  playlistIndex?: number;
  onPlaylistIndexChange?: (index: number) => void;
  /** Seconds of "up next" countdown before advancing. `0` advances at once. */
  playlistCountdown?: number;
  title?: string;
  poster?: string;
  subtitles?: SubtitleTrack[];
  chapters?: string | Chapter[];
  thumbnails?: string;
};

/** Built-in token presets. Anything else is a custom `--kui-*` set. */
export type PlayerTheme = 'default' | 'minimal' | 'broadcast' | 'cinema';

/**
 * Places a consumer can put their own nodes without forking the chrome. Typed
 * as `unknown` here because this module stays framework-agnostic; the React
 * layer narrows it to `ReactNode`.
 */
export type PlayerSlots<Node = unknown> = {
  /** Across the top of the player, above the scrim. */
  top?: Node;
  /** Between the title and the seek bar. */
  aboveControls?: Node;
  /** Start of the control row, before the skip-back button. */
  controlsStart?: Node;
  /** End of the control row, after fullscreen. */
  controlsEnd?: Node;
};

export type VideoPlayerProps = {
  /** Required unless `playlist` is given, in which case the list provides it. */
  src?: string | VideoSource | (string | VideoSource)[];
  /** Play through a list, advancing when each item ends. */
  playlist?: PlaylistItem[];
  /** Controlled playlist position; omit to let the player own it. */
  playlistIndex?: number;
  onPlaylistIndexChange?: (index: number) => void;
  /** Seconds of "up next" countdown before advancing. `0` advances at once. */
  playlistCountdown?: number;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  loop?: boolean;
  startMuted?: boolean;
  qualities?: QualityOption[];
  defaultQuality?: string;
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  /** A WebVTT chapters file, or the chapters themselves. */
  chapters?: string | Chapter[];
  /** A WebVTT storyboard for seek-bar previews (`#xywh=` sprites supported). */
  thumbnails?: string;
  onQualityChange?: (value: string) => void;
  onAudioTrackChange?: (index: number) => void;
  /**
   * Play inline on iOS Safari instead of handing off to the native fullscreen
   * player. Defaults to `true` — turning it off means our chrome is never seen
   * on iPhone.
   */
  playsInline?: boolean;
  /** A preset token set: `minimal`, `broadcast`, `cinema`, or the default. */
  theme?: PlayerTheme;
  /** Streaming adapters to consult for `src` — see `createHlsAdapter`. */
  adapters?: MediaAdapter[];
  /**
   * Several addresses for the same stream, chosen from the quality menu. Replaces
   * `src` when given. The first is the default.
   */
  sources?: AlternateSource[];
  /**
   * With `sources`: play the second one in fullscreen and the first in the card,
   * for as long as the viewer has not picked one by hand. Default `false`.
   */
  preferAlternateInFullscreen?: boolean;
  /** Called when the viewer (or the fullscreen rule) changes the active `sources` entry. */
  onSourceChange?: (index: number, source: AlternateSource) => void;
  /**
   * Load on first play: an HLS (adapter-managed) source is not attached and no
   * playlist or segment is requested until the viewer presses Play (or code
   * calls `play()`). With `autoPlay` it loads at once. Sources no adapter claims
   * are unaffected. Default `false`.
   */
  loadOnPlay?: boolean;
  /**
   * Live behaviour. Live is detected from the stream, so this is optional:
   * `true` / an object says "this source is live" up front (small-tile quality
   * defaults), `{ dvr: true }` keeps a seek bar, `false` turns the live
   * behaviours off. See `LiveOptions`.
   */
  live?: LiveInput;
  /**
   * Ask "Still watching?" after `everyMs` of playback and stop playing and
   * loading when nobody answers within `graceMs`. Inside a presence group the
   * group's timer and prompt are used instead. `false` opts a player out of its
   * group.
   */
  presence?: PresenceOptions | PresenceGroup | false;
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
