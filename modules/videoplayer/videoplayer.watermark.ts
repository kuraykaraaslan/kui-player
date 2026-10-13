/**
 * Visible watermark placement. A watermark pinned to a corner can be cropped
 * out of a screen recording, so it hops between slots on a timer. Pure and
 * seedable so the movement rule is testable without a clock or a DOM.
 */
export type WatermarkOptions = {
  /** What to print — typically a user id or e-mail. */
  text: string;
  /** 0–1 (default 0.25). Low enough to ignore, high enough to read in a leak. */
  opacity?: number;
  /** How often it moves, in ms (default 15000). `0` keeps it where it first lands. */
  intervalMs?: number;
  /** Pause playback if the mark is removed or hidden, and bring it back (default false). */
  pauseOnTamper?: boolean;
};

export type WatermarkSlot = { top: number; left: number };   // percent of the frame

/** 3×3 grid, inset from the edges so the text is never clipped by the frame. */
const SLOTS: readonly WatermarkSlot[] = [10, 50, 85].flatMap(
  (top) => [8, 40, 72].map((left) => ({ top, left })),
);

/** A slot different from `previous`; `random` is injectable for tests. */
export function nextWatermarkSlot(previous: WatermarkSlot | null, random: () => number = Math.random): WatermarkSlot {
  const pool = SLOTS.filter((s) => !previous || s.top !== previous.top || s.left !== previous.left);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
}

export function clampOpacity(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0.25;
  return Math.max(0.05, Math.min(1, value));   // a fully invisible mark is no mark
}

/** True when computed style says the mark is not actually visible. */
export function isHiddenStyle(style: Pick<CSSStyleDeclaration, 'display' | 'visibility' | 'opacity'>): boolean {
  return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.04;
}
