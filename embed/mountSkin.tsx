import { createRoot, type Root } from 'react-dom/client';
import { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine';
import { VideoPlayerEngineContext } from '../react/VideoPlayerEngineContext';
import { VideoPlayerChrome } from '../react/VideoPlayerChrome';
import { EMBED_CSS } from './embed-css.generated';

export interface SkinOptions {
  /** Playback rate to apply on mount (leaves the element's rate alone if omitted). */
  defaultSpeed?: number;
  /** Auto-hide the controls after inactivity while playing (default true). */
  autoHideControls?: boolean;
  /** Enable keyboard shortcuts while the pointer is over the player (default true). */
  enableKeyboard?: boolean;
  /** 'dark' (default) matches the player's chrome; 'light' only shifts accents. */
  theme?: 'light' | 'dark';
}

const HOST_Z = 2147483000;
const FS_Z = 2147483647;

let sharedSheet: CSSStyleSheet | null = null;
function embedStyleSheet(): CSSStyleSheet {
  if (!sharedSheet) {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(EMBED_CSS);
  }
  return sharedSheet;
}

/**
 * Overlay the unified player chrome on top of an EXISTING page `<video>` — the
 * site's media pipeline (progressive / hls.js / MSE / blob) is untouched; only the
 * controls are replaced. Returns an idempotent unmount function.
 */
export function mountSkin(video: HTMLVideoElement, opts: SkinOptions = {}): () => void {
  const engine = new VideoPlayerEngine({ autoHideControls: opts.autoHideControls ?? true });
  engine.attach(video);

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

  // Overlay host (light DOM) + shadow root for style isolation.
  const host = document.createElement('div');
  host.setAttribute('data-tepegoz-video-player', '');
  host.style.cssText = `position:fixed;z-index:${HOST_Z};pointer-events:auto;margin:0;padding:0;`;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.adoptedStyleSheets = [embedStyleSheet()];
  const mountEl = document.createElement('div');
  mountEl.style.cssText = 'width:100%;height:100%;';
  if ((opts.theme ?? 'dark') === 'dark') mountEl.classList.add('dark');
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
  root.render(
    <VideoPlayerEngineContext.Provider value={engine}>
      <VideoPlayerChrome skin videoRef={videoRef} enableCast={false} onToggleFullscreen={toggleFullscreen} />
    </VideoPlayerEngineContext.Provider>,
  );

  let disposed = false;
  return function unmount(): void {
    if (disposed) return;
    disposed = true;
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
  };
}
