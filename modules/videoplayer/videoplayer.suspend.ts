import type { MediaAdapter } from './adapters/adapter.types.js';

/**
 * Why loading is stopped: the player cannot be seen (`hidden`), or its viewer
 * did not answer the presence check (`presence`).
 */
export type SuspendReason = 'hidden' | 'presence';

export type SuspendHost = {
  video(): HTMLVideoElement | null;
  adapter(): MediaAdapter | null;
  play(): void;
  /** Called once when loading stops and once when it starts again. */
  changed(event: 'suspend' | 'resume', reason: SuspendReason): void;
};

/**
 * Stops a player from loading media, and starts it again.
 *
 * Several reasons can hold a player stopped at once; loading resumes only when
 * the last one is gone, so a tab coming back to the foreground does not undo a
 * "paused to save data". Stopping pauses the element and tells the adapter to
 * stop requesting (a plain element has no adapter, so it is only paused).
 */
export class LoadSuspender {
  private readonly reasons = new Set<SuspendReason>();
  private resumePlaying = false;

  constructor(private readonly host: SuspendHost) {}

  has(reason: SuspendReason): boolean { return this.reasons.has(reason); }
  get active(): boolean { return this.reasons.size > 0; }

  suspend(reason: SuspendReason): void {
    const video = this.host.video();
    if (!video || this.reasons.has(reason)) return;
    const first = this.reasons.size === 0;
    this.reasons.add(reason);
    if (first) {
      this.resumePlaying = !video.paused && !video.ended;
      video.pause();
      this.host.adapter()?.suspend?.();
    }
    this.host.changed('suspend', reason);
  }

  /** `play` starts playback even if it was not running when loading stopped. */
  resume(reason: SuspendReason, play = false): void {
    if (!this.reasons.delete(reason)) return;
    if (this.reasons.size === 0) {
      this.host.adapter()?.resume?.();
      if (play || this.resumePlaying) this.host.play();
      this.resumePlaying = false;
    }
    this.host.changed('resume', reason);
  }

  reset(): void {
    this.reasons.clear();
    this.resumePlaying = false;
  }
}
