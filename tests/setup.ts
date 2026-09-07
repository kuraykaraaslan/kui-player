import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * jsdom implements no media pipeline at all: `play()` throws "not implemented",
 * `paused` is a constant, `duration` is read-only NaN. These shims give the
 * element just enough behaviour to be driven like a real one — state that our
 * own code sets, and events fired at the right moments — so the engine can be
 * tested against the DOM contract it actually relies on.
 */
type MediaState = {
  paused: boolean;
  currentTime: number;
  duration: number;
  readyState: number;
  error: MediaError | null;
  ended: boolean;
  loadCount: number;
};

const state = new WeakMap<HTMLMediaElement, MediaState>();

function media(el: HTMLMediaElement): MediaState {
  let s = state.get(el);
  if (!s) {
    s = { paused: true, currentTime: 0, duration: NaN, readyState: 0, error: null, ended: false, loadCount: 0 };
    state.set(el, s);
  }
  return s;
}

const proto = window.HTMLMediaElement.prototype;
const define = (prop: string, descriptor: PropertyDescriptor) =>
  Object.defineProperty(proto, prop, { configurable: true, ...descriptor });

define('play', {
  value(this: HTMLMediaElement) {
    const s = media(this);
    if (s.paused) { s.paused = false; this.dispatchEvent(new Event('play')); this.dispatchEvent(new Event('playing')); }
    return Promise.resolve();
  },
});
define('pause', {
  value(this: HTMLMediaElement) {
    const s = media(this);
    if (!s.paused) { s.paused = true; this.dispatchEvent(new Event('pause')); }
  },
});
define('load', {
  value(this: HTMLMediaElement) {
    const s = media(this);
    s.loadCount += 1;
    s.currentTime = 0;
    s.error = null;
    this.dispatchEvent(new Event('emptied'));
    this.dispatchEvent(new Event('loadstart'));
  },
});
define('paused', { get(this: HTMLMediaElement) { return media(this).paused; } });
define('ended', { get(this: HTMLMediaElement) { return media(this).ended; } });
define('currentTime', {
  get(this: HTMLMediaElement) { return media(this).currentTime; },
  set(this: HTMLMediaElement, v: number) {
    media(this).currentTime = v;
    this.dispatchEvent(new Event('timeupdate'));
  },
});
define('duration', {
  get(this: HTMLMediaElement) { return media(this).duration; },
  set(this: HTMLMediaElement, v: number) {
    media(this).duration = v;
    this.dispatchEvent(new Event('durationchange'));
  },
});
define('readyState', {
  get(this: HTMLMediaElement) { return media(this).readyState; },
  set(this: HTMLMediaElement, v: number) { media(this).readyState = v; },
});
define('error', {
  get(this: HTMLMediaElement) { return media(this).error; },
  set(this: HTMLMediaElement, v: MediaError | null) { media(this).error = v; },
});
define('buffered', {
  get() { return { length: 0, start: () => 0, end: () => 0 } as unknown as TimeRanges; },
});
define('canPlayType', { value: () => '' });
define('requestPictureInPicture', {
  value(this: HTMLMediaElement) {
    Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: this });
    this.dispatchEvent(new Event('enterpictureinpicture'));
    return Promise.resolve({});
  },
});

/*
 * jsdom builds no TextTrack objects from `<track>` children, so `video.textTracks`
 * is permanently empty and subtitle behaviour is untestable. Build a minimal list
 * from the markup, with the two members our overlay uses: `mode` and `activeCues`.
 */
class FakeTextTrack extends EventTarget {
  mode: TextTrackMode = 'disabled';
  activeCues: unknown = null;
  constructor(readonly label: string, readonly language: string) { super(); }
}

const trackLists = new WeakMap<HTMLMediaElement, FakeTextTrack[]>();

define('textTracks', {
  get(this: HTMLMediaElement) {
    const elements = Array.from(this.querySelectorAll('track'));
    let list = trackLists.get(this);
    if (!list || list.length !== elements.length) {
      list = elements.map((t) => new FakeTextTrack(t.label, t.srclang));
      trackLists.set(this, list);
    }
    return Object.assign(list, { length: list.length }) as unknown as TextTrackList;
  },
});

/** How many times `load()` was called on an element — used to assert reloads. */
export function loadCount(el: HTMLMediaElement): number { return media(el).loadCount; }

/** Drive the element the way a browser would: set state, then fire the event. */
export function emit(el: HTMLMediaElement, type: string, patch: Partial<MediaState> = {}): void {
  Object.assign(media(el), patch);
  el.dispatchEvent(new Event(type));
}

Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, value: true });
Object.defineProperty(document, 'exitPictureInPicture', {
  configurable: true,
  value: () => {
    Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: null });
    return Promise.resolve();
  },
});
Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: null, writable: true });

// jsdom has no fullscreen API; default to "unsupported" so the engine exercises
// its emulated-fullscreen path, and let individual tests opt into the real one.
Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false, writable: true });
Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null, writable: true });

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(),
    }),
  });
}

afterEach(() => { cleanup(); });
