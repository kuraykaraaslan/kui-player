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
