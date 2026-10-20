/**
 * When the floating mini player should be shown. Pure so the rule is testable
 * without an IntersectionObserver.
 */
export type MiniCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type MiniOptions = {
  /** Which corner it docks to (default `bottom-right`; mirrored in RTL by CSS logical properties). */
  corner?: MiniCorner;
  /** Allow it on touch devices (default `false`: a floating video fights the thumb and the keyboard). */
  touch?: boolean;
};

export type MiniInputs = {
  enabled: boolean;
  playing: boolean;
  /** The player's place in the page is on screen. */
  visible: boolean;
  /** The viewer closed the mini player and has not scrolled back yet. */
  dismissed: boolean;
  fullscreen: boolean;
  /** Skin mode wraps someone else's `<video>`; it is never floated. */
  skin: boolean;
};

export function shouldFloat(i: MiniInputs): boolean {
  return i.enabled && !i.skin && i.playing && !i.visible && !i.dismissed && !i.fullscreen;
}

export function miniEnabled(option: boolean | MiniOptions | undefined, touchDevice: boolean): boolean {
  if (!option) return false;
  if (!touchDevice) return true;
  return option !== true && option.touch === true;
}

/* ── repositioning (drag / keyboard) ────────────────────────────────────── */

export type Box = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Clamp a drag offset so the box (at `box`, before the offset) stays fully inside the viewport. */
export function clampOffset(box: Box, viewport: Size, dx: number, dy: number): { x: number; y: number } {
  const minX = -box.left;
  const maxX = Math.max(minX, viewport.width - box.left - box.width);
  const minY = -box.top;
  const maxY = Math.max(minY, viewport.height - box.top - box.height);
  return { x: Math.min(maxX, Math.max(minX, dx)) + 0, y: Math.min(maxY, Math.max(minY, dy)) + 0 };   // + 0 turns -0 into 0
}

/**
 * The logical corner nearest to a box. `right` / `left` are inline-end /
 * inline-start (what the CSS `data-kui-mini` values mean), so in RTL the
 * physical left half of the screen is `right`.
 */
export function nearestCorner(box: Box, viewport: Size, rtl: boolean): MiniCorner {
  const physLeft = box.left + box.width / 2 < viewport.width / 2;
  const top = box.top + box.height / 2 < viewport.height / 2;
  return `${top ? 'top' : 'bottom'}-${physLeft === rtl ? 'right' : 'left'}`;
}

/** Arrow key to the neighbouring corner in that physical direction (unchanged at the edge). */
export function stepCorner(corner: MiniCorner, key: string, rtl: boolean): MiniCorner {
  const [v, h] = corner.split('-') as ['top' | 'bottom', 'left' | 'right'];
  let physLeft = (h === 'left') !== rtl;
  let top = v === 'top';
  if (key === 'ArrowLeft') physLeft = true;
  else if (key === 'ArrowRight') physLeft = false;
  else if (key === 'ArrowUp') top = true;
  else if (key === 'ArrowDown') top = false;
  return `${top ? 'top' : 'bottom'}-${physLeft === rtl ? 'right' : 'left'}`;
}
