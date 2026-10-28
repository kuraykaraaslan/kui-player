import { vi } from 'vitest';
import type { MediaAdapter, MediaAdapterHost } from '../../modules/videoplayer/adapters/adapter.types';

/**
 * What the Vue, Svelte and skin-mode tests share: the browser APIs skin mode
 * needs and jsdom lacks, a stand-in for hls.js, and a way to press fullscreen.
 */

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** `IntersectionObserver` / `ResizeObserver` for skin mode's overlay tracking; the former reports to the test. */
export function stubObservers(): { intersections: ObserverCallback[]; restore: () => void } {
  const intersections: ObserverCallback[] = [];
  const realIO = globalThis.IntersectionObserver;
  const realRO = globalThis.ResizeObserver;
  globalThis.IntersectionObserver = class {
    constructor(cb: ObserverCallback) { intersections.push(cb); }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  return {
    intersections,
    restore() { globalThis.IntersectionObserver = realIO; globalThis.ResizeObserver = realRO; },
  };
}

/** A stand-in for hls.js: claims `.m3u8`, hands each attach's host to the test so the "stream" can say what it is. */
export function fakeAdapter() {
  const hosts: MediaAdapterHost[] = [];
  const adapter = {
    name: 'fake',
    canPlay: (src: string) => src.endsWith('.m3u8'),
    attach: vi.fn(async (_v: HTMLVideoElement, _s: string, host: MediaAdapterHost) => { hosts.push(host); }),
    getQualities: () => [],
    setQuality: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    detach: vi.fn(),
  } satisfies MediaAdapter;
  return { adapter, hosts };
}

/** jsdom has no Fullscreen API: give elements one that behaves like it, so the player's fullscreen rules can run. */
export function stubFullscreen(): () => void {
  const proto = HTMLElement.prototype as unknown as { requestFullscreen?: () => Promise<void> };
  const doc = document as unknown as { exitFullscreen?: () => Promise<void> };
  const had = { request: proto.requestFullscreen, exit: doc.exitFullscreen };
  const set = (el: Element | null) => {
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = el;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  proto.requestFullscreen = function request(this: HTMLElement) { set(this); return Promise.resolve(); };
  doc.exitFullscreen = () => { set(null); return Promise.resolve(); };
  return () => {
    set(null);
    proto.requestFullscreen = had.request;
    doc.exitFullscreen = had.exit;
  };
}

/** A `<video>` in the document, the way a page owns one. */
export function pageVideo(attrs: Record<string, string> = {}): HTMLVideoElement {
  const video = document.createElement('video');
  for (const [name, value] of Object.entries(attrs)) video.setAttribute(name, value);
  document.body.appendChild(video);
  return video;
}
