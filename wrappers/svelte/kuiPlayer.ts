import { mountSkin, type SkinOptions } from '../../embed/mountSkin.js';

/**
 * A Svelte action: `<video use:kuiPlayer={{ accent: '#f97316' }} src="…" />`.
 *
 * Svelte 5 has no need for a component wrapper here — an action is the idiomatic
 * way to attach behaviour to an element the template already owns, which is
 * exactly what skin mode does.
 */
export function kuiPlayer(node: HTMLVideoElement, options: SkinOptions = {}) {
  let unmount = mountSkin(node, options);

  return {
    update(next: SkinOptions) {
      // Options are read at mount time; remounting is cheap and predictable.
      unmount();
      unmount = mountSkin(node, next);
    },
    destroy() {
      unmount();
    },
  };
}

export default kuiPlayer;
