import type { PlayerError } from './videoplayer.types.js';

/**
 * Everything the player reports about a playback session. This is a local API:
 * nothing here is sent anywhere. Wire it to your own QoE pipeline if you have
 * one, or ignore it — the player itself never phones home.
 */
export type PlayerEventMap = {
  play: { currentTime: number };
  pause: { currentTime: number };
  seeking: { from: number; to: number };
  seeked: { currentTime: number };
  ratechange: { rate: number };
  volumechange: { volume: number; muted: boolean };
  qualitychange: { value: string; auto: boolean };
  audiotrackchange: { index: number };
  error: PlayerError;
  /** A rebuffer ended. `count` is how many have happened for this source. */
  stall: { count: number; durationMs: number; totalMs: number };
  /** Fired once each per source, at 25/50/75/100% watched. */
  quartile: { percent: 25 | 50 | 75 | 100 };
  complete: { duration: number };
  /**
   * Playback actually started. `startupMs` is from the load starting to
   * metadata; `timeToFirstFrameMs` is from the load starting to the first frame
   * a viewer could see — the number that decides whether a player feels fast.
   */
  ready: { startupMs: number; timeToFirstFrameMs: number };
  sourcechange: { src: string };
};

export type PlayerEventName = keyof PlayerEventMap;
export type PlayerEventHandler<K extends PlayerEventName> = (payload: PlayerEventMap[K]) => void;

/** A minimal typed emitter — no dependency, no wildcard, no async surprises. */
export class PlayerEmitter {
  private handlers = new Map<PlayerEventName, Set<(payload: never) => void>>();

  on<K extends PlayerEventName>(event: K, handler: PlayerEventHandler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) { set = new Set(); this.handlers.set(event, set); }
    set.add(handler as (payload: never) => void);
    return () => this.off(event, handler);
  }

  off<K extends PlayerEventName>(event: K, handler: PlayerEventHandler<K>): void {
    this.handlers.get(event)?.delete(handler as (payload: never) => void);
  }

  emit<K extends PlayerEventName>(event: K, payload: PlayerEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy first: a handler is allowed to unsubscribe itself.
    for (const handler of Array.from(set)) {
      try {
        (handler as PlayerEventHandler<K>)(payload);
      } catch {
        // A broken listener must not break playback.
      }
    }
  }

  clear(): void { this.handlers.clear(); }
}

/** Quartile bookkeeping for one source. */
export class QuartileTracker {
  private fired = new Set<number>();

  reset(): void { this.fired.clear(); }

  /** Returns the quartiles crossed since the last call, in order. */
  update(currentTime: number, duration: number): (25 | 50 | 75 | 100)[] {
    if (!duration || !Number.isFinite(duration)) return [];
    const percent = (currentTime / duration) * 100;
    const crossed: (25 | 50 | 75 | 100)[] = [];
    for (const mark of [25, 50, 75, 100] as const) {
      // 100% is only ever reported by `ended`, so stop just short of it here.
      const threshold = mark === 100 ? 99.5 : mark;
      if (percent >= threshold && !this.fired.has(mark)) { this.fired.add(mark); crossed.push(mark); }
    }
    return crossed;
  }

  /** Mark everything as reported — used when playback ends. */
  finish(): (25 | 50 | 75 | 100)[] {
    const crossed: (25 | 50 | 75 | 100)[] = [];
    for (const mark of [25, 50, 75, 100] as const) {
      if (!this.fired.has(mark)) { this.fired.add(mark); crossed.push(mark); }
    }
    return crossed;
  }
}
