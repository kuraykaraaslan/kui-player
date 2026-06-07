import { createVideoPlayerStore, type VideoPlayerStoreApi } from './videoplayer.store';
import type { RemotePlayer, RemotePlayerController } from './videoplayer.types';

export type VideoPlayerEngineOptions = {
  defaultQuality?: string;
  startMuted?: boolean;
  autoHideControls?: boolean;
  controlsVisible?: boolean;
};

export class VideoPlayerEngine {
  readonly store: VideoPlayerStoreApi;

  private video: HTMLVideoElement | null = null;
  private listeners: (() => void) | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  autoHideControls: boolean;
  controlsVisible: boolean | undefined;

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
  }

  // ── Attach / Detach ────────────────────────────────────────────────────────

  attach(video: HTMLVideoElement): void {
    this.detach();
    this.video = video;
    const s = this.store.getState();

    const onTimeUpdate    = () => s.setCurrentTime(video.currentTime);
    const onDurationChange= () => s.setDuration(video.duration || 0);
    const onProgress      = () => {
      if (video.buffered.length > 0 && video.duration) {
        s.setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const onWaiting  = () => s.setLoading(true);
    const onCanPlay  = () => s.setLoading(false);
    const onPlay     = () => { s.setPlaying(true);  this.scheduleHide(true); };
    const onPause    = () => { s.setPlaying(false); this.forceShow(); };
    const onEnded    = () => { s.setPlaying(false); this.forceShow(); };
    const onFSChange = () => s.setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener('timeupdate',      onTimeUpdate);
    video.addEventListener('durationchange',  onDurationChange);
    video.addEventListener('progress',        onProgress);
    video.addEventListener('waiting',         onWaiting);
    video.addEventListener('canplay',         onCanPlay);
    video.addEventListener('play',            onPlay);
    video.addEventListener('pause',           onPause);
    video.addEventListener('ended',           onEnded);
    document.addEventListener('fullscreenchange', onFSChange);

    this.listeners = () => {
      video.removeEventListener('timeupdate',     onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('progress',       onProgress);
      video.removeEventListener('waiting',        onWaiting);
      video.removeEventListener('canplay',        onCanPlay);
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('ended',          onEnded);
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }

  detach(): void {
    this.listeners?.();
    this.listeners = null;
    this.video = null;
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  play():  void { void this.video?.play(); }
  pause(): void { this.video?.pause(); }

  togglePlay(): void {
    if (this.isCasting && this.remoteController) { this.remoteController.playOrPause(); return; }
    if (!this.video) return;
    if (this.video.paused) void this.video.play(); else this.video.pause();
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
    if (!this.video) return;
    this.video.volume = c;
    this.video.muted = c === 0;
    this.store.getState().setVolume(c);
    this.store.getState().setMuted(c === 0);
  }

  toggleMute(): void {
    if (this.isCasting && this.remoteController) { this.remoteController.muteOrUnmute(); return; }
    if (!this.video) return;
    this.video.muted = !this.video.muted;
    this.store.getState().setMuted(this.video.muted);
  }

  setSpeed(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
    this.store.getState().setSpeed(rate);
  }

  toggleFullscreen(container: HTMLElement): void {
    if (!document.fullscreenElement) void container.requestFullscreen();
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
