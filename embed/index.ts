import { mountSkin, type SkinOptions } from './mountSkin.js';
import { skinAll, type SkinAllHandle, type SkinAllOptions } from './skinAll.js';
import { defineKuiPlayer } from './webComponent.js';
import {
  createPagePresenceGroup, getPagePresence, setPagePresence,
  type PagePresenceOptions,
} from './pagePresence.js';
import { isOff, parseFlag, parseLive, parsePresence } from './attributes.js';
import type { PresenceGroup } from '../modules/videoplayer/videoplayer.presence.js';

// Injected by Vite `define` at build time (see vite.config.embed.ts).
declare const __KUI_EMBED_VERSION__: string;

export interface KuiPlayerApi {
  readonly version: string;
  /** Dress one element. */
  mount(video: HTMLVideoElement, opts?: SkinOptions): void;
  /** Dress everything matching a selector, and keep watching for more. */
  skinAll(selector?: string, opts?: SkinAllOptions): SkinAllHandle;
  unmount(video: HTMLVideoElement): void;
  unmountAll(): void;
  isMounted(video: HTMLVideoElement): boolean;
  /** Register `<kui-player>` as a custom element. */
  define(tagName?: string): void;
  /**
   * Make a "Still watching?" group the page's default: every player skinned after
   * this joins it (one timer, one prompt) unless it opts out. Pass options to have
   * the group and its prompt made, a group of your own, or `null` to remove it.
   */
  setPagePresence(input: PagePresenceOptions | PresenceGroup | null): PresenceGroup | null;
  /** The page's default group, or `null`. */
  getPagePresence(): PresenceGroup | null;
  /** A group with its page-level prompt (`prompt: false` to leave the prompt out). Not made the default. */
  createPagePresenceGroup(options: PagePresenceOptions): PresenceGroup;
}

declare global {
  interface Window {
    kuiPlayer?: KuiPlayerApi;
    /** @deprecated Renamed to `kuiPlayer`; kept so existing embeds keep working. */
    __tepegozVideoPlayer?: KuiPlayerApi;
  }
}

const mounted = new WeakMap<HTMLVideoElement, () => void>();
const active = new Set<HTMLVideoElement>();

const api: KuiPlayerApi = {
  version: typeof __KUI_EMBED_VERSION__ === 'string' ? __KUI_EMBED_VERSION__ : '0.0.0',
  mount(video, opts) {
    if (mounted.has(video)) return;
    const unmount = mountSkin(video, opts);
    mounted.set(video, unmount);
    active.add(video);
  },
  skinAll(selector, opts) {
    return skinAll(selector, opts);
  },
  unmount(video) {
    const unmount = mounted.get(video);
    if (!unmount) return;
    unmount();
    mounted.delete(video);
    active.delete(video);
  },
  unmountAll() {
    for (const video of Array.from(active)) this.unmount(video);
  },
  isMounted(video) {
    return mounted.has(video);
  },
  define(tagName) {
    defineKuiPlayer(tagName);
  },
  setPagePresence,
  getPagePresence,
  createPagePresenceGroup,
};

// ─── zero-config auto-start ──────────────────────────────────────────────────

/**
 * Read configuration off the `<script>` tag that loaded this bundle, so a page
 * with no build step can do everything from one line of HTML:
 *
 * ```html
 * <script src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"
 *         data-auto="video" data-accent="#f97316"></script>
 * ```
 */
function autoStart(): void {
  const script = document.currentScript as HTMLScriptElement | null
    ?? document.querySelector<HTMLScriptElement>('script[data-auto]');
  if (!script) return;

  // A page-level "Still watching?" group, for every player skinned from here on.
  // It is made before anything is skinned, so the first players already join it.
  if (!isOff(script.dataset.presence)) {
    const presence = parsePresence(script.dataset.presence, script.dataset.presenceEveryMs, script.dataset.presenceGraceMs);
    if (presence) setPagePresence(presence);
  }

  const selector = script.dataset.auto;
  if (selector === undefined && script.dataset.define === undefined) {
    // Still register the element if the page uses the tag.
    if (document.querySelector('kui-player')) defineKuiPlayer();
    return;
  }

  const flag = (name: string, fallback: boolean): boolean => {
    const raw = script.dataset[name];
    if (raw === undefined || raw === '') return fallback;
    return raw !== 'false' && raw !== '0' && raw !== 'off';
  };

  const start = () => {
    if (selector === undefined) return;
    api.skinAll(selector || 'video', {
      accent: script.dataset.accent,
      title: script.dataset.title,
      autoHideControls: flag('autohide', true),
      enableKeyboard: flag('keyboard', true),
      hideNativeControls: flag('nativeControls', false) ? false : true,
      cast: flag('cast', false),
      observe: flag('observe', true),
      defaultSpeed: script.dataset.speed ? Number(script.dataset.speed) : undefined,
      live: parseLive(script.dataset.live),
      loadOnPlay: parseFlag(script.dataset.loadOnPlay),
      // `data-presence="off"` keeps the skinned players out of the page's group.
      presence: isOff(script.dataset.presence) ? false : undefined,
    });
  };

  // `<kui-player>` is registered whenever the tag appears on the page, so the
  // custom-element route needs no configuration either.
  if (document.querySelector('kui-player') || script.dataset.define !== undefined) {
    defineKuiPlayer(script.dataset.define || 'kui-player');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

// Idempotent install — re-injecting the bundle must not replace a live instance.
if (!window.kuiPlayer) {
  window.kuiPlayer = api;
  window.__tepegozVideoPlayer = api;   // pre-0.1.0 name
  autoStart();
}

export {};
