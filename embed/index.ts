import { config } from '@fortawesome/fontawesome-svg-core';
import { mountSkin, type SkinOptions } from './mountSkin';

// Injected by Vite `define` at build time (see vite.config.embed.ts).
declare const __KUI_EMBED_VERSION__: string;

// Never let Font Awesome inject a <style> into the host page <head> — it would
// pollute the page and trip strict CSP. All styling lives inside our shadow root.
config.autoAddCss = false;

export interface TepegozVideoPlayerApi {
  readonly version: string;
  mount(video: HTMLVideoElement, opts?: SkinOptions): void;
  unmount(video: HTMLVideoElement): void;
  unmountAll(): void;
  isMounted(video: HTMLVideoElement): boolean;
}

declare global {
  interface Window {
    __tepegozVideoPlayer?: TepegozVideoPlayerApi;
  }
}

const mounted = new WeakMap<HTMLVideoElement, () => void>();
const active = new Set<HTMLVideoElement>();

const api: TepegozVideoPlayerApi = {
  version: typeof __KUI_EMBED_VERSION__ === 'string' ? __KUI_EMBED_VERSION__ : '0.0.0',
  mount(video, opts) {
    if (mounted.has(video)) return;
    const unmount = mountSkin(video, opts);
    mounted.set(video, unmount);
    active.add(video);
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
};

// Idempotent install — re-injecting the bundle must not replace a live instance.
if (!window.__tepegozVideoPlayer) {
  window.__tepegozVideoPlayer = api;
}

export {};
