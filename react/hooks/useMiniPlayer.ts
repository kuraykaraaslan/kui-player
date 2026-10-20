import { useCallback, useEffect, useState } from 'react';
import { shouldFloat } from '../../modules/videoplayer/videoplayer.mini.js';

type Options = {
  enabled: boolean;
  skin: boolean;
  playing: boolean;
  fullscreen: boolean;
};

/** Below this share of the player on screen, it counts as scrolled away. */
const VISIBLE_RATIO = 0.05;

/**
 * Tracks whether the player's spot in the page is on screen and says when to
 * float it. While floating, the player's own box is fixed to a corner, so a
 * same-sized placeholder holds its place and is what gets observed — the
 * `<video>` itself is never moved in the DOM, which would stop playback.
 *
 * Both elements arrive through callback refs and live in state, so the hook
 * never touches a `ref.current` during render.
 */
export function useMiniPlayer({ enabled, skin, playing, fullscreen }: Options) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [placeholder, setPlaceholder] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [height, setHeight] = useState(0);
  const floating = shouldFloat({ enabled, skin, playing, visible, dismissed, fullscreen });

  useEffect(() => {
    if (!enabled || skin || typeof IntersectionObserver === 'undefined') return;
    const target = floating ? placeholder : container;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const nowVisible = entry.intersectionRatio > VISIBLE_RATIO;
      // Measure while the player still has its real size, just before it floats.
      if (!nowVisible && !floating && container) setHeight(container.offsetHeight);
      setVisible(nowVisible);
      if (nowVisible) setDismissed(false);
    }, { threshold: [0, VISIBLE_RATIO, 0.25, 1] });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, skin, floating, container, placeholder]);

  const dismiss = useCallback(() => setDismissed(true), []);
  const giveBack = useCallback(() => {
    placeholder?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    container?.focus({ preventScroll: true });
  }, [placeholder, container]);

  return { floating, container, setContainer, setPlaceholder, placeholderHeight: height, dismiss, giveBack };
}
