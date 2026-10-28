import { createRoot, type Root } from 'react-dom/client';
import { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine.js';
import { VideoPlayerEngineContext } from '../react/VideoPlayerEngineContext.js';
import { VideoPlayerChrome } from '../react/VideoPlayerChrome.js';
import { PLAYER_CSS } from '../react/styles/index.js';
import { I18nProvider, resolveDictionary, type PartialDictionary } from '../react/i18n/index.js';
import type { MediaAdapter } from '../modules/videoplayer/adapters/adapter.types.js';
import type { LiveInput } from '../modules/videoplayer/videoplayer.live.js';
import { isPresenceGroup, type PresenceGroup, type PresenceOptions } from '../modules/videoplayer/videoplayer.presence.js';
import type { PlayerEventHandler, PlayerEventName } from '../modules/videoplayer/videoplayer.events.js';
import type { AlternateSource } from '../modules/videoplayer/videoplayer.types.js';
import { getPagePresence } from './pagePresence.js';

/** Handlers for the engine's events, by name: `{ 'presence:ask': ({ graceMs }) => … }`. */
export type SkinEventHandlers = { [K in PlayerEventName]?: PlayerEventHandler<K> };

/** What changes on a mounted skin without tearing it down. */
export type SkinLiveUpdate = Pick<SkinOptions, 'live' | 'presence' | 'loadOnPlay'>;

/** The function `mountSkin` returns: unmounts, and carries the engine and a light `update`. */
export type SkinHandle = (() => void) & {
  /** The engine driving the element — for `seekToLive()`, `confirmPresence()`, `store`. */
  readonly engine: VideoPlayerEngine;
  /** Change `live`, `presence` and `loadOnPlay` in place, without remounting. */
  update(next: SkinLiveUpdate): void;
};

export interface SkinOptions {
  /** Playback rate to apply on mount (leaves the element's rate alone if omitted). */
  defaultSpeed?: number;
  /** Auto-hide the controls after inactivity while playing (default true). */
  autoHideControls?: boolean;
  /** Enable keyboard shortcuts while the pointer is over the player (default true). */
  enableKeyboard?: boolean;
  /** Accent colour for the controls — sets `--kui-accent` on the overlay. */
  accent?: string;
  /**
   * Hide the element's own native controls while skinned, and put them back on
   * unmount (default true). Two control bars stacked on one video is the single
   * most common way this goes wrong.
   */
  hideNativeControls?: boolean;
  /** Title shown in the overlay. Defaults to the element's `title` attribute. */
  title?: string;
  /**
   * Offer the Google Cast button (default false). Turning it on loads Google's
   * Cast sender SDK from gstatic.com — the only external request this library
   * can make, and only when you ask for it.
   */
  cast?: boolean;
  /** Dictionary for the controls and the presence prompt — anything it leaves out is English. */
  locale?: PartialDictionary;

  /**
   * Live behaviour: `true` / an object says "this source is live" up front,
   * `{ dvr: true }` keeps a seek bar, `false` turns the live behaviours off.
   * Live is detected from the element regardless (an unbounded duration, or the
   * adapter's playlist). See `LiveOptions`.
   */
  live?: LiveInput;
  /**
   * "Still watching?": `{ everyMs, graceMs }` for this player alone, or a
   * `PresenceGroup` shared with other players (one timer, one prompt). `false`
   * keeps the player out of the page's group (`setPagePresence`), which every
   * skinned element joins otherwise. A `data-kui-presence="off"` attribute on the
   * element does the same for one video.
   */
  presence?: PresenceOptions | PresenceGroup | false;
  /**
   * Hold an adapter-managed (HLS) source back until the first play. Does nothing
   * for a source the page's own pipeline feeds, and `autoplay` loads at once.
   */
  loadOnPlay?: boolean;

  /**
   * Streaming adapters (`createHlsAdapter`) the skin should open `src` / `sources`
   * with. **This is the one place skin mode touches the media pipeline** — leave
   * it out and the page's own pipeline keeps feeding the element.
   */
  adapters?: MediaAdapter[];
  /**
   * The address to open through `adapters`. Give it when the element has no
   * `src` of its own; an element that already plays this address is left alone.
   */
  src?: string;
  /**
   * Several addresses for one stream, picked from the quality menu; the first is
   * the default. The skin sets the element's source (or hands it to `adapters`).
   */
  sources?: AlternateSource[];
  /** With `sources`: the second plays in fullscreen and the first in the card. */
  preferAlternateInFullscreen?: boolean;
  /** Called when the viewer (or the fullscreen rule) changes the active `sources` entry. */
  onSourceChange?: (index: number, source: AlternateSource) => void;

  /** Engine events: `presence:ask`, `live:reconnect`, `suspend`, `error`, … */
  on?: SkinEventHandlers;
}

/** Same items in the same order — so an inline `[hls]` that is a new array on every render is not a change. */
export function sameItems<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) return true;
  return !!a && !!b && a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Marks a skinned element, so a second pass can skip it. */
export const SKINNED_ATTR = 'data-kui-skinned';

const HOST_Z = 2147483000;
const FS_Z = 2147483647;

let sharedSheet: CSSStyleSheet | null = null;
function embedStyleSheet(): CSSStyleSheet {
  if (!sharedSheet) {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(PLAYER_CSS);
  }
  return sharedSheet;
}

/**
 * Overlay the unified player chrome on top of an EXISTING page `<video>` — the
 * site's media pipeline (progressive / hls.js / MSE / blob) is untouched; only the
 * controls are replaced. Returns an idempotent unmount function.
 */
export function mountSkin(video: HTMLVideoElement, opts: SkinOptions = {}): SkinHandle {
  // Autoplay is a play intent already: it loads at once.
  const holdFirstLoad = (loadOnPlay: boolean | undefined) => !!loadOnPlay && !video.autoplay;
  const engine = new VideoPlayerEngine({
    autoHideControls: opts.autoHideControls ?? true,
    adapters: opts.adapters,
    live: opts.live,
    loadOnPlay: holdFirstLoad(opts.loadOnPlay),
  });
  // Before `attach`, so nothing the engine reports while attaching is missed.
  for (const [name, handler] of Object.entries(opts.on ?? {})) {
    if (handler) engine.on(name as PlayerEventName, handler as PlayerEventHandler<PlayerEventName>);
  }
  engine.attach(video);

  // Take over the element's own controls; `unmount` restores exactly what it
  // found, attribute or property.
  const hadControlsAttr = video.hasAttribute('controls');
  const hadControls = video.controls;
  if (opts.hideNativeControls ?? true) video.controls = false;
  video.setAttribute(SKINNED_ATTR, '');

  // Seed the store from the live element so the UI reflects reality immediately.
  const st = engine.store.getState();
  st.setPlaying(!video.paused);
  st.setVolume(video.volume);
  st.setMuted(video.muted);
  st.setSpeed(video.playbackRate);
  st.setLoading(video.readyState < 3);
  if (Number.isFinite(video.duration)) st.setDuration(video.duration || 0);
  st.setCurrentTime(video.currentTime);
  if (typeof opts.defaultSpeed === 'number') engine.setSpeed(opts.defaultSpeed);

  // ── Presence: this player's own options, a group, the page's group, or none. ──
  const elementOptedOut = ['off', 'false', '0'].includes(video.getAttribute('data-kui-presence') ?? '');
  function presenceTarget(input: SkinOptions['presence']): PresenceOptions | PresenceGroup | undefined {
    if (input === false || (input === undefined && elementOptedOut)) return undefined;
    if (input && typeof input === 'object') return input;   // a group, or this player's own options
    return getPagePresence() ?? undefined;
  }
  // After the seed above: a group joined by a player that is already playing starts its timer at once.
  engine.setPresence(presenceTarget(opts.presence));

  // ── Sources: `sources` (alternates) or `src`, opened through adapters when one claims them. ──
  const alternates = opts.sources && opts.sources.length > 0 ? opts.sources : null;
  let alternateIndex = 0;
  const initialSrc = alternates ? alternates[0]?.src : opts.src;

  /** Point the element at `src`: an adapter that claims it opens it, otherwise the element does. */
  function openSource(src: string): void {
    // Releases an adapter that no longer applies; resolves at once when none claims `src`.
    void engine.loadSource(src);
    if (!engine.hasAdapterFor(src) && video.getAttribute('src') !== src) engine.switchSource(src);
  }
  if (initialSrc) openSource(initialSrc);

  // Overlay host (light DOM) + shadow root for style isolation.
  const host = document.createElement('div');
  host.setAttribute('data-tepegoz-video-player', '');
  host.style.cssText = `position:fixed;z-index:${HOST_Z};pointer-events:auto;margin:0;padding:0;`;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [embedStyleSheet()];
  const mountEl = document.createElement('div');
  mountEl.style.cssText = 'width:100%;height:100%;';
  if (opts.accent) mountEl.style.setProperty('--kui-accent', opts.accent);
  shadow.appendChild(mountEl);
  document.body.appendChild(host);

  const videoRef = { current: video };

  // ── Fullscreen: move the video + our controls into one fullscreen wrapper, ──
  // restore on exit. Never mutate the site tree except during fullscreen.
  let fsWrapper: HTMLElement | null = null;
  let restore: (() => void) | null = null;

  function enterFullscreen(): void {
    if (fsWrapper) return;
    const parent = video.parentNode;
    const next = video.nextSibling;
    const prevVideoCss = video.style.cssText;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:fixed;inset:0;background:#000;z-index:${FS_Z};`;
    try {
      wrapper.appendChild(video);
      video.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
      wrapper.appendChild(host);
      document.body.appendChild(wrapper);
      fsWrapper = wrapper;
      restore = () => {
        try {
          if (parent) parent.insertBefore(video, next);
          video.style.cssText = prevVideoCss;
          document.body.appendChild(host);
          wrapper.remove();
        } catch { /* best effort */ }
        fsWrapper = null;
        restore = null;
        syncRect();
      };
      void wrapper.requestFullscreen().catch(() => restore?.());
    } catch {
      restore?.();
    }
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    enterFullscreen();
  }

  function onFsChange(): void {
    if (!document.fullscreenElement && restore) restore();
  }
  document.addEventListener('fullscreenchange', onFsChange);

  // ── Rect tracking: keep the overlay glued to the player's box. ──
  // Sites like YouTube size the raw <video> to the pixel content, not the visible player, so the
  // controls would sit in a small box. Expand to a modestly-larger ancestor that is centered on the
  // video (a letterbox / player container), never grabbing a page-level element.
  function overlayRect(): DOMRect {
    const base = video.getBoundingClientRect();
    let best = base;
    const bestArea = () => best.width * best.height;
    const cx = base.left + base.width / 2;
    const cy = base.top + base.height / 2;
    let el: HTMLElement | null = video.parentElement;
    for (let depth = 0; el && depth < 4; el = el.parentElement, depth += 1) {
      const r = el.getBoundingClientRect();
      const containsCenter = r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy;
      const centeredX = Math.abs((r.left + r.right) / 2 - cx) <= 6;
      const centeredY = Math.abs((r.top + r.bottom) / 2 - cy) <= 6;
      const larger = r.width * r.height > bestArea();
      const notTooBig =
        r.width <= window.innerWidth * 1.02 && r.width * r.height <= base.width * base.height * 3.5;
      if (containsCenter && centeredX && centeredY && larger && notTooBig && r.width >= 1 && r.height >= 1) {
        best = r;
      }
    }
    return best;
  }

  let lastKey = '';
  function syncRect(): void {
    if (fsWrapper) {
      host.style.position = 'absolute';
      host.style.left = host.style.top = '0px';
      host.style.width = host.style.height = '100%';
      host.style.display = 'block';
      return;
    }
    const r = overlayRect();
    if (r.width < 1 || r.height < 1) { host.style.display = 'none'; return; }
    const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
    if (key === lastKey && host.style.display !== 'none') return;
    lastKey = key;
    host.style.position = 'fixed';
    host.style.display = 'block';
    host.style.left = `${r.left}px`;
    host.style.top = `${r.top}px`;
    host.style.width = `${r.width}px`;
    host.style.height = `${r.height}px`;
  }

  let rafId = 0;
  let running = false;
  function loop(): void { syncRect(); rafId = requestAnimationFrame(loop); }
  function startLoop(): void { if (!running) { running = true; loop(); } }
  function stopLoop(): void { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible) startLoop(); else { stopLoop(); host.style.display = 'none'; }
  }, { threshold: 0 });
  io.observe(video);
  const ro = new ResizeObserver(() => syncRect());
  ro.observe(video);
  syncRect();
  startLoop();

  // ── Keyboard (hover-scoped to avoid multi-video conflicts). ──
  let hovered = false;
  host.addEventListener('pointerenter', () => { hovered = true; });
  host.addEventListener('pointerleave', () => { hovered = false; });
  function onKey(e: KeyboardEvent): void {
    if (opts.enableKeyboard === false) return;
    if (!hovered && document.fullscreenElement !== fsWrapper) return;
    const s = engine.store.getState();
    switch (e.key) {
      case ' ':
      case 'k': e.preventDefault(); engine.togglePlay(); break;
      case 'ArrowLeft':  e.preventDefault(); engine.seekBy(-10); break;
      case 'ArrowRight': e.preventDefault(); engine.seekBy(10); break;
      case 'ArrowUp':    e.preventDefault(); engine.setVolume(s.volume + 0.1); break;
      case 'ArrowDown':  e.preventDefault(); engine.setVolume(s.volume - 0.1); break;
      case 'm': e.preventDefault(); engine.toggleMute(); break;
      case 'f': e.preventDefault(); toggleFullscreen(); break;
      default: break;
    }
  }
  document.addEventListener('keydown', onKey);

  const root: Root = createRoot(mountEl);
  const dictionary = opts.locale ? resolveDictionary(opts.locale) : null;

  function selectAlternate(next: number): void {
    const target = alternates?.[next];
    if (!alternates || !target || next === alternateIndex) return;
    // Position and play state travel with the viewer (a live stream rejoins the edge).
    engine.captureRestorePoint();
    alternateIndex = next;
    openSource(target.src);
    opts.onSourceChange?.(next, target);
    render();
  }

  function render(): void {
    const chrome = (
      <VideoPlayerChrome
        skin
        videoRef={videoRef}
        title={opts.title ?? video.title ?? undefined}
        src={initialSrc ?? (video.currentSrc || video.src)}
        poster={video.poster || undefined}
        enableCast={opts.cast ?? false}
        alternateSources={alternates ?? undefined}
        alternateIndex={alternateIndex}
        onAlternateSelect={selectAlternate}
        onToggleFullscreen={toggleFullscreen}
      />
    );
    root.render(
      <VideoPlayerEngineContext.Provider value={engine}>
        {dictionary ? <I18nProvider value={dictionary}>{chrome}</I18nProvider> : chrome}
      </VideoPlayerEngineContext.Provider>,
    );
  }
  render();

  // Entering or leaving fullscreen moves between the first and second address.
  // Only the change does, so a viewer's own pick stays until the next toggle.
  const stopFullscreenRule = alternates && alternates.length > 1 && opts.preferAlternateInFullscreen
    ? engine.store.subscribe((now, before) => {
      if (now.isFullscreen !== before.isFullscreen) selectAlternate(now.isFullscreen ? 1 : 0);
    })
    : null;

  let disposed = false;
  function unmount(): void {
    if (disposed) return;
    disposed = true;
    stopFullscreenRule?.();
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFsChange);
    if (document.fullscreenElement === fsWrapper && fsWrapper) void document.exitFullscreen();
    restore?.();
    stopLoop();
    io.disconnect();
    ro.disconnect();
    root.unmount();
    engine.dispose();
    host.remove();
    video.removeAttribute(SKINNED_ATTR);
    video.controls = hadControls;
    if (hadControlsAttr) video.setAttribute('controls', ''); else video.removeAttribute('controls');
  }

  // What is applied now, so `update` leaves alone what did not change: re-applying
  // `presence` would restart its timer, and `live` would re-run its visibility watch.
  let appliedLive = JSON.stringify(opts.live ?? null);
  let appliedPresence = presenceTarget(opts.presence);
  let appliedLoadOnPlay = !!opts.loadOnPlay;
  /** A group is compared by identity, plain options by value (an inline `{ everyMs, graceMs }` is new each render). */
  const samePresence = (a: ReturnType<typeof presenceTarget>, b: ReturnType<typeof presenceTarget>): boolean => {
    if (!a || !b || isPresenceGroup(a) || isPresenceGroup(b)) return a === b;
    return a.everyMs === b.everyMs && a.graceMs === b.graceMs;
  };

  return Object.assign(unmount, {
    engine,
    update(next: SkinLiveUpdate): void {
      if ('live' in next && JSON.stringify(next.live ?? null) !== appliedLive) {
        appliedLive = JSON.stringify(next.live ?? null);
        engine.setLive(next.live);
      }
      if ('loadOnPlay' in next && !!next.loadOnPlay !== appliedLoadOnPlay) {
        appliedLoadOnPlay = !!next.loadOnPlay;
        engine.setLoadOnPlay(holdFirstLoad(next.loadOnPlay));
      }
      if ('presence' in next) {
        const target = presenceTarget(next.presence);
        if (!samePresence(target, appliedPresence)) {
          appliedPresence = target;
          engine.setPresence(target);
        }
      }
    },
  });
}
