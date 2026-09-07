import { useInsertionEffect } from 'react';
import css from './player.css?raw';

/** The player's complete stylesheet, for inlining it yourself. */
export const PLAYER_CSS = css;

const MARKER = 'data-kui-player-styles';
const seen = new WeakSet<Document | ShadowRoot>();

/**
 * Put the player stylesheet into `root` exactly once. Idempotent across
 * multiple players, re-mounts and duplicate copies of the library, and a no-op
 * where the host already linked `styles.css` (which carries the same marker).
 */
export function injectPlayerStyles(root: Document | ShadowRoot = document): void {
  if (typeof document === 'undefined' || seen.has(root)) return;
  seen.add(root);
  const container = root instanceof Document ? root.head : root;
  if (!container || (root as Document | ShadowRoot).querySelector(`[${MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(MARKER, '');
  style.textContent = css;
  container.prepend(style);
}

/**
 * Inject on first render, before the browser paints. Set `enabled` to `false`
 * when the app links `@kuraykaraaslan/kui-player/styles.css` itself — under a
 * strict CSP, or to keep styles out of the document head.
 */
export function usePlayerStyles(enabled = true): void {
  useInsertionEffect(() => {
    if (enabled) injectPlayerStyles();
  }, [enabled]);
}
