/**
 * A-B loop bookkeeping. Pure: the playhead and the markers go in, the next
 * action comes out, so loop counting can be tested without a video.
 */
export type LoopRange = { a: number; b: number | null };

/** How many times to play the range; `0` means forever. */
export type LoopRepeat = number;

/** `a` marks A, then B, then clears — one key, three presses. */
export function markLoop(range: LoopRange | null, time: number): LoopRange | null {
  if (!range) return { a: time, b: null };
  if (range.b === null) {
    // B before A is the same range read the other way round.
    return time > range.a ? { a: range.a, b: time } : { a: time, b: range.a };
  }
  return null;
}

export type LoopStep = { seekTo: number } | { finished: true } | null;

/**
 * Called as the playhead moves. At B it goes back to A; once the requested
 * number of passes is done it lets playback run past B instead.
 */
export function stepLoop(
  range: LoopRange | null, time: number, passes: number, repeat: LoopRepeat,
): LoopStep {
  if (!range || range.b === null) return null;
  if (time < range.b) return null;
  // Far beyond B (the viewer seeked past it) is not a pass to loop back from.
  if (time > range.b + 1) return null;
  if (repeat > 0 && passes + 1 >= repeat) return { finished: true };
  return { seekTo: range.a };
}

export const rangeKey = (range: LoopRange): string => `${range.a.toFixed(2)}-${(range.b ?? 0).toFixed(2)}`;

/** Remembers the playback speed chosen for each range. */
export class RangeSpeeds {
  private speeds = new Map<string, number>();
  get(range: LoopRange): number | undefined { return this.speeds.get(rangeKey(range)); }
  set(range: LoopRange, speed: number): void { this.speeds.set(rangeKey(range), speed); }
  clear(): void { this.speeds.clear(); }
}
