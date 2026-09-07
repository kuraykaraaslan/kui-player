import { createVideoPlayerStore, type VideoPlayerStoreApi } from './videoplayer.store';
import type { PlayerError, RemotePlayer, RemotePlayerController } from './videoplayer.types';

export type VideoPlayerEngineOptions = {
  defaultQuality?: string;
  startMuted?: boolean;
  autoHideControls?: boolean;
  controlsVisible?: boolean;
  /** Automatic retries after a *network* error before giving up (default 3, `0` disables). */
  maxAutoRetries?: number;
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

  autoHideControls: boolean;
  controlsVisible: boolean | undefined;
  readonly maxAutoRetries: number;

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

    const onTimeUpdate     = () => s().setCurrentTime(video.currentTime);
    const onDurationChange = () => s().setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onProgress       = () => syncBuffered();
    const onWaiting        = () => s().setLoading(true);
    const onStalled        = () => s().setLoading(true);

    const onCanPlay = () => {
      s().setLoading(false);
      this.clearError();
    };
    const onPlaying = () => {
      s().setLoading(false);
      this.clearError();
    };

    const onLoadStart = () => {
      s().setLoading(true);
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
      st.setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      st.setVolume(video.volume);
      st.setMuted(video.muted);
      st.setSpeed(video.playbackRate);
      syncBuffered();
      this.applyRestorePoint(video);
    };

    const onVolumeChange = () => { s().setVolume(video.volume); s().setMuted(video.muted); };
    const onRateChange   = () => s().setSpeed(video.playbackRate);

    const onSeeking = () => {
      s().setSeeking(true);
      if (video.readyState < 3) s().setLoading(true);
    };
    const onSeeked = () => {
      s().setSeeking(false);
      s().setCurrentTime(video.currentTime);
      if (video.readyState >= 3) s().setLoading(false);
    };

    const onPlay     = () => { s().setPlaying(true);  this.scheduleHide(true); };
    const onPause    = () => { s().setPlaying(false); this.forceShow(); };
    const onEnded    = () => { s().setPlaying(false); this.forceShow(); };
    const onFSChange = () => s().setIsFullscreen(!!document.fullscreenElement);
    const onError    = () => this.handleError(video);

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
    ];
    for (const [type, handler] of bindings) video.addEventListener(type, handler);
    document.addEventListener('fullscreenchange', onFSChange);

    this.listeners = () => {
      for (const [type, handler] of bindings) video.removeEventListener(type, handler);
      document.removeEventListener('fullscreenchange', onFSChange);
    };

    // The element may already be past `loadedmetadata` when we attach (skin mode
    // adopts live elements) — seed from it rather than waiting for an event.
    if (video.readyState >= 1) onLoadedMetadata();
    if (video.error) this.handleError(video);
  }

  detach(): void {
    this.listeners?.();
    this.listeners = null;
    this.video = null;
    this.restorePoint = null;
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.cancelAutoRetry();
  }

  // ── Errors & retry ─────────────────────────────────────────────────────────

  private handleError(video: HTMLVideoElement): void {
    const err = describeMediaError(video.error);
    const s = this.store.getState();
    s.setLoading(false);
    s.setPlaying(false);
    s.setError(err);

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
    if (this.video?.duration) this.video.currentTime = r * this.video.duration;
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

  toggleFullscreen(container: HTMLElement): void {
    if (!document.fullscreenElement) void container.requestFullscreen().catch(() => { /* denied */ });
    else void document.exitFullscreen();
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
    if (isPlaying && this.autoHideControls && !this.isCasting) {
      this.hideTimer = setTimeout(() => this.store.getState().setShowControls(false), 3000);
    }
  }

  forceShow(): void {
    if (!this.isControlled) this.store.getState().setShowControls(true);
  }

  hideIfPlaying(): void {
    const s = this.store.getState();
    if (!this.isControlled && this.autoHideControls && s.playing) s.setShowControls(false);
  }

  resetHideTimer(): void { this.scheduleHide(this.store.getState().playing); }

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

  dispose(): void { this.detach(); }
}
