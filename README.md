# kui-player

[![npm](https://img.shields.io/npm/v/@kuraykaraaslan/kui-player.svg)](https://www.npmjs.com/package/@kuraykaraaslan/kui-player)
[![license](https://img.shields.io/npm/l/@kuraykaraaslan/kui-player.svg)](./LICENSE)

**A video player chrome you can put on any `<video>` element — including one your page already has.** One `<script>` tag dresses the videos a site already renders, without touching how they are delivered. Cast-first, zero-telemetry, ~20 kB.

It is not another general-purpose player framework. It is the controls layer: accessible, themeable through CSS custom properties, and mountable over a `<video>` that some other pipeline (progressive, hls.js, MSE, blob) is already feeding. Use it as a React component, as a vanilla engine, or as a skin over markup you do not control.

```html
<!-- every <video> on the page, dressed, no build step -->
<script src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"
        data-auto="video" data-accent="#f97316"></script>
```

> **Status**: `0.1.0` — the first release with a stable API. Phases 0–5 of the
> [roadmap](./phases) are done: it is tested, accessible, budgeted and dependency-free.
> Coming from `0.0.x`? See [Upgrading to 0.1.0](#upgrading-to-010).

---

## Features

- **Skin mode** — adopt a `<video>` the page already owns; the media pipeline is untouched
- **Zero external requests** — no telemetry, no fonts, no CDN icons, nothing in browser storage; [proven by a CI test](#privacy)
- **Cast as a real target** — queue, custom receiver, subtitle hand-off, and a position-preserving return to local playback
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
- **19.6 kB gzipped** React subpath, **28 kB** single-file embed — budgets enforced in the build
- **No runtime dependencies at all**, no CSS framework, no icon font
- **Themed with CSS custom properties** — `--kui-accent` and friends, scoped to `.kui-player`
- **Bring your own icons** — `icons={{ play: <MyIcon /> }}`
- **Accessible by default** — full keyboard operation, focus trapping, a live region, AA contrast, axe-clean
- **Chapters, storyboards, playlists, live/DVR** and OS media controls
- **Six locales with RTL**, and localised durations
- **A local analytics API** — quartiles, rebuffers, startup time; measured here, sent nowhere
- **Zero runtime dependencies**
- Framework-agnostic core: Zustand vanilla store, no React imports below `react/`
- Strict TypeScript throughout, tested with Vitest + Playwright

---

## Skin mode — bring your own `<video>`

The differentiator, and the reason this library exists separately from the players it
sits next to: **kui-player can take over a `<video>` element it did not create.**

```html
<video id="clip" src="/media/talk.mp4" poster="/media/talk.jpg" controls></video>

<script src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"
        data-auto="video"></script>
```

That is the whole integration: no markup changes, no build step, no re-encoding, no
change to how the media is delivered. The element keeps its source and its pipeline —
progressive, hls.js, MSE, blob — and only the controls change.

- Renders into a **shadow root**, so the host page's CSS cannot reach the controls and
  the controls cannot leak into the page.
- **Hides the element's own controls** while skinned and restores them exactly on unmount.
- Tracks the **visible player box**, not the raw element size, which is what keeps the
  overlay aligned inside letterboxed third-party players.
- Keeps skinning videos that appear later, for single-page apps.

From JavaScript, or from a bundler:

```js
const skins = kuiPlayer.skinAll("article video", { accent: "#f97316" });
skins.stop();   // every skin removed, native controls back
```

```ts
import { mountSkin, skinAll } from "@kuraykaraaslan/kui-player/skin";
```

There is a [live demo](./skin.html), a [recipe](./recipes/skin-mode.md), and a
[WordPress plugin](./wordpress/kui-player) that applies it site-wide.

---

## Privacy

**The player makes no network request other than the media you point it at.** No
telemetry, no fonts, no CDN-hosted icons, no analytics, and nothing written to
`localStorage`, `sessionStorage` or cookies.

Google Cast is the single exception: enabling it loads Google's sender SDK from
`gstatic.com`. That is why `enableCast` defaults to **off** — you opt into the one
request the library can make.

This is not a slogan. `tests/e2e/privacy.spec.ts` drives the player through playback,
the settings menu, subtitles and the About dialog while recording every request, and
fails if anything leaves the page's own origin. It runs in CI on every pull request.

---

## Casting

Cast is treated as a real playback target rather than a bolt-on:

```tsx
<VideoPlayer
  src={video.mp4}
  enableCast
  castQueue={[
    { src: episodeOne, title: "Episode 1", poster: posterOne },
    { src: episodeTwo, title: "Episode 2", poster: posterTwo, startTime: 30 },
  ]}
  castReceiverAppId="ABCD1234"
/>
```

- **Queues** — the receiver owns the playlist; the overlay shows the position and moves
  through it.
- **Custom receiver app id** — brand the TV side.
- **Subtitles follow the session** — track lists go with the media, and changing the
  subtitle while connected is sent to the receiver, not to a `<video>` nobody is watching.
- **Handoff back** — when the session ends, local playback resumes at the position the
  receiver reached, playing if it was playing.
- **Failure is visible** — a blocked SDK or a refused session surfaces as a message
  instead of a button that silently does nothing.

Everything Cast-related lives in a lazy chunk, so `enableCast={false}` (the default)
downloads none of it.

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
import Hls from "hls.js";                          // your dependency, not ours
import { createHlsAdapter } from "@kuraykaraaslan/kui-player";
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

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

That is the whole setup: the player injects its own stylesheet on first render.

---

## Styling and theming

The player ships a **single scoped stylesheet**. Every rule lives under `.kui-player` and
every class is `kui-`-prefixed, so it cannot collide with your CSS, and it needs no
framework of its own — it works the same in a Tailwind app, a CSS-modules app, or an app
with no styling stack at all.

Theme it by setting custom properties on the player **or on any ancestor** — the
stylesheet reads the public tokens rather than redeclaring them, so an inherited value
actually wins:

```css
.my-player {
  --kui-accent: #e11d48;
  --kui-radius: 4px;
  --kui-control-size: 2.5rem;
  --kui-font: "Inter", system-ui, sans-serif;
}
```

```tsx
<VideoPlayer src={src} className="my-player" />
```

| Property | Default | Controls |
|---|---|---|
| `--kui-accent` | `#3b82f6` | progress fill, selected menu entries, active buttons |
| `--kui-bg` | `#000` | the letterbox behind the video |
| `--kui-surface` | `rgba(0,0,0,.9)` | settings panel |
| `--kui-surface-raised` | `#16181d` | About dialog |
| `--kui-text` / `--kui-text-muted` / `--kui-text-faint` | white ramp | typography |
| `--kui-border` | `rgba(255,255,255,.12)` | panel borders |
| `--kui-radius` / `--kui-radius-sm` | `12px` / `6px` | corner rounding |
| `--kui-control-size` / `--kui-control-size-primary` | `2rem` / `2.25rem` | button hit areas |
| `--kui-icon-size` | `0.875rem` | icon scale |
| `--kui-font` / `--kui-font-size` | `inherit` / `0.875rem` | typography |
| `--kui-scrim` | gradient | the fade behind the controls |
| `--kui-focus` | `#fff` | focus ring |

In skin mode the same tokens are set through the `accent` option or `data-accent`.

**Where the CSS comes from.** `<VideoPlayer>` injects it once per document, before first
paint, and repeated players share the one `<style>` element. If you would rather link it
yourself — a strict CSP, or to keep the head under your control — import the stylesheet
and turn injection off:

```tsx
import "@kuraykaraaslan/kui-player/styles.css";

<VideoPlayer src={src} injectStyles={false} />;
```

`PLAYER_CSS` is also exported as a string for inlining, and `injectPlayerStyles(root)`
takes a `ShadowRoot` if you are mounting inside one.

**Icons** are inline SVG (about a kilobyte for the whole set). Replace any of them:

```tsx
<VideoPlayer src={src} icons={{ play: <MyPlay />, pause: <MyPause /> }} />
```

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

Optionally link the stylesheet from the root layout:

```tsx
// app/layout.tsx
import "@kuraykaraaslan/kui-player/styles.css";   // optional, see Styling and theming
```

Injecting styles from the client (the default) means server-rendered markup paints
unstyled for one frame; linking the stylesheet in the root layout and passing
`injectStyles={false}` avoids that.

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
| `chapters` | `string \| Chapter[]` | WebVTT chapters file, or the chapters themselves |
| `thumbnails` | `string` | WebVTT storyboard for seek previews |
| `playlist` / `playlistIndex` / `onPlaylistIndexChange` / `playlistCountdown` | — | play through a list |
| `persist` | `boolean \| PersistOptions` | remember position and preferences; **off by default** |
| `mediaSession` | `boolean` | OS media controls, default `true` |
| `locale` | `PartialDictionary` | see [Languages](#languages) |
| `theme` | `'minimal' \| 'broadcast' \| 'cinema'` | token presets |
| `slots` | `PlayerSlots` | your nodes inside the chrome |
| `enableCast` | `boolean` | defaults to **`false`** — enabling it loads Google's Cast SDK from gstatic.com |
| `castQueue` | `CastQueueItem[]` | cast a playlist; the receiver owns the queue |
| `castReceiverAppId` | `string` | custom receiver application id |
| `enablePictureInPicture` | `boolean` | defaults to `true`; the button hides itself where PiP is unsupported |
| `gestures` | `boolean \| GestureOptions` | touch gestures, see [Touch gestures](#touch-gestures) |
| `autoFullscreenOnLandscape` | `boolean` | fullscreen when a phone rotates while playing |
| `preferNativeIosFullscreen` | `boolean` | use the iOS OS player instead of emulated fullscreen |
| `onCastStateChange` | `(state: CastState) => void` | cast lifecycle |
| `className` | `string` | root element class |
| `icons` | `IconOverrides` | replace any built-in glyph |
| `injectStyles` | `boolean` | defaults to `true`; `false` if you link `styles.css` yourself |

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
| `@kuraykaraaslan/kui-player/react` | React `<VideoPlayer />`, hooks (`useVideoPlayerEngine`, `useVideoPlayerStore`, `useTouchGestures`), `Icon`/`IconProvider`, `PLAYER_CSS` |
| `@kuraykaraaslan/kui-player/skin` | `mountSkin`, `skinAll`, `defineKuiPlayer` — skin mode and the custom element |
| `@kuraykaraaslan/kui-player/locales` | `tr`, `de`, `es`, `fr`, `ar` |
| `@kuraykaraaslan/kui-player/wrappers/vue` | `<KuiPlayer>` for Vue 3 |
| `@kuraykaraaslan/kui-player/wrappers/svelte` | the `kuiPlayer` action for Svelte 5 |
| `@kuraykaraaslan/kui-player/styles.css` | The player stylesheet, if you would rather link it than let the component inject it |
| `dist/embed.js` | The single-script build: installs `window.kuiPlayer` and auto-starts from `data-*` attributes |

---

## Beyond playback

| Feature | Prop | Notes |
|---|---|---|
| **Chapters** | `chapters` | A WebVTT `chapters` file or an array. Segments the seek bar, names the section under the cursor, and adds a jump list to the menu |
| **Seek previews** | `thumbnails` | A WebVTT storyboard, sprite sheets (`#xywh=`) included |
| **Playlists** | `playlist` | Advances at the end with an "up next" card the viewer can cancel; `playlistCountdown={0}` skips the wait |
| **Live and DVR** | — | Detected from the source. The clock becomes a LIVE badge — red at the edge, grey behind it, click to catch up — and the bar spans the DVR window |
| **Resume and preferences** | `persist` | **Off by default.** Volume, speed, subtitle language and size are remembered across sources; position is offered, never forced |
| **OS media controls** | `mediaSession` | Lock screen, media keys, notification shade. On by default; no network involved |
| **AirPlay** | — | The button appears only once Safari reports a target |
| **SRT and ASS subtitles** | `subtitles` | Fetched and timed by the player, since browsers load neither. Parsers arrive with the file |
| **Caption styling** | — | Colour, background opacity, edge style and font, per CVAA expectations |
| **Themes** | `theme` | `minimal`, `broadcast`, `cinema`, or your own tokens |
| **Slots** | `slots` | Your nodes at `top`, `aboveControls`, `controlsStart`, `controlsEnd` |

---

## Analytics without telemetry

Everything a QoE pipeline wants is measured locally and handed to you. Nothing
leaves the page unless you send it.

```ts
engine.on('ready', ({ startupMs, timeToFirstFrameMs }) => report(…));
engine.on('stall', ({ count, durationMs, totalMs }) => report(…));
engine.on('quartile', ({ percent }) => report(…));   // 25 / 50 / 75 / 100
engine.on('error', (error) => report(error.name));
```

Also emitted: `play`, `pause`, `seeking`, `seeked`, `ratechange`, `volumechange`,
`qualitychange`, `audiotrackchange`, `sourcechange` and `complete`. Every
subscription returns an unsubscribe function, and a listener that throws cannot
break playback.

---

## Languages

```tsx
import { tr } from "@kuraykaraaslan/kui-player/locales";

<VideoPlayer src={src} locale={tr} />;
```

Bundled: **English, Turkish, German, Spanish, French and Arabic** — the whole set
is 3.9 kB gzipped and lives in its own entry point, so a player left in English
carries none of it. A partial dictionary is fine; anything it omits falls back to
English:

```tsx
<VideoPlayer src={src} locale={{ play: "Spielen", dir: "ltr" }} />
```

`dir: 'rtl'` mirrors the control row, the menus and the seek bar, and durations
are rendered in the locale's numbering system.

---

## Accessibility

The player is operable without a mouse and audible without a screen.

- **Every control is reachable by `Tab`** and shows a visible focus ring. While
  focus is inside the player the controls never auto-hide — tabbing to a faded-out
  button is a bug, not a feature.
- **The seek bar is a real slider**: `←`/`→` nudge by 5 s, `PageUp`/`PageDown` by
  10 %, `Home`/`End` jump to the ends, and it announces its position as
  *"2:14 of 4:20"* rather than a meaningless percentage.
- **The settings menu and the About dialog trap focus**, close on `Esc`, and hand
  focus back to the control that opened them.
- **A polite live region** announces what a sighted viewer can see: playing,
  paused, muted, quality, subtitle and audio-track changes, fullscreen, PiP,
  Cast, and errors. The clock is deliberately *not* announced.
- **Contrast** across the chrome meets WCAG AA (4.5:1), including the subtitle
  overlay and the muted text ramps.
- **`prefers-reduced-motion`** collapses the transitions and slows the spinner.

`pnpm test` runs an axe-core scan over the player at rest, with the menu open,
with the dialog open and in its error state; all four must come back clean.

---

## Bundle size

Budgets are enforced by `pnpm size` (and in CI); a build that busts one fails.

| Bundle | gzip | budget |
|---|---|---|
| `dist/index.js` — vanilla core | 11.9 kB | 12.5 kB |
| `dist/react/*` — React subpath, first load | 25.9 kB | 27 kB |
| …plus every lazy chunk | 32.5 kB | 34 kB |
| `dist/embed.js` — single-file embed | 36.9 kB | 39 kB |
| `dist/skin/*` — skin mode for bundlers | 27.0 kB | 28.5 kB |
| `dist/locales/index.js` — all six languages | 3.9 kB | 6 kB |
| `dist/styles.css` | 5.0 kB | 5.5 kB |

Four things are deliberately **not** in the first load, each a separate chunk:

| Chunk | Downloaded when |
|---|---|
| Settings panel | the viewer opens the menu |
| About dialog | the viewer opens it from the menu |
| Google Cast | `enableCast` is on — never with `enableCast={false}` |
| Touch gestures | the device reports a coarse pointer |

So a desktop player with Cast off ships neither the Cast SDK plumbing nor the gesture
engine, and a phone loads the gestures right after first paint.

The single-file embed renders with [Preact](https://preactjs.com/) through `preact/compat`
— react-dom alone is more than the entire size budget for a set of video controls. This
applies to `dist/embed.js` only; the React subpath uses your React.

---

## Stack

- [React](https://react.dev/) 18 / 19 (optional peer, only for the `/react` subpath)
- [Google Cast Web SDK](https://developers.google.com/cast/docs/web_sender) (Chromecast, loaded by the page only when you enable Cast)
- Everything else — the store, icons, styles, parsers, class-name helper — is in-tree

> **No runtime dependencies.** The store is about sixty lines of `getState` /
> `setState` / `subscribe`, bound to React with `useSyncExternalStore`. It keeps the
> shape zustand had, so `engine.store` still works the way it always did — there is
> simply nothing left in `dependencies` to install, audit or deduplicate.

---

## Upgrading to 0.1.0

`0.0.x` was pre-release; these are the breaking changes on the way to `0.1.0`.

| Change | Migration |
|---|---|
| The player ships its own scoped stylesheet instead of Tailwind output | Importing `styles.css` is now optional. Remove it, or keep it and pass `injectStyles={false}`. Any CSS you wrote against the old utility classes must move to the `--kui-*` custom properties |
| FontAwesome is gone | Nothing to do unless you relied on the icon markup; swap glyphs with the `icons` prop |
| `clsx` and `tailwind-merge` are no longer dependencies | Remove them if you installed them for this package |
| Store field `seekHoverX` (pixels) → `seekHoverRatio` (0–1) | Only affects code reading the store directly; multiply by the bar width if you need pixels |
| `useTouchGestures` is no longer exported from `/react` | It is loaded internally on touch devices; there is no supported way to call it directly |
| Adapters (`createHlsAdapter`, `createDashAdapter`) are exported from the package root, not `/react` | `import { createHlsAdapter } from "@kuraykaraaslan/kui-player"` |
| `audioTracks` no longer needs a prop to work | Tracks are discovered from the element or the adapter; the prop is a fallback for sources that expose none |
| `enableCast` now defaults to `false` | Pass `enableCast` explicitly. The default keeps the zero-external-request guarantee intact |
| The embed's global is `window.kuiPlayer` | `window.__tepegozVideoPlayer` still points at the same object, but is deprecated |

New since `0.0.2`: HLS/DASH adapters, real audio-track switching, Picture-in-Picture,
touch gestures, iOS fullscreen, an error surface with retry, and the accessibility work
above.

---

## For AI assistants

[`llms.txt`](./llms.txt) and [`llms-full.txt`](./llms-full.txt) describe the whole API
surface in one fetch, and the [recipes](./recipes) are copy-pasteable integrations for
Next.js, Vite, hls.js, skin mode and WordPress. Both are served as plain files from the
demo deployment, alongside the markdown docs.

---

## Development

```bash
pnpm install
pnpm dev            # Vite playground at http://localhost:5173
pnpm build          # JS + .d.ts + styles.css + embed → dist/
pnpm test           # unit + component tests (Vitest, jsdom, axe-core)
pnpm test:e2e       # Playwright, against tests/e2e/app
pnpm size           # enforce the gzip budgets in package.json
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit against the library config
pnpm check:package  # publint + arethetypeswrong on the packed tarball
pnpm check:release  # build, then prove the built package loads and fits its budgets
```

CI runs all of the above on every pull request, plus the end-to-end suite across
Chromium, Firefox, WebKit and a mobile emulation. See
[CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Project layout

- `modules/` — vanilla core (engine, store, adapters, format, constants, types). No React imports.
- `react/` — React subpath: `<VideoPlayer />`, control parts, settings panels, and hooks (cast, subtitle cues, keyboard, touch gestures).
- `libs/` — cross-cutting utilities (`cn()`).
- `react/icons/` — the inline SVG icon set (and the override mechanism).
- `react/styles/` — `player.css`, the one stylesheet, plus its injection helpers.
- `src/` — Vite dev playground (not bundled into the published package).
- `tests/` — unit and component tests, plus the end-to-end harness in `tests/e2e/app`.
- `embed/` — skin mode: `mountSkin`, `skinAll`, and the single-script bundle entry.
- `recipes/` — copy-pasteable integrations, also served from the demo.
- `wordpress/` — the WordPress plugin that applies skin mode site-wide.
- `scripts/` — build helpers (`build-css.mjs`, `check-size.mjs`).
- `phases/` — the roadmap: what is built, what is next, and why.

---

## License

[Apache-2.0](./LICENSE) © 2026 Kuray Karaaslan
