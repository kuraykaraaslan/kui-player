/**
 * The kui-player brand mark, as raw geometry.
 *
 * The mark is a "K" whose stem forks into two arms at 45 degrees — the house
 * construction, shared with every @kuraykaraaslan/kui-* package and written
 * down in the Brand_Positioning_Rules/logo-system.md ruleset. Nothing in the
 * SHARED block below may differ between packages; only `TONE_TWO` does.
 *
 * This module is the single source of truth. `build.mjs` is its only
 * consumer, so it stays dependency-free and framework-free on purpose: the
 * committed SVGs are generated, never hand-edited.
 *
 *   node brand/build.mjs
 */

/** ---- Shared across the family. Do not diverge. ---------------------- */

export const VIEW_BOX = "0 0 64 64";
/** Stem: a rect, because a 32-long stroke would round its own ends. */
export const STEM = { x: 16, y: 16, width: 7, height: 32, radius: 1.5 };
/** The fork, and the two arm tips. dx === dy === 16, i.e. exactly 45deg. */
export const FORK = { x: 25, y: 32 };
export const ARMS = [
  { x: 41, y: 16 },
  { x: 41, y: 48 },
];
/** ~10.9% of the grid — the family's optical weight. */
export const STROKE_WIDTH = 7;
/** ~22% of the tile edge. */
export const TILE_RADIUS = 14;

/** ---- Palette. The first tone is the family's; the second is ours. --- */

export const COLORS = {
  /** `--primary` at blue-500. The UI ships blue-600; a mark is a graphic,
   *  not a button label, so it keeps the brighter step. */
  toneOne: "#3b82f6",
  /** Dark-surface variant of the same. */
  toneOneInverse: "#60a5fa",
  /** PLAYED PROGRESS — played progress — the part of the timeline already watched. */
  toneTwo: "#22c55e",
  /** Family dark ground / light foreground. */
  tile: "#0f172a",
  tileInverse: "#020617",
  foreground: "#111827",
  foregroundInverse: "#f1f5f9",
  foregroundMutedInverse: "#cbd5e1",
  grid: "#1e293b",
};

/** ---- Wordmark ------------------------------------------------------- */

export const WORDMARK = { lead: "kui", trail: " player" };
/** Mean advance per character at 26px SemiBold, in user units, MEASURED
 *  against the system fallback stack rather than against Geist.
 *
 *  The lockup's width is derived from this and the label length rather than
 *  fixed, because a hard-coded box sized for "viewer" clips "calendar" — and
 *  an overflowing wordmark is invisible until someone opens the file on a
 *  machine without the font. Sizing for the fallback is the conservative
 *  direction: the library NAMES Geist and never loads it, so the wide font is
 *  the one a stranger actually renders. With Geist present the lockup simply
 *  carries a little extra clear space on the right, which is harmless; the
 *  other way round the last letters are gone. */
export const WORDMARK_ADVANCE = 19.5;
/** Text starts at 96 = mark (64) + clear space (half the mark's height). */
export const WORDMARK_X = 96;
export const TAGLINE = "A standalone video player for the web";
export const FONT_STACK =
  "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
