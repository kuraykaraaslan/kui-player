# kui-videoplayer

[![npm](https://img.shields.io/npm/v/@kuraykaraaslan/kui-videoplayer.svg)](https://www.npmjs.com/package/@kuraykaraaslan/kui-videoplayer)
[![license](https://img.shields.io/npm/l/@kuraykaraaslan/kui-videoplayer.svg)](./LICENSE)

A standalone, framework-light HTML5 video player built on **React 18/19**, **Zustand** and **Tailwind CSS v4**. Ships a framework-agnostic TypeScript core (`VideoPlayerEngine`) that wraps a native `<video>` element, plus a batteries-included React subpath.

> **Status**: early-stage (`0.0.1`). Public API is unstable; expect breaking changes between patch versions until `0.1.0`.

---

## Features

- **Native `<video>` core** — HLS/DASH-ready (point `src` at any source your browser or `hls.js` attachment can play)
- **Full control bar** — play/pause, seek, buffered indicator, volume, speed, fullscreen
- **Custom subtitle overlay** — WebVTT tracks rendered as a styled overlay with four font sizes
- **Quality + audio-track switching** via a nested settings panel
- **Speed control** — 0.25× → 2×
- **Google Cast** — Chromecast session handling with remote-player mirroring
- **Keyboard shortcuts** — space/`k`, `←`/`→` (±10s), `↑`/`↓` (volume), `m`, `f`, `Esc`
- **Auto-hiding controls** with controlled/uncontrolled visibility
- Framework-agnostic core: Zustand vanilla store, no React imports below `react/`
- Strict TypeScript throughout

---

## Install

```bash
pnpm add @kuraykaraaslan/kui-videoplayer react react-dom
```

`react` and `react-dom` are **optional peerDependencies** — only required if you import from `@kuraykaraaslan/kui-videoplayer/react`. `zustand` ships as a direct dependency.

---

## Quick start — React

```tsx
import { VideoPlayer } from "@kuraykaraaslan/kui-videoplayer/react";
import "@kuraykaraaslan/kui-videoplayer/styles.css";

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

## Quick start — vanilla TypeScript

The `VideoPlayerEngine` attaches to any `HTMLVideoElement` and drives a Zustand vanilla store — no React dependency, mirroring the role of the `Viewer` class in [`@kuraykaraaslan/kui-viewer`](https://www.npmjs.com/package/@kuraykaraaslan/kui-viewer).

```ts
import { VideoPlayerEngine } from "@kuraykaraaslan/kui-videoplayer";

const video = document.querySelector("video")!;
const engine = new VideoPlayerEngine({ startMuted: true, autoHideControls: true });

engine.attach(video);

engine.togglePlay();
engine.seekBy(10);        // +10s
engine.setVolume(0.5);
engine.setSpeed(1.5);

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

## Exports

| Specifier | Contents |
|---|---|
| `@kuraykaraaslan/kui-videoplayer` | Vanilla core: `VideoPlayerEngine`, `createVideoPlayerStore`, `formatTime`, constants (`SPEEDS`, `SUBTITLE_SIZES`), and all types |
| `@kuraykaraaslan/kui-videoplayer/react` | React `<VideoPlayer />` plus hooks (`useVideoPlayerEngine`, `useVideoPlayerStore`) |
| `@kuraykaraaslan/kui-videoplayer/styles.css` | Compiled Tailwind v4 tokens. Import once at the app root |

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
- `react/` — React subpath: `<VideoPlayer />`, control parts, settings panels, and hooks (cast, fullscreen, subtitle cues, keyboard).
- `libs/` — cross-cutting utilities (`cn()`).
- `src/` — Vite dev playground (not bundled into the published package).
- `scripts/` — build helpers (`build-css.mjs`).

---

## License

[Apache-2.0](./LICENSE) © 2026 Kuray Karaaslan
