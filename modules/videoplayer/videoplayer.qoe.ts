/**
 * Quality-of-experience accounting for one source. Pure bookkeeping with the
 * clock passed in, so stall/bitrate maths is testable with a fake timeline.
 * Nothing here sends anything anywhere: the engine only emits the numbers.
 */
export type Rendition = { bitrate?: number; width?: number; height?: number; codec?: string };

export type QoeSummary = {
  /** Time spent actually playing, ms. */
  playingMs: number;
  stallCount: number;
  stallMs: number;
  /** stallMs / (playingMs + stallMs), 0–1. */
  stallRatio: number;
  /** Rendition changes after the first one. */
  switches: number;
  rendition: Rendition | null;
  /** Mean bitrate over playing time, bits/s (renditions without a bitrate are skipped). */
  avgBitrate: number | null;
  droppedFrames: number | null;
  totalFrames: number | null;
  /** Throughput estimate from the streaming engine, bits/s. */
  bandwidthBps: number | null;
};

export type FrameCounts = { dropped: number; total: number };

export class QoeTracker {
  private playing = false;
  private lastTick = 0;
  private playingMs = 0;
  private stallCount = 0;
  private stallMs = 0;
  private stallStartedAt = 0;
  private switches = 0;
  private rendition: Rendition | null = null;
  private bitrateWeighted = 0;
  private bitrateMs = 0;

  reset(): void {
    this.playing = false;
    this.lastTick = 0;
    this.playingMs = 0;
    this.stallCount = 0;
    this.stallMs = 0;
    this.stallStartedAt = 0;
    this.switches = 0;
    this.rendition = null;
    this.bitrateWeighted = 0;
    this.bitrateMs = 0;
  }

  /** Fold elapsed playing time into the totals up to `now`. */
  private advance(now: number): void {
    if (this.playing && this.stallStartedAt === 0 && now > this.lastTick) {
      const dt = now - this.lastTick;
      this.playingMs += dt;
      if (this.rendition?.bitrate) {
        this.bitrateWeighted += this.rendition.bitrate * dt;
        this.bitrateMs += dt;
      }
    }
    this.lastTick = now;
  }

  setPlaying(playing: boolean, now: number): void {
    this.advance(now);
    this.playing = playing;
  }

  /** A rebuffer began. Returns the 1-based stall number. */
  stallStart(now: number): number {
    if (this.stallStartedAt !== 0) return this.stallCount + 1;
    this.advance(now);
    this.stallStartedAt = now;
    return this.stallCount + 1;
  }

  stallEnd(now: number): number {
    if (this.stallStartedAt === 0) return 0;
    const duration = now - this.stallStartedAt;
    this.stallStartedAt = 0;
    this.stallCount += 1;
    this.stallMs += duration;
    this.lastTick = now;
    return duration;
  }

  setRendition(next: Rendition | null, now: number): void {
    this.advance(now);
    const prev = this.rendition;
    if (next && prev && (prev.bitrate !== next.bitrate || prev.height !== next.height)) this.switches += 1;
    this.rendition = next;
  }

  snapshot(now: number, frames?: FrameCounts | null, bandwidthBps?: number | null): QoeSummary {
    this.advance(now);
    // An open stall counts towards the totals the moment it is observed.
    const openStall = this.stallStartedAt > 0 ? now - this.stallStartedAt : 0;
    const stallMs = this.stallMs + openStall;
    const denominator = this.playingMs + stallMs;
    return {
      playingMs: this.playingMs,
      stallCount: this.stallCount + (openStall > 0 ? 1 : 0),
      stallMs,
      stallRatio: denominator > 0 ? stallMs / denominator : 0,
      switches: this.switches,
      rendition: this.rendition,
      avgBitrate: this.bitrateMs > 0 ? Math.round(this.bitrateWeighted / this.bitrateMs) : null,
      droppedFrames: frames?.dropped ?? null,
      totalFrames: frames?.total ?? null,
      bandwidthBps: bandwidthBps ?? null,
    };
  }
}
