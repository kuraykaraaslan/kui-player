# kui-player

[![npm](https://img.shields.io/npm/v/@kuraykaraaslan/kui-player.svg)](https://www.npmjs.com/package/@kuraykaraaslan/kui-player)
[![license](https://img.shields.io/npm/l/@kuraykaraaslan/kui-player.svg)](./LICENSE)

A standalone, framework-light HTML5 video player built on **React 18/19**, **Zustand** and **Tailwind CSS v4**. Ships a framework-agnostic TypeScript core (`VideoPlayerEngine`) that wraps a native `<video>` element, plus a batteries-included React subpath.

> **Status**: early-stage (`0.0.2`). Public API is unstable; expect breaking changes between patch versions until `0.1.0`.

---

## Features

- **Native `<video>` core** — plays whatever the browser plays natively (see [Streaming formats](#streaming-formats))
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

kui-player drives a plain `<video>` element and **does not ship an HLS or DASH engine.**
What plays is exactly what the browser plays:

| Source | Chrome / Firefox | Safari / iOS |
|---|---|---|
| MP4, WebM (progressive) | ✅ | ✅ |
| HLS (`.m3u8`) | ❌ — needs `hls.js` | ✅ native |
| DASH (`.mpd`) | ❌ — needs `dash.js` | ❌ |

For HLS on Chrome/Firefox, attach `hls.js` to the element yourself — the engine never
touches the media pipeline, so an external MSE attachment coexists with it:

```tsx
import Hls from "hls.js";
import { VideoPlayerEngine } from "@kuraykaraaslan/kui-player";

const video = document.querySelector("video")!;
const engine = new VideoPlayerEngine();
engine.attach(video);            // controls + state only

if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = "https://example.com/stream.m3u8";   // Safari: native
} else if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource("https://example.com/stream.m3u8");
  hls.attachMedia(video);                          // everyone else
}
```

A first-party adapter (with an ABR "Auto" quality entry) is planned — see
[`phases/phase-1-playback-compat.md`](./phases/phase-1-playback-compat.md).

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
| `Esc` | close the settings panel |

---

## API — `<VideoPlayer />`

| Prop | Type | Notes |
|---|---|---|
| `src` | `string \| VideoSource \| (string \| VideoSource)[]` | required |
| `poster` / `title` | `string` | poster image / overlay title |
| `autoPlay` / `loop` / `startMuted` | `boolean` | native playback flags |
| `playsInline` | `boolean` | defaults to `true`; `false` hands iOS Safari its native fullscreen player |
| `qualities` | `QualityOption[]` | switchable sources |
| `defaultQuality` | `string` | initial quality `value` |
| `subtitles` | `SubtitleTrack[]` | WebVTT tracks |
| `audioTracks` | `AudioTrackOption[]` | selectable audio tracks |
| `onQualityChange` / `onAudioTrackChange` | callbacks | switch handlers |
| `controlsVisible` | `boolean` | controlled visibility |
| `autoHideControls` | `boolean` | hide after 3s while playing |
| `onControlsVisibilityChange` | `(visible) => void` | visibility callback |
| `enableCast` | `boolean` | enable the Google Cast button |
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
| `@kuraykaraaslan/kui-player` | Vanilla core: `VideoPlayerEngine`, `createVideoPlayerStore`, `formatTime`, constants (`SPEEDS`, `SUBTITLE_SIZES`), and all types |
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

- `modules/` — vanilla core (engine, store, format, constants, types). No React imports.
- `react/` — React subpath: `<VideoPlayer />`, control parts, settings panels, and hooks (cast, subtitle cues, keyboard).
- `libs/` — cross-cutting utilities (`cn()`).
- `src/` — Vite dev playground (not bundled into the published package).
- `scripts/` — build helpers (`build-css.mjs`).
- `phases/` — the roadmap: what is built, what is next, and why.

---

## License

[Apache-2.0](./LICENSE) © 2026 Kuray Karaaslan
