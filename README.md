# kui-player

[![npm](https://img.shields.io/npm/v/@kuraykaraaslan/kui-player.svg)](https://www.npmjs.com/package/@kuraykaraaslan/kui-player)
[![license](https://img.shields.io/npm/l/@kuraykaraaslan/kui-player.svg)](./LICENSE)

A standalone, framework-light HTML5 video player built on **React 18/19**, **Zustand** and **Tailwind CSS v4**. Ships a framework-agnostic TypeScript core (`VideoPlayerEngine`) that wraps a native `<video>` element, plus a batteries-included React subpath.

> **Status**: early-stage (`0.0.2`). Public API is unstable; expect breaking changes between patch versions until `0.1.0`.

---

## Features

- **Native `<video>` core** — plus optional HLS/DASH adapters (see [Streaming formats](#streaming-formats))
- **Adaptive streaming** — bring your own `hls.js` / `dash.js`; the quality menu fills itself from the manifest and gains an **Auto** entry
- **Real audio-track switching** — element-level (Safari) or through the adapter
- **Picture-in-Picture** — button + `i` shortcut, hidden where unsupported
- **Touch gestures** — double-tap to skip, hold for 2×, drag to scrub or change volume
- **Fullscreen everywhere** — including iPhone Safari, which has no element fullscreen at all
- **Full control bar** — play/pause, seek, buffered indicator, volume, speed, fullscreen
- **Custom subtitle overlay** — WebVTT tracks rendered as a styled overlay with four font sizes
- **Quality + audio-track switching** via a nested settings panel
- **Speed control** — 0.25× → 2×
- **Google Cast** — Chromecast session handling with remote-player mirroring
- **Keyboard shortcuts** — space/`k`, `←`/`→` (±10s), `↑`/`↓` (volume), `m`, `f`, `Esc`
- **Auto-hiding controls** with controlled/uncontrolled visibility
- **Error surface** — a readable overlay with a retry button, plus backed-off automatic retries on network failures (never an endless spinner)
- **Position-preserving source switching** — quality changes keep time, play state, rate and volume
- **`playsInline`** by default, so iOS Safari plays in the page instead of its own fullscreen player
- Framework-agnostic core: Zustand vanilla store, no React imports below `react/`
- Strict TypeScript throughout

---

## Streaming formats

kui-player **bundles no streaming engine.** Progressive sources play natively; adaptive
formats work by handing the player an adapter around a library *you* install, so an app
that only serves MP4 pays nothing for HLS support.

| Source | Out of the box | With an adapter |
|---|---|---|
| MP4, WebM (progressive) | ✅ everywhere | — |
| HLS (`.m3u8`) | ✅ Safari / iOS only | ✅ everywhere with `hls.js` |
| DASH (`.mpd`) | ❌ nowhere | ✅ everywhere with `dash.js` |

```tsx
import Hls from "hls.js";                    // your dependency, not ours
import { VideoPlayer, createHlsAdapter } from "@kuraykaraaslan/kui-player/react";

const adapters = [createHlsAdapter({ Hls })];  // build this once, outside render

<VideoPlayer src="https://example.com/stream.m3u8" adapters={adapters} />;
```

- An adapter is consulted per source: `.m3u8` goes to `hls.js`, `.mp4` stays native.
- Where the browser plays HLS itself (Safari, iOS) the adapter hands the URL straight
  to the element — hardware decoding and AirPlay keep working. Pass
  `createHlsAdapter({ Hls, preferNative: false })` to always use `hls.js` instead.
- **Renditions populate the quality menu automatically**, with an **Auto** entry that
  returns control to ABR (and shows which level it settled on). The `qualities` prop is
  only needed for consumer-driven source lists.
- Multi-language audio renditions appear under *Audio Language* and actually switch.
- Omit the `Hls` option to pick up a global `window.Hls` — the shape a `<script>` tag
  install leaves behind, which is what the demo in this repo uses.

DASH is identical:

```ts
import dashjs from "dashjs";
import { createDashAdapter } from "@kuraykaraaslan/kui-player";

const adapters = [createDashAdapter({ dashjs })];
```

Adapters are a plain interface (`MediaAdapter`) — `canPlay` / `attach` / `getQualities` /
`setQuality` / `detach` — so a custom engine (Shaka, a proprietary CDN SDK) plugs in the
same way. With the vanilla core, register one with `engine.use(adapter)` and load through
`engine.loadSource(url)`.

---

## Install

```bash
pnpm add @kuraykaraaslan/kui-player react react-dom
```

`react` and `react-dom` are **optional peerDependencies** — only required if you import from `@kuraykaraaslan/kui-player/react`. `zustand` ships as a direct dependency.

---

## Quick start — React

```tsx
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";
import "@kuraykaraaslan/kui-player/styles.css";

export default function App() {
  return (
    <div className="aspect-video w-full max-w-3xl">
      <VideoPlayer
        src="https://example.com/video.mp4"
        poster="https://example.com/poster.jpg"
        title="Big Buck Bunny"
        qualities={[
          { label: "1080p", value: "https://example.com/1080.mp4" },
          { label: "720p",  value: "https://example.com/720.mp4" },
        ]}
        subtitles={[
          { label: "English", srclang: "en", src: "/subs/en.vtt" },
          { label: "Türkçe",  srclang: "tr", src: "/subs/tr.vtt" },
        ]}
        enableCast
        autoHideControls
        onQualityChange={(value) => console.log("quality", value)}
        onCastStateChange={(state) => console.log("cast", state)}
      />
    </div>
  );
}
```

Import `styles.css` **once** at your app root — it ships the compiled Tailwind v4 design tokens the component depends on.

---

## Next.js App Router

The React subpath is a **client boundary**: `@kuraykaraaslan/kui-player/react` is published
with a `"use client"` banner, so `<VideoPlayer>` can be rendered directly from a server
component without a wrapper of your own.

```tsx
// app/watch/page.tsx — a server component, no "use client" needed here
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

export default function Page() {
  return <VideoPlayer src="https://example.com/video.mp4" title="Big Buck Bunny" />;
}
```

Import the stylesheet once from the root layout:

```tsx
// app/layout.tsx
import "@kuraykaraaslan/kui-player/styles.css";
```

The vanilla core (`@kuraykaraaslan/kui-player`) is SSR-safe on its own: constructing a
`VideoPlayerEngine` touches no browser global. `document` is only read from `attach()`,
`toggleFullscreen()` and the event handlers they install — all of which run after mount.

---

## Quick start — vanilla TypeScript

The `VideoPlayerEngine` attaches to any `HTMLVideoElement` and drives a Zustand vanilla store — no React dependency, mirroring the role of the `Viewer` class in [`@kuraykaraaslan/kui-viewer`](https://www.npmjs.com/package/@kuraykaraaslan/kui-viewer).

```ts
import { VideoPlayerEngine } from "@kuraykaraaslan/kui-player";

const video = document.querySelector("video")!;
const engine = new VideoPlayerEngine({ startMuted: true, autoHideControls: true });

engine.attach(video);

engine.togglePlay();
engine.seekBy(10);        // +10s
engine.setVolume(0.5);
engine.setSpeed(1.5);

// swap the source without losing the viewer's place (time, play state, rate, volume)
engine.switchSource("https://example.com/720.mp4");

// recover from a failed load — clears the error and reloads at the same position
engine.retry();

// adaptive streaming: register an adapter, then load through the engine
engine.use(createHlsAdapter({ Hls }));
await engine.loadSource("https://example.com/stream.m3u8");
engine.selectQuality("auto");   // or a level index, as a string
engine.setAudioTrack(1);

void engine.togglePictureInPicture();
engine.toggleFullscreen(containerElement);   // falls back to emulated fullscreen

// subscribe to reactive state (currentTime, duration, buffered, playing, …)
const unsub = engine.store.subscribe((s) => console.log(s.currentTime, s.duration));

engine.dispose();         // detaches listeners
unsub();
```

---

## Keyboard shortcuts

Active while the player container is focused:

| Key | Action |
|---|---|
| `Space` / `k` | play / pause |
| `←` / `→` | seek ∓10s |
| `↑` / `↓` | volume ±10% |
| `m` | mute / unmute |
| `f` | toggle fullscreen |
| `i` | Picture-in-Picture |
| `Esc` | close the settings panel, or leave emulated fullscreen |

---

## Touch gestures

Active on touch input only — mouse and pen keep the desktop behaviour.

| Gesture | Action |
|---|---|
| Single tap | show / hide the controls (never pause — the most misfired control on a phone) |
| Double tap, left / right half | seek ∓10s, with a directional hint |
| Press and hold | play at 2× until released |
| Drag horizontally | scrub, with a live time preview |
| Drag vertically, right half | volume |
| Drag vertically, left half | dim the picture (opt in with `gestures={{ verticalBrightness: true }}`) |

Turn the lot off with `gestures={false}`, or tune individually:

```tsx
<VideoPlayer src={src} gestures={{ seekStep: 15, longPressRate: 3, horizontalScrub: false }} />
```

The seek bar keeps a 44px touch target regardless of how thin it looks.

---

## Fullscreen

`toggleFullscreen` walks a capability chain: the standard element API →
`webkitRequestFullscreen` → an **emulated** fullscreen container. That last step matters
on iPhone Safari, which implements element fullscreen nowhere — the only native option
there is the OS video player, which replaces our chrome entirely. Emulated fullscreen
keeps the controls, subtitles and settings panel; `Esc` leaves it.

Pass `preferNativeIosFullscreen` to prefer the OS player on iOS instead, or
`autoFullscreenOnLandscape` to go fullscreen when a phone is rotated while playing.

---

## API — `<VideoPlayer />`

| Prop | Type | Notes |
|---|---|---|
| `src` | `string \| VideoSource \| (string \| VideoSource)[]` | required |
| `poster` / `title` | `string` | poster image / overlay title |
| `autoPlay` / `loop` / `startMuted` | `boolean` | native playback flags |
| `playsInline` | `boolean` | defaults to `true`; `false` hands iOS Safari its native fullscreen player |
| `adapters` | `MediaAdapter[]` | HLS/DASH adapters — see [Streaming formats](#streaming-formats) |
| `qualities` | `QualityOption[]` | switchable sources (ignored once an adapter reports renditions) |
| `defaultQuality` | `string` | initial quality `value` |
| `subtitles` | `SubtitleTrack[]` | WebVTT tracks |
| `audioTracks` | `AudioTrackOption[]` | selectable audio tracks |
| `onQualityChange` / `onAudioTrackChange` | callbacks | switch handlers |
| `controlsVisible` | `boolean` | controlled visibility |
| `autoHideControls` | `boolean` | hide after 3s while playing |
| `onControlsVisibilityChange` | `(visible) => void` | visibility callback |
| `enableCast` | `boolean` | enable the Google Cast button |
| `enablePictureInPicture` | `boolean` | defaults to `true`; the button hides itself where PiP is unsupported |
| `gestures` | `boolean \| GestureOptions` | touch gestures, see [Touch gestures](#touch-gestures) |
| `autoFullscreenOnLandscape` | `boolean` | fullscreen when a phone rotates while playing |
| `preferNativeIosFullscreen` | `boolean` | use the iOS OS player instead of emulated fullscreen |
| `onCastStateChange` | `(state: CastState) => void` | cast lifecycle |
| `className` | `string` | root element class |

---

## Error handling

Any fatal `MediaError` is mirrored into the store as `error: PlayerError | null` and
rendered as an overlay with a **Try again** button. Network errors (`MEDIA_ERR_NETWORK`)
also retry on their own with exponential backoff — up to three attempts, 500 ms / 1 s / 2 s —
before the overlay stops offering to keep trying on its own. A retry reloads the element and
returns to the position playback stopped at.

```ts
engine.store.subscribe((s) => {
  if (s.error) console.warn(s.error.name, s.error.message);
});
```

---

## Exports

| Specifier | Contents |
|---|---|
| `@kuraykaraaslan/kui-player` | Vanilla core: `VideoPlayerEngine`, `createVideoPlayerStore`, `createHlsAdapter`, `createDashAdapter`, `formatTime`, constants (`SPEEDS`, `SUBTITLE_SIZES`), and all types |
| `@kuraykaraaslan/kui-player/react` | React `<VideoPlayer />` plus hooks (`useVideoPlayerEngine`, `useVideoPlayerStore`) |
| `@kuraykaraaslan/kui-player/styles.css` | Compiled Tailwind v4 tokens. Import once at the app root |

---

## Stack

- [React](https://react.dev/) 18 / 19 (optional peer)
- [Zustand](https://github.com/pmndrs/zustand) v5 (vanilla store)
- [Tailwind CSS](https://tailwindcss.com/) v4 (design tokens)
- [Font Awesome](https://fontawesome.com/) (control icons)
- [Google Cast Web SDK](https://developers.google.com/cast/docs/web_sender) (Chromecast)
- [`clsx`](https://github.com/lukeed/clsx) + [`tailwind-merge`](https://github.com/dcastil/tailwind-merge) (`cn()` helper)

---

## Development

```bash
pnpm install
pnpm dev          # Vite playground at http://localhost:5173
pnpm build        # JS + .d.ts + styles.css → dist/
pnpm typecheck    # tsc --noEmit against the library config
```

---

## Project layout

- `modules/` — vanilla core (engine, store, adapters, format, constants, types). No React imports.
- `react/` — React subpath: `<VideoPlayer />`, control parts, settings panels, and hooks (cast, subtitle cues, keyboard, touch gestures).
- `libs/` — cross-cutting utilities (`cn()`).
- `src/` — Vite dev playground (not bundled into the published package).
- `scripts/` — build helpers (`build-css.mjs`).
- `phases/` — the roadmap: what is built, what is next, and why.

---

## License

[Apache-2.0](./LICENSE) © 2026 Kuray Karaaslan
