import { mountSkin, SKINNED_ATTR, type SkinOptions } from './mountSkin.js';

export interface SkinAllOptions extends SkinOptions {
  /**
   * Keep skinning videos that appear later. Single-page apps mount their
   * players after the script runs, so this is on by default.
   */
  observe?: boolean;
  /** Where to look. Defaults to the whole document. */
  root?: ParentNode;
  /**
   * Called for each element before it is skinned; return `false` to skip it.
   * Useful for leaving one player alone, or for waiting on a src.
   */
  filter?: (video: HTMLVideoElement) => boolean;
}

/** Everything `skinAll` is currently driving. */
export interface SkinAllHandle {
  /** Skin anything matching that has appeared since the last pass. */
  refresh(): void;
  /** How many elements are currently skinned. */
  readonly count: number;
  /** Unskin everything and stop observing. */
  stop(): void;
}

/**
 * Dress every `<video>` on the page — the "bring your own video" entry point.
 *
 * The site's media pipeline is untouched: progressive, hls.js, MSE and blob
 * sources all keep working, because only the controls are replaced. Elements
 * already skinned are skipped, so calling this twice is harmless.
 *
 * ```js
 * const skins = kuiPlayer.skinAll('video', { accent: '#f97316' });
 * // …later
 * skins.stop();
 * ```
 */
export function skinAll(selector = 'video', opts: SkinAllOptions = {}): SkinAllHandle {
  const root = opts.root ?? document;
  const mounted = new Map<HTMLVideoElement, () => void>();
  let stopped = false;

  function skin(video: HTMLVideoElement): void {
    if (stopped || mounted.has(video) || video.hasAttribute(SKINNED_ATTR)) return;
    if (opts.filter && !opts.filter(video)) return;
    mounted.set(video, mountSkin(video, opts));
  }

  function refresh(): void {
    if (stopped) return;
    root.querySelectorAll<HTMLVideoElement>(selector).forEach(skin);
    // Drop anything that has since left the document.
    for (const [video, unmount] of mounted) {
      if (!video.isConnected) { unmount(); mounted.delete(video); }
    }
  }

  refresh();

  let observer: MutationObserver | null = null;
  if ((opts.observe ?? true) && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.addedNodes.length > 0 || record.removedNodes.length > 0) { refresh(); return; }
      }
    });
    observer.observe(root instanceof Document ? root.documentElement : (root as Node), {
      childList: true,
      subtree: true,
    });
  }

  return {
    refresh,
    get count() { return mounted.size; },
    stop() {
      if (stopped) return;
      stopped = true;
      observer?.disconnect();
      observer = null;
      for (const [, unmount] of mounted) unmount();
      mounted.clear();
    },
  };
}
