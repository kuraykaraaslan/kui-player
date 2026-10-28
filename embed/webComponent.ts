import { mountSkin, type SkinEventHandlers, type SkinHandle, type SkinOptions } from './mountSkin.js';
import { parseFlag, parseLive, parsePresence, parseSources } from './attributes.js';
import type { MediaAdapter } from '../modules/videoplayer/adapters/adapter.types.js';
import type { LiveInput } from '../modules/videoplayer/videoplayer.live.js';
import type { PresenceGroup, PresenceOptions } from '../modules/videoplayer/videoplayer.presence.js';
import type { AlternateSource } from '../modules/videoplayer/videoplayer.types.js';
import type { PartialDictionary } from '../react/i18n/index.js';

/**
 * `<kui-player src="…">` — the player as a custom element.
 *
 * It renders a real `<video>` and skins it, so the element behaves like a
 * `<video>` for everything that matters: assign `src`, call `play()`, listen for
 * `timeupdate`. Angular, Vue, Svelte and plain HTML all consume a custom element
 * natively, which makes this the wrapper for every framework without a bespoke one.
 */

/** The public surface of a `<kui-player>` element. */
export interface KuiPlayerElement extends HTMLElement {
  /** The underlying media element, for anyone who wants the real thing. */
  readonly video: HTMLVideoElement;
  src: string;
  currentTime: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  /**
   * Streaming adapters (`createHlsAdapter`) to open `src` with. Objects cannot be
   * attributes, so this one is a property. Setting it remounts the player.
   */
  adapters: MediaAdapter[] | undefined;
  /** Alternate addresses; the same as the `sources` attribute, for code that has the array. */
  sources: AlternateSource[] | undefined;
  /** `live`, as an object; the attribute covers the common cases. */
  live: LiveInput;
  /** A `PresenceGroup` to join, or `{ everyMs, graceMs }`, or `false` to stay out of the page's group. */
  presence: PresenceOptions | PresenceGroup | false | undefined;
  /** A dictionary for the controls — import one from `@kuraykaraaslan/kui-player/locales`. */
  locale: PartialDictionary | undefined;
  /** The skin underneath: its `engine` and in-place `update()`. `null` while disconnected. */
  readonly skin: SkinHandle | null;
}

const OBSERVED = [
  'src', 'poster', 'title', 'accent', 'autoplay', 'muted', 'loop', 'controls', 'speed',
  'live', 'presence', 'presence-every-ms', 'presence-grace-ms', 'load-on-play',
  'sources', 'prefer-alternate-in-fullscreen',
];

/**
 * Engine events a page may want, re-dispatched on the element as `CustomEvent`s.
 * Prefixed `kui-` because `suspend`, `resume` and `error` already mean something
 * to a `<video>`. The payload is `event.detail`.
 */
const FORWARDED = [
  'presence:ask', 'presence:continue', 'presence:timeout',
  'suspend', 'resume', 'live:reconnect', 'live:recovered', 'error',
] as const;
const eventName = (name: string) => `kui-${name.replace(':', '-')}`;

let constructor: CustomElementConstructor | null = null;

/**
 * Builds the class on first use rather than at module scope. `HTMLElement` does
 * not exist on a server, and this module is reachable from the `skin` entry
 * point — evaluating `extends HTMLElement` at import time would crash every
 * server-rendered app that imports `mountSkin`.
 */
function elementClass(): CustomElementConstructor {
  if (constructor) return constructor;

  class KuiPlayer extends HTMLElement {
    static get observedAttributes(): string[] { return OBSERVED; }

    readonly video: HTMLVideoElement = document.createElement('video');
    private unmount: SkinHandle | null = null;
    private props: {
      adapters?: MediaAdapter[]; sources?: AlternateSource[]; live?: LiveInput;
      presence?: PresenceOptions | PresenceGroup | false; locale?: PartialDictionary;
    } = {};

    connectedCallback(): void {
      if (this.unmount) return;
      this.style.display = this.style.display || 'block';
      this.style.position = this.style.position || 'relative';

      this.video.style.cssText = 'width:100%;height:100%;display:block;background:#000;';
      this.video.playsInline = true;
      this.syncAttributes();
      if (!this.contains(this.video)) this.appendChild(this.video);

      this.unmount = mountSkin(this.video, this.skinOptions());
    }

    disconnectedCallback(): void {
      this.unmount?.();
      this.unmount = null;
    }

    attributeChangedCallback(name: string): void {
      if (!this.isConnected) return;
      this.syncAttributes();
      // Live and presence change in place; everything else is read at mount time,
      // so a changed accent means a remount — cheap, and it keeps the element's
      // behaviour predictable.
      if (!this.unmount) return;
      if (name === 'live' || name === 'presence' || name === 'presence-every-ms'
        || name === 'presence-grace-ms' || name === 'load-on-play') {
        this.unmount.update(this.liveOptions());
        return;
      }
      this.remount();
    }

    private remount(): void {
      if (!this.unmount) return;
      this.unmount();
      this.unmount = mountSkin(this.video, this.skinOptions());
    }

    // ── the parts of the media API worth forwarding ──
    get src(): string { return this.managed() ? (this.getAttribute('src') ?? '') : this.video.src; }
    set src(value: string) {
      // An adapter-managed source is opened at mount time, so it travels as the attribute.
      if (this.managed() || this.managed(value)) this.setAttribute('src', value); else this.video.src = value;
    }
    get currentTime(): number { return this.video.currentTime; }
    set currentTime(value: number) { this.video.currentTime = value; }
    get paused(): boolean { return this.video.paused; }
    play(): Promise<void> { return this.video.play(); }
    pause(): void { this.video.pause(); }

    // ── options that are objects, so they are properties ──
    get adapters(): MediaAdapter[] | undefined { return this.props.adapters; }
    set adapters(value) { this.props.adapters = value; this.remountIfConnected(); }
    get sources(): AlternateSource[] | undefined { return this.props.sources ?? parseSources(this.getAttribute('sources')); }
    set sources(value) { this.props.sources = value; this.remountIfConnected(); }
    get live(): LiveInput { return this.props.live ?? parseLive(this.getAttribute('live')); }
    set live(value) { this.props.live = value; this.unmount?.update(this.liveOptions()); }
    get presence(): PresenceOptions | PresenceGroup | false | undefined {
      return this.props.presence ?? parsePresence(
        this.getAttribute('presence'), this.getAttribute('presence-every-ms'), this.getAttribute('presence-grace-ms'));
    }
    set presence(value) { this.props.presence = value; this.unmount?.update(this.liveOptions()); }
    get locale(): PartialDictionary | undefined { return this.props.locale; }
    set locale(value) { this.props.locale = value; this.remountIfConnected(); }
    get skin(): SkinHandle | null { return this.unmount; }

    private remountIfConnected(): void {
      if (!this.isConnected) return;
      this.syncAttributes();
      this.remount();
    }

    /** Does an adapter (or an alternate list) open the source, so the element must not load it itself? */
    private managed(src = this.getAttribute('src') ?? ''): boolean {
      return !!this.sources || (src !== '' && !!this.props.adapters?.some((a) => a.canPlay(src)));
    }

    private liveOptions(): Pick<SkinOptions, 'live' | 'presence' | 'loadOnPlay'> {
      return {
        live: this.live,
        presence: this.presence,
        loadOnPlay: parseFlag(this.getAttribute('load-on-play')),
      };
    }

    private skinOptions(): SkinOptions {
      const accent = this.getAttribute('accent');
      const speed = this.getAttribute('speed');
      const sources = this.sources;
      const on: SkinEventHandlers = {};
      for (const name of FORWARDED) {
        (on as Record<string, (detail: unknown) => void>)[name] = (detail) => {
          this.dispatchEvent(new CustomEvent(eventName(name), { detail }));
        };
      }
      return {
        ...(accent ? { accent } : {}),
        ...(speed ? { defaultSpeed: Number(speed) } : {}),
        cast: this.hasAttribute('cast'),
        title: this.getAttribute('title') ?? undefined,
        ...this.liveOptions(),
        adapters: this.props.adapters,
        locale: this.props.locale,
        sources,
        // The attribute is what the element was given; the skin opens it when it is not the element's own.
        src: this.managed() ? (this.getAttribute('src') ?? undefined) : undefined,
        preferAlternateInFullscreen: parseFlag(this.getAttribute('prefer-alternate-in-fullscreen')),
        onSourceChange: (index, source) => {
          this.dispatchEvent(new CustomEvent('kui-source-change', { detail: { index, source } }));
        },
        on,
      };
    }

    private syncAttributes(): void {
      const src = this.getAttribute('src');
      if (this.managed()) {
        // The skin opens it (an adapter, or the first alternate); a `src` attribute here would race it.
        this.video.removeAttribute('src');
      } else if (src && this.video.getAttribute('src') !== src) {
        this.video.setAttribute('src', src);
      }
      const poster = this.getAttribute('poster');
      if (poster) this.video.poster = poster;
      this.video.autoplay = this.hasAttribute('autoplay');
      this.video.loop = this.hasAttribute('loop');
      this.video.muted = this.hasAttribute('muted');
    }
  }

  constructor = KuiPlayer;
  return constructor;
}

/** Register the element. Safe to call more than once, and a no-op on a server. */
export function defineKuiPlayer(tagName = 'kui-player'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return;
  customElements.define(tagName, elementClass());
}
