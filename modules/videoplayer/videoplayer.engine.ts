import { createVideoPlayerStore, type VideoPlayerStoreApi } from './videoplayer.store.js';
import { AUTO_QUALITY, AUTO_QUALITY_VALUE, type MediaAdapter, type MediaAdapterHost } from './adapters/adapter.types.js';
import {
  PlayerEmitter, QuartileTracker,
  type PlayerEventHandler, type PlayerEventName,
} from './videoplayer.events.js';
import type {
  AudioTrackOption, PlayerError, RemotePlayer, RemotePlayerController,
} from './videoplayer.types.js';

// ─── vendor-prefixed surfaces the DOM lib does not declare ───────────────────

/** Safari's `AudioTrackList`; Chrome and Firefox expose no equivalent. */
type NativeAudioTrack = { label?: string; language?: string; enabled: boolean };
type NativeAudioTrackList = {
  length: number;
  [index: number]: NativeAudioTrack | undefined;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
};

type VendorVideo = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
  audioTracks?: NativeAudioTrackList;
  requestPictureInPicture?: () => Promise<unknown>;
  disablePictureInPicture?: boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: string;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
};

type VendorElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type VendorDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  pictureInPictureElement?: Element | null;
  exitPictureInPicture?: () => Promise<void>;
};

const FAKE_FS_Z = 2147483646;
/** How close to the edge of a live stream still counts as "live". */
const LIVE_EDGE_TOLERANCE_S = 10;

export type VideoPlayerEngineOptions = {
  defaultQuality?: string;
  startMuted?: boolean;
  autoHideControls?: boolean;
  controlsVisible?: boolean;
  /** Automatic retries after a *network* error before giving up (default 3, `0` disables). */
  maxAutoRetries?: number;
  /** Streaming adapters (hls.js / dash.js wrappers) to consult for every source. */
  adapters?: MediaAdapter[];
  /**
   * On iOS, hand fullscreen to the OS video player instead of emulating it.
   * Default `false` — the native player replaces our chrome entirely.
   */
  preferNativeIosFullscreen?: boolean;
};

/** State carried across a source swap so the viewer lands where they left off. */
type RestorePoint = {
  time: number;
  playing: boolean;
  rate: number;
  muted: boolean;
  volume: number;
};

const RETRY_BASE_MS = 500;

/** `MediaError.code` → something a human can read and the UI can act on. */
function describeMediaError(err: MediaError | null): PlayerError {
  switch (err?.code) {
    case 1:
      return {
        code: 1, name: 'MEDIA_ERR_ABORTED', recoverable: true,
        message: 'Playback was aborted before the video could load.',
      };
    case 2:
      return {
        code: 2, name: 'MEDIA_ERR_NETWORK', recoverable: true,
        message: 'A network error interrupted the video download.',
      };
    case 3:
      return {
        code: 3, name: 'MEDIA_ERR_DECODE', recoverable: true,
        message: 'The video could not be decoded — the file may be corrupt.',
      };
    case 4:
      return {
        code: 4, name: 'MEDIA_ERR_SRC_NOT_SUPPORTED', recoverable: false,
        message: 'This video is unavailable or its format is not supported.',
      };
    default:
      return {
        code: 0, name: 'MEDIA_ERR_UNKNOWN', recoverable: true,
        message: 'The video could not be played.',
      };
  }
}

export class VideoPlayerEngine {
  readonly store: VideoPlayerStoreApi;

  private video: HTMLVideoElement | null = null;
  private listeners: (() => void) | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private restorePoint: RestorePoint | null = null;

  private readonly emitter = new PlayerEmitter();
  private readonly quartiles = new QuartileTracker();
  private loadStartedAt = 0;
  private metadataAt = 0;
  private stallStartedAt = 0;
  private stallCount = 0;
  private stallTotalMs = 0;
  private firstFrameReported = false;
  private seekFrom = 0;

  private adapters: MediaAdapter[] = [];
  private activeAdapter: MediaAdapter | null = null;
  private currentSrc: string | null = null;
  private fakeFsRestore: (() => void) | null = null;

  autoHideControls: boolean;
  controlsVisible: boolean | undefined;
  /**
   * Set while focus is inside the player. Auto-hide stays off for as long as it
   * is true — tabbing to a control that has faded out is an accessibility bug,
   * not a feature.
   */
  keyboardFocus = false;

  readonly maxAutoRetries: number;
  readonly preferNativeIosFullscreen: boolean;

  // Set by useGoogleCast hook after Cast connects
  remotePlayer: RemotePlayer | null = null;
  remoteController: RemotePlayerController | null = null;

  constructor(opts: VideoPlayerEngineOptions = {}) {
    this.store = createVideoPlayerStore({
      defaultQuality: opts.defaultQuality,
      startMuted: opts.startMuted,
    });
    this.autoHideControls = opts.autoHideControls ?? true;
    this.controlsVisible = opts.controlsVisible;
    this.maxAutoRetries = opts.maxAutoRetries ?? 3;
    this.preferNativeIosFullscreen = opts.preferNativeIosFullscreen ?? false;
    if (opts.adapters) this.adapters = [...opts.adapters];
  }

  // ── Attach / Detach ────────────────────────────────────────────────────────

  /**
   * Mirror a `<video>` element into the store. The DOM element is the source of
   * truth throughout: every state field is written from an element event, so
   * mutating `video.volume` / `playbackRate` / `currentTime` from outside the
   * player keeps the UI in sync.
   */
  attach(video: HTMLVideoElement): void {
    this.detach();
    this.video = video;
    const s = () => this.store.getState();

    const syncBuffered = () => {
      if (video.buffered.length > 0 && video.duration) {
        s().setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      } else {
        s().setBuffered(0);
      }
    };

    const onTimeUpdate = () => {
      s().setCurrentTime(video.currentTime);
      this.syncLive(video);
      for (const percent of this.quartiles.update(video.currentTime, video.duration)) {
        this.emitter.emit('quartile', { percent });
      }
    };
    const onDurationChange = () => s().setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onProgress       = () => syncBuffered();
    const onWaiting = () => {
      s().setLoading(true);
      // A rebuffer starts here and is only measurable once playback resumes.
      if (this.stallStartedAt === 0) this.stallStartedAt = Date.now();
    };
    const onStalled = () => onWaiting();

    const onCanPlay = () => {
      s().setLoading(false);
      this.clearError();
    };
    const onPlaying = () => {
      s().setLoading(false);
      this.clearError();
      if (this.stallStartedAt > 0) {
        const durationMs = Date.now() - this.stallStartedAt;
        this.stallStartedAt = 0;
        this.stallCount += 1;
        this.stallTotalMs += durationMs;
        this.emitter.emit('stall', { count: this.stallCount, durationMs, totalMs: this.stallTotalMs });
      }
      if (!this.firstFrameReported && this.loadStartedAt > 0) {
        this.firstFrameReported = true;
        this.emitter.emit('ready', {
          startupMs: (this.metadataAt || Date.now()) - this.loadStartedAt,
          timeToFirstFrameMs: Date.now() - this.loadStartedAt,
        });
      }
    };

    const onLoadStart = () => {
      s().setLoading(true);
      this.loadStartedAt = Date.now();
      this.metadataAt = 0;
      this.firstFrameReported = false;
      this.stallCount = 0;
      this.stallTotalMs = 0;
      this.stallStartedAt = 0;
      this.quartiles.reset();
      this.emitter.emit('sourcechange', { src: video.currentSrc || video.src });
      // A retry re-runs load(); keep the error banner up until it actually recovers.
      if (!s().retrying) this.clearError();
    };

    const onEmptied = () => {
      const st = s();
      st.setCurrentTime(0);
      st.setDuration(0);
      st.setBuffered(0);
      st.setPlaying(false);
      if (!st.retrying) this.clearError();
    };

    const onLoadedMetadata = () => {
      const st = s();
      this.metadataAt = Date.now();
      st.setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      st.setVolume(video.volume);
      st.setMuted(video.muted);
      st.setSpeed(video.playbackRate);
      syncBuffered();
      this.syncLive(video);
      this.syncNativeAudioTracks();
      this.applyRestorePoint(video);
    };

    const onVolumeChange = () => {
      s().setVolume(video.volume);
      s().setMuted(video.muted);
      this.emitter.emit('volumechange', { volume: video.volume, muted: video.muted });
    };
    const onRateChange = () => {
      s().setSpeed(video.playbackRate);
      this.emitter.emit('ratechange', { rate: video.playbackRate });
    };

    const onSeeking = () => {
      s().setSeeking(true);
      if (video.readyState < 3) s().setLoading(true);
      this.emitter.emit('seeking', { from: this.seekFrom, to: video.currentTime });
    };
    const onSeeked = () => {
      s().setSeeking(false);
      s().setCurrentTime(video.currentTime);
      this.seekFrom = video.currentTime;
      if (video.readyState >= 3) s().setLoading(false);
      this.emitter.emit('seeked', { currentTime: video.currentTime });
    };

    const onPlay  = () => {
      s().setPlaying(true);
      this.scheduleHide(true);
      this.emitter.emit('play', { currentTime: video.currentTime });
    };
    const onPause = () => {
      s().setPlaying(false);
      this.forceShow();
      this.emitter.emit('pause', { currentTime: video.currentTime });
    };
    const onEnded = () => {
      s().setPlaying(false);
      this.forceShow();
      for (const percent of this.quartiles.finish()) this.emitter.emit('quartile', { percent });
      this.emitter.emit('complete', { duration: video.duration || 0 });
    };
    const onFSChange = () => this.syncFullscreenState();
    const onError    = () => this.handleError(video);

    /*
     * A `<source>` that fails fires `error` at itself, and the element is left
     * with `networkState === NETWORK_NO_SOURCE` and a null `error` — no `error`
     * event on the video at all. Without this, a 404 on the only source leaves
     * the player spinning forever, which is precisely what the error UI exists
     * to prevent. Source events do not bubble, so listen in the capture phase.
     */
    const onSourceError = (e: Event) => {
      if ((e.target as HTMLElement | null)?.tagName !== 'SOURCE') return;
      // Give the resource selection algorithm a tick to try the next source.
      setTimeout(() => {
        if (this.video !== video) return;
        if (video.error || video.networkState !== 3 /* NETWORK_NO_SOURCE */) return;
        // The element reports no `MediaError` here, but the situation is exactly
        // MEDIA_ERR_SRC_NOT_SUPPORTED: nothing in the source list can be played.
        this.handleError(video, describeMediaError({ code: 4 } as MediaError));
      }, 0);
    };
    video.addEventListener('error', onSourceError, true);
    const onAirPlayAvailability = (e: Event) => {
      const availability = (e as Event & { availability?: string }).availability;
      s().setAirPlayAvailable(availability === 'available');
    };
    const onAirPlayTarget = () => {
      s().setAirPlaying(!!(video as VendorVideo).webkitCurrentPlaybackTargetIsWireless);
    };
    const onEnterPip = () => s().setIsPip(true);
    const onLeavePip = () => s().setIsPip(false);
    const onPresentationModeChange = () => {
      const mode = (video as VendorVideo).webkitPresentationMode;
      s().setIsPip(mode === 'picture-in-picture');
      if (mode !== undefined) this.syncFullscreenState();
    };

    const bindings: [string, EventListener][] = [
      ['timeupdate',     onTimeUpdate],
      ['durationchange', onDurationChange],
      ['progress',       onProgress],
      ['waiting',        onWaiting],
      ['stalled',        onStalled],
      ['canplay',        onCanPlay],
      ['playing',        onPlaying],
      ['loadstart',      onLoadStart],
      ['emptied',        onEmptied],
      ['loadedmetadata', onLoadedMetadata],
      ['volumechange',   onVolumeChange],
      ['ratechange',     onRateChange],
      ['seeking',        onSeeking],
      ['seeked',         onSeeked],
      ['play',           onPlay],
      ['pause',          onPause],
      ['ended',          onEnded],
      ['error',          onError],
      ['enterpictureinpicture', onEnterPip],
      ['leavepictureinpicture', onLeavePip],
      ['webkitpresentationmodechanged', onPresentationModeChange],
      ['webkitbeginfullscreen', onFSChange],
      ['webkitendfullscreen',   onFSChange],
      ['webkitplaybacktargetavailabilitychanged', onAirPlayAvailability],
      ['webkitcurrentplaybacktargetiswirelesschanged', onAirPlayTarget],
      ['durationchange', () => this.syncLive(video)],
      ['progress',       () => this.syncLive(video)],
    ];
    for (const [type, handler] of bindings) video.addEventListener(type, handler);
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);

    // Safari exposes audio renditions on the element; the list can arrive after
    // metadata, so follow it rather than reading it once.
    const trackList = (video as VendorVideo).audioTracks;
    const onTrackListChange = () => this.syncNativeAudioTracks();
    trackList?.addEventListener?.('addtrack', onTrackListChange);
    trackList?.addEventListener?.('removetrack', onTrackListChange);
    trackList?.addEventListener?.('change', onTrackListChange);

    this.listeners = () => {
      video.removeEventListener('error', onSourceError, true);
      for (const [type, handler] of bindings) video.removeEventListener(type, handler);
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      trackList?.removeEventListener?.('addtrack', onTrackListChange);
      trackList?.removeEventListener?.('removetrack', onTrackListChange);
      trackList?.removeEventListener?.('change', onTrackListChange);
    };

    this.store.getState().setPipSupported(this.isPipSupported());
    // Ask Safari whether any AirPlay target exists; the answer arrives as an event.
    const vendor = video as VendorVideo;
    if (typeof vendor.webkitShowPlaybackTargetPicker === 'function') {
      this.store.getState().setAirPlaySupported(true);
    }

    // The element may already be past `loadedmetadata` when we attach (skin mode
    // adopts live elements) — seed from it rather than waiting for an event.
    if (video.readyState >= 1) onLoadedMetadata();
    if (video.error) this.handleError(video);
  }

  detach(): void {
    this.exitFakeFullscreen();
    this.releaseAdapter();
    this.listeners?.();
    this.listeners = null;
    this.video = null;
    this.restorePoint = null;
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.cancelAutoRetry();
  }

  // ── Errors & retry ─────────────────────────────────────────────────────────

  private handleError(video: HTMLVideoElement, override?: PlayerError): void {
    const err = override ?? describeMediaError(video.error);
    const s = this.store.getState();
    s.setLoading(false);
    s.setPlaying(false);
    s.setError(err);
    this.emitter.emit('error', err);

    // Network failures are the ones worth retrying on our own; a 404 or an
    // unsupported codec will not fix itself.
    if (err.code === 2 && this.retryAttempt < this.maxAutoRetries) {
      const delay = RETRY_BASE_MS * 2 ** this.retryAttempt;
      this.retryAttempt += 1;
      s.setRetrying(true);
      this.cancelAutoRetry();
      this.retryTimer = setTimeout(() => { this.retryTimer = null; this.reload(); }, delay);
    } else {
      s.setRetrying(false);
    }
  }

  private clearError(): void {
    const s = this.store.getState();
    this.retryAttempt = 0;
    this.cancelAutoRetry();
    if (s.error) s.setError(null);
    if (s.retrying) s.setRetrying(false);
  }

  private cancelAutoRetry(): void {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
  }

  /** Re-run `load()` on the current source, returning to where playback stopped. */
  private reload(): void {
    const v = this.video;
    if (!v) return;
    const s = this.store.getState();
    this.restorePoint = {
      time: s.currentTime,
      playing: s.playing || this.restorePoint?.playing || false,
      rate: v.playbackRate,
      muted: v.muted,
      volume: v.volume,
    };
    s.setLoading(true);

    // An adapter owns the media pipeline; `load()` would only reset the element
    // underneath it, so re-run the adapter's attach instead.
    const adapter = this.activeAdapter;
    const src = this.currentSrc;
    if (adapter && src) {
      this.currentSrc = null;
      this.activeAdapter = null;
      void this.loadSource(src);
      return;
    }
    v.load();
  }

  /** User-facing retry — resets the backoff counter and reloads immediately. */
  retry(): void {
    const s = this.store.getState();
    this.retryAttempt = 0;
    this.cancelAutoRetry();
    s.setRetrying(false);
    s.setError(null);
    this.reload();
  }

  // ── Source switching ───────────────────────────────────────────────────────

  /**
   * Snapshot position / playback state so the next `loadedmetadata` restores it.
   * Call this immediately before swapping the element's source — including when
   * the *consumer* swaps it (e.g. a `src` prop change driven by `onQualityChange`).
   */
  captureRestorePoint(): void {
    const v = this.video;
    if (!v) return;
    this.restorePoint = {
      time: v.currentTime,
      playing: !v.paused && !v.ended,
      rate: v.playbackRate,
      muted: v.muted,
      volume: v.volume,
    };
  }

  /**
   * Swap the media source in place: position, play state, rate, volume and mute
   * all survive the switch. Text-track selection is preserved by the element
   * itself (the `<track>` children are untouched).
   */
  switchSource(url: string, type?: string): void {
    const v = this.video;
    if (!v) return;
    this.captureRestorePoint();
    this.retryAttempt = 0;
    this.cancelAutoRetry();
    if (type) v.setAttribute('data-kui-source-type', type);
    v.src = url;
    this.store.getState().setLoading(true);
    v.load();
  }

  private applyRestorePoint(video: HTMLVideoElement): void {
    const r = this.restorePoint;
    if (!r) return;
    this.restorePoint = null;

    video.playbackRate = r.rate;
    video.volume = r.volume;
    video.muted = r.muted;

    if (r.time > 0) {
      const max = Number.isFinite(video.duration) ? video.duration : r.time;
      const target = Math.max(0, Math.min(max, r.time));
      if (Math.abs(video.currentTime - target) > 0.05) video.currentTime = target;
    }
    if (r.playing) void video.play().catch(() => { /* autoplay may be blocked */ });
  }

  // ── Media adapters (HLS / DASH) ────────────────────────────────────────────

  /**
   * Register a streaming adapter. Adapters are consulted in registration order;
   * the first one whose `canPlay()` accepts a source owns it. Returns an
   * unregister function.
   */
  use(adapter: MediaAdapter): () => void {
    if (!this.adapters.includes(adapter)) this.adapters.push(adapter);
    return () => {
      const i = this.adapters.indexOf(adapter);
      if (i >= 0) this.adapters.splice(i, 1);
      if (this.activeAdapter === adapter) this.releaseAdapter();
    };
  }

  /** Replace the whole adapter list, keeping the active adapter if it survives. */
  setAdapters(adapters: MediaAdapter[]): void {
    this.adapters = [...adapters];
    if (this.activeAdapter && !this.adapters.includes(this.activeAdapter)) this.releaseAdapter();
  }

  /**
   * Whether some adapter claims this source. Pure and DOM-free, so callers can
   * branch on it while rendering (React decides whether to emit `<source>`
   * children for the element or leave the source to the adapter).
   */
  hasAdapterFor(src: string): boolean {
    return this.adapters.some((a) => a.canPlay(src));
  }

  /** The adapter currently driving the element, if any. */
  get adapter(): MediaAdapter | null { return this.activeAdapter; }

  /**
   * Point the element at `src` through the matching adapter. Returns `false`
   * when no adapter claims it — the caller then falls back to plain `<source>`
   * / `src` handling, which is all a progressive MP4 needs.
   */
  async loadSource(src: string): Promise<boolean> {
    const v = this.video;
    if (!v) return false;

    const next = this.adapters.find((a) => a.canPlay(src)) ?? null;
    if (this.activeAdapter && this.activeAdapter !== next) this.releaseAdapter();
    if (!next) { this.currentSrc = null; return false; }
    if (this.activeAdapter === next && this.currentSrc === src) return true;

    this.activeAdapter = next;
    this.currentSrc = src;
    this.retryAttempt = 0;
    this.cancelAutoRetry();
    this.store.getState().setLoading(true);
    try {
      await next.attach(v, src, this.adapterHost);
    } catch {
      this.store.getState().setError({
        code: 4, name: 'ADAPTER_ATTACH_FAILED', recoverable: false,
        message: 'This stream could not be opened.',
      });
      this.store.getState().setLoading(false);
    }
    return true;
  }

  private releaseAdapter(): void {
    this.activeAdapter?.detach();
    this.activeAdapter = null;
    this.currentSrc = null;
    const s = this.store.getState();
    s.setAdaptiveQualities([]);
    s.setAdaptiveAudioTracks([]);
    s.setQualityAuto(false);
    s.setActiveQualityLabel(null);
  }

  /** The callbacks an attached adapter uses to push state back into the store. */
  private readonly adapterHost: MediaAdapterHost = {
    updateQualities: (qualities, activeIndex, auto) => {
      const s = this.store.getState();
      s.setAdaptiveQualities(qualities);
      s.setQualityAuto(auto);
      s.setActiveQualityLabel(qualities[activeIndex]?.label ?? null);
      s.setSelectedQuality(auto ? AUTO_QUALITY_VALUE : String(activeIndex));
    },
    updateAudioTracks: (tracks, activeIndex) => {
      const s = this.store.getState();
      s.setAdaptiveAudioTracks(tracks);
      if (activeIndex >= 0) s.setSelectedAudioTrack(activeIndex);
    },
    reportError: (error) => {
      const s = this.store.getState();
      s.setLoading(false);
      s.setError(error);
    },
  };

  // ── Quality & audio tracks ─────────────────────────────────────────────────

  /**
   * Choose a rendition by menu value — `'auto'` hands control back to ABR.
   * Only meaningful while an adapter is attached; otherwise it just records the
   * selection so a consumer-driven `qualities` list stays in sync.
   */
  selectQuality(value: string): void {
    const s = this.store.getState();
    s.setSelectedQuality(value);
    const adapter = this.activeAdapter;
    if (!adapter) return;
    const auto = value === AUTO_QUALITY_VALUE;
    const index = auto ? AUTO_QUALITY : Number.parseInt(value, 10);
    adapter.setQuality(Number.isFinite(index) ? index : AUTO_QUALITY);
    s.setQualityAuto(auto);
    if (!auto) s.setActiveQualityLabel(s.adaptiveQualities[index]?.label ?? null);
    this.emitter.emit('qualitychange', { value, auto });
  }

  /** Switch audio rendition — through the adapter, or the element's own list. */
  setAudioTrack(index: number): void {
    this.store.getState().setSelectedAudioTrack(index);
    this.emitter.emit('audiotrackchange', { index });

    if (this.activeAdapter?.setAudioTrack) { this.activeAdapter.setAudioTrack(index); return; }

    const list = (this.video as VendorVideo | null)?.audioTracks;
    if (!list) return;
    for (let i = 0; i < list.length; i += 1) {
      const track = list[i];
      if (track) track.enabled = i === index;
    }
  }

  /** Mirror the element's own audio renditions (Safari) into the store. */
  private syncNativeAudioTracks(): void {
    // Any attached adapter owns the media pipeline, and with it the audio
    // rendition list — whether it exposes `getAudioTracks` or only pushes
    // tracks through the host. Reading the element here would wipe them.
    if (this.activeAdapter) return;
    const list = (this.video as VendorVideo | null)?.audioTracks;
    const s = this.store.getState();
    if (!list || list.length < 2) {
      if (s.adaptiveAudioTracks.length > 0) s.setAdaptiveAudioTracks([]);
      return;
    }
    const tracks: AudioTrackOption[] = [];
    let active = 0;
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      if (!t) continue;
      tracks.push({
        label: t.label || t.language || `Track ${i + 1}`,
        ...(t.language ? { language: t.language } : {}),
      });
      if (t.enabled) active = tracks.length - 1;
    }
    s.setAdaptiveAudioTracks(tracks);
    s.setSelectedAudioTrack(active);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a playback event. Returns an unsubscribe function.
   *
   * This is a local API — the player sends nothing anywhere. Everything a QoE
   * pipeline needs (startup time, time to first frame, rebuffer count and
   * duration, quartiles) is measured here and handed to you.
   */
  on<K extends PlayerEventName>(event: K, handler: PlayerEventHandler<K>): () => void {
    return this.emitter.on(event, handler);
  }

  off<K extends PlayerEventName>(event: K, handler: PlayerEventHandler<K>): void {
    this.emitter.off(event, handler);
  }

  // ── Live and DVR ───────────────────────────────────────────────────────────

  /**
   * A stream is live when its duration is unbounded. The seekable range is the
   * DVR window: how far back the viewer may scrub, and where "live" is.
   */
  private syncLive(video: HTMLVideoElement): void {
    const s = this.store.getState();
    const live = video.duration === Infinity
      || (video.seekable.length > 0 && !Number.isFinite(video.duration));
    if (live !== s.isLive) s.setIsLive(live);
    if (!live) {
      if (s.dvrWindow !== 0) s.setDvrWindow(0, 0);
      if (s.atLiveEdge) s.setAtLiveEdge(false);
      return;
    }

    const ranges = video.seekable;
    if (ranges.length === 0) return;
    const start = ranges.start(0);
    const end = ranges.end(ranges.length - 1);
    if (start !== s.dvrStart || end - start !== s.dvrWindow) s.setDvrWindow(start, end - start);
    // Within ten seconds of the edge counts as live; below that a viewer is
    // watching the DVR window and the badge should say so.
    s.setAtLiveEdge(end - video.currentTime <= LIVE_EDGE_TOLERANCE_S);
  }

  /** Jump to the live edge of a stream. No-op for on-demand media. */
  seekToLive(): void {
    const v = this.video;
    if (!v || v.seekable.length === 0) return;
    v.currentTime = v.seekable.end(v.seekable.length - 1);
    if (v.paused) this.play();
  }

  // ── AirPlay ────────────────────────────────────────────────────────────────

  /**
   * Open Safari's AirPlay target picker. Availability is reported by the
   * element, so the button only appears once a target actually exists.
   */
  showAirPlayPicker(): void {
    const v = this.video as VendorVideo | null;
    try { v?.webkitShowPlaybackTargetPicker?.(); } catch { /* no target */ }
  }

  // ── Picture-in-Picture ─────────────────────────────────────────────────────

  private isPipSupported(): boolean {
    const v = this.video as VendorVideo | null;
    if (!v) return false;
    if (v.disablePictureInPicture) return false;
    if (document.pictureInPictureEnabled && typeof v.requestPictureInPicture === 'function') return true;
    return v.webkitSupportsPresentationMode?.('picture-in-picture') ?? false;
  }

  /** Enter or leave Picture-in-Picture. No-op where the browser has no PiP. */
  async togglePictureInPicture(): Promise<void> {
    const v = this.video as VendorVideo | null;
    if (!v || this.isCasting) return;
    const doc = document as VendorDocument;
    try {
      if (doc.pictureInPictureElement === v) { await doc.exitPictureInPicture?.(); return; }
      if (typeof v.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
        return;
      }
      if (v.webkitSetPresentationMode) {
        const inPip = v.webkitPresentationMode === 'picture-in-picture';
        v.webkitSetPresentationMode(inPip ? 'inline' : 'picture-in-picture');
      }
    } catch {
      // Denied (no user gesture, or PiP disabled by the page) — leave state alone.
    }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  play():  void { void this.video?.play().catch(() => { /* autoplay may be blocked */ }); }
  pause(): void { this.video?.pause(); }

  togglePlay(): void {
    if (this.isCasting && this.remoteController) { this.remoteController.playOrPause(); return; }
    if (!this.video) return;
    if (this.video.paused) this.play(); else this.video.pause();
  }

  seek(seconds: number): void {
    if (!this.video) return;
    this.video.currentTime = Math.max(0, Math.min(this.video.duration || 0, seconds));
  }

  seekBy(delta: number): void {
    if (this.isCasting && this.remotePlayer && this.remoteController) {
      const rp = this.remotePlayer;
      rp.currentTime = Math.max(0, Math.min(rp.duration || 0, rp.currentTime + delta));
      this.remoteController.seek();
      return;
    }
    if (this.video) this.seek(this.video.currentTime + delta);
  }

  /** Seek to a position defined as a 0–1 ratio of total duration. */
  seekByRatio(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    if (this.isCasting && this.remotePlayer && this.remoteController) {
      const rp = this.remotePlayer;
      if (!rp.duration) return;
      rp.currentTime = r * rp.duration;
      this.remoteController.seek();
      return;
    }
    const v = this.video;
    if (!v) return;
    const s = this.store.getState();
    if (s.isLive && s.dvrWindow > 0) {
      v.currentTime = s.dvrStart + r * s.dvrWindow;
      return;
    }
    if (v.duration) v.currentTime = r * v.duration;
  }

  setVolume(level: number): void {
    const c = Math.max(0, Math.min(1, level));
    if (this.isCasting && this.remotePlayer && this.remoteController) {
      this.remotePlayer.volumeLevel = c;
      this.remoteController.setVolumeLevel();
      this.store.getState().setVolume(c);
      this.store.getState().setMuted(c === 0);
      return;
    }
    if (!this.video) {
      this.store.getState().setVolume(c);
      this.store.getState().setMuted(c === 0);
      return;
    }
    // `volumechange` mirrors both fields back into the store.
    this.video.volume = c;
    this.video.muted = c === 0;
  }

  toggleMute(): void {
    if (this.isCasting && this.remoteController) { this.remoteController.muteOrUnmute(); return; }
    if (!this.video) {
      const s = this.store.getState();
      s.setMuted(!s.muted);
      return;
    }
    this.video.muted = !this.video.muted;
  }

  setSpeed(rate: number): void {
    if (!this.video) { this.store.getState().setSpeed(rate); return; }
    this.video.playbackRate = rate; // `ratechange` mirrors it into the store
  }

  // ── Fullscreen (with iOS fallbacks) ────────────────────────────────────────

  /** True for any of the four ways this player can be full-screen. */
  isFullscreenActive(): boolean {
    const doc = document as VendorDocument;
    const v = this.video as VendorVideo | null;
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement || this.fakeFsRestore || v?.webkitDisplayingFullscreen);
  }

  private syncFullscreenState(): void {
    const s = this.store.getState();
    s.setIsFullscreen(this.isFullscreenActive());
    s.setFakeFullscreen(this.fakeFsRestore !== null);
  }

  toggleFullscreen(container: HTMLElement): void {
    if (this.isFullscreenActive()) this.exitFullscreen(container);
    else this.enterFullscreen(container);
  }

  /**
   * Capability chain: standard element fullscreen → the `webkit` prefix →
   * (opt-in) the iOS native video player → an emulated fullscreen container.
   * iPhone Safari implements none of the element APIs, so without the last step
   * the only fullscreen it offers replaces our chrome with the OS player.
   */
  enterFullscreen(container: HTMLElement): void {
    const el = container as VendorElement;
    const v = this.video as VendorVideo | null;

    if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => this.enterFakeFullscreen(container));
      return;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      try { void el.webkitRequestFullscreen(); return; } catch { /* fall through */ }
    }
    if (this.preferNativeIosFullscreen && v?.webkitEnterFullscreen && v.webkitSupportsFullscreen) {
      try { v.webkitEnterFullscreen(); return; } catch { /* fall through */ }
    }
    this.enterFakeFullscreen(container);
  }

  exitFullscreen(container?: HTMLElement): void {
    const doc = document as VendorDocument;
    const v = this.video as VendorVideo | null;
    if (this.fakeFsRestore) { this.exitFakeFullscreen(); return; }
    if (doc.fullscreenElement) { void doc.exitFullscreen().catch(() => { /* already out */ }); return; }
    if (doc.webkitFullscreenElement) { void doc.webkitExitFullscreen?.(); return; }
    if (v?.webkitDisplayingFullscreen) { v.webkitExitFullscreen?.(); return; }
    void container;
  }

  /**
   * Emulated fullscreen: pin the player container over the viewport. Keeps our
   * controls, subtitles and settings panel — which the OS player would not.
   */
  private enterFakeFullscreen(container: HTMLElement): void {
    if (this.fakeFsRestore) return;
    const prevContainer = container.style.cssText;
    const prevBodyOverflow = document.body.style.overflow;

    container.style.cssText =
      `${prevContainer};position:fixed;inset:0;width:100vw;height:100vh;` +
      `max-width:none;max-height:none;border-radius:0;margin:0;background:#000;z-index:${FAKE_FS_Z};`;
    document.body.style.overflow = 'hidden';

    this.fakeFsRestore = () => {
      container.style.cssText = prevContainer;
      document.body.style.overflow = prevBodyOverflow;
    };
    this.syncFullscreenState();
  }

  private exitFakeFullscreen(): void {
    if (!this.fakeFsRestore) return;
    const restore = this.fakeFsRestore;
    this.fakeFsRestore = null;
    restore();
    this.syncFullscreenState();
  }

  // ── Controls Visibility ────────────────────────────────────────────────────

  get isCasting(): boolean { return this.store.getState().castState === 'connected'; }

  private get isControlled(): boolean { return this.controlsVisible !== undefined; }

  /** Computed controls visibility — mirrors what React reads from the store. */
  get effectiveControls(): boolean {
    if (this.isCasting) return true;
    if (this.isControlled) return this.controlsVisible as boolean;
    return this.store.getState().showControls;
  }

  scheduleHide(isPlaying: boolean): void {
    if (this.isControlled) return;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.store.getState().setShowControls(true);
    if (isPlaying && this.autoHideControls && !this.isCasting && !this.keyboardFocus) {
      this.hideTimer = setTimeout(() => this.store.getState().setShowControls(false), 3000);
    }
  }

  forceShow(): void {
    if (!this.isControlled) this.store.getState().setShowControls(true);
  }

  hideIfPlaying(): void {
    const s = this.store.getState();
    if (this.keyboardFocus) return;
    if (!this.isControlled && this.autoHideControls && s.playing) s.setShowControls(false);
  }

  resetHideTimer(): void { this.scheduleHide(this.store.getState().playing); }

  /**
   * Report whether the keyboard is inside the player. Entering pins the chrome
   * open; leaving hands it back to the auto-hide timer.
   */
  setKeyboardFocus(inside: boolean): void {
    this.keyboardFocus = inside;
    if (inside) this.forceShow();
    else this.resetHideTimer();
  }

  /** Reveal or dismiss the chrome — what a single tap does on touch devices. */
  toggleControls(): void {
    if (this.isControlled || this.keyboardFocus) return;
    const s = this.store.getState();
    if (s.showControls) {
      if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
      s.setShowControls(false);
    } else {
      this.scheduleHide(s.playing);
    }
  }

  updateProps(opts: Pick<VideoPlayerEngineOptions, 'controlsVisible' | 'autoHideControls'>): void {
    this.controlsVisible = opts.controlsVisible;
    this.autoHideControls = opts.autoHideControls ?? true;
    if (opts.controlsVisible !== undefined) {
      this.store.getState().setShowControls(opts.controlsVisible);
    }
  }

  // ── Cast helpers ───────────────────────────────────────────────────────────

  attachCast(player: RemotePlayer, controller: RemotePlayerController): void {
    this.remotePlayer = player;
    this.remoteController = controller;
  }

  detachCast(): void {
    this.remotePlayer = null;
    this.remoteController = null;
  }

  // ── Dispose ────────────────────────────────────────────────────────────────

  dispose(): void {
    this.detach();
    this.emitter.clear();
  }
}
