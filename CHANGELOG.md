# @kuraykaraaslan/kui-player

## 0.1.0

The first release with a stable API. Everything below happened between `0.0.2`
and here; the [roadmap](./phases) records why in the order it was done.

### Before the changelog started

Three phases of work predate the changeset log and are summarised here so an
upgrade from `0.0.2` is not a surprise:

- **Stabilization.** A broken source used to spin forever: the engine never
  listened for `error`. There is now an error overlay with a retry button and
  backed-off automatic retries for network failures. The store became a mirror
  of the `<video>` element — `volumechange`, `ratechange`, `seeking`/`seeked`,
  `loadedmetadata`, `loadstart`, `emptied` and `stalled` are all handled — so
  mutating the element from outside stays in sync. Quality changes keep their
  position, play state, rate and volume. `playsInline` defaults on, which is
  what makes iOS Safari play in the page instead of its own fullscreen player.
  Four unused hooks (~224 lines) were deleted.
- **Playback compatibility.** HLS and DASH through adapters you supply
  (`createHlsAdapter`, `createDashAdapter`) — neither library is bundled.
  Renditions fill the quality menu with an **Auto** entry; audio-track switching
  actually switches; Picture-in-Picture; touch gestures; and a fullscreen
  capability chain that ends in an emulated container, the only way iPhone
  Safari keeps our chrome.
- **Bundle and integration.** FontAwesome (four packages) replaced by inline
  SVGs, Tailwind output replaced by one scoped stylesheet themed through
  `--kui-*` custom properties, and the settings panel, About dialog and Cast
  integration moved into lazy chunks. The embed went from 105.7 kB to 28.3 kB
  gzipped; budgets are enforced by `pnpm size`.

**Breaking, from that work:** `styles.css` is no longer Tailwind output and its
import is optional (the component injects its own); `clsx` and `tailwind-merge`
are no longer dependencies; CSS written against the old utility classes must
move to the `--kui-*` properties. See
[Upgrading to 0.1.0](./README.md#upgrading-to-010) for the full list.

### Minor Changes

- 9e1b1ef: Accessibility, tests and CI — the `0.1.0` release gate.
  
  - Full keyboard operation with a trapped, restorable focus path through the
    settings menu and About dialog; the controls no longer auto-hide while they
    hold focus.
  - The seek bar is a real slider: arrow/page/home/end seeking, and a spoken
    position (`2:14 of 4:20`) instead of a bare percentage.
  - A polite live region announces play state, quality, subtitle and audio
    changes, fullscreen, Picture-in-Picture, Cast and errors.
  - Contrast raised to WCAG AA across the chrome; `prefers-reduced-motion` honoured.
  - A `<source>` child that 404s now surfaces the error overlay — browsers fire
    that error on the source element, not the video, so it used to spin forever.
  - Adapter-published audio tracks are no longer wiped when the element reports
    none of its own.
  - Touch gestures moved into a lazy chunk loaded only on coarse pointers.
  
  **Breaking:** the store's `seekHoverX` (pixels) is now `seekHoverRatio` (0–1),
  and `useTouchGestures` is no longer exported from `/react`.
- 75db364: The features a comparison table asks about — and zero runtime dependencies.
  
  - **Chapters** from a WebVTT sidecar: segmented seek bar, the section name under
    the pointer, and a jump list in the menu.
  - **Seek previews** from a WebVTT storyboard, sprite sheets included.
  - **Playlists** with a cancellable "up next" card.
  - **Live and DVR**: detected from the source, with a LIVE badge that is red at
    the edge and grey behind it, and a seek bar spanning the DVR window.
  - **Resume and preferences**, off by default, offered rather than applied.
  - **Media Session** for OS media controls, and **AirPlay** where Safari offers it.
  - **SRT and ASS subtitles**, plus caption colour, background, edge and font.
  - **A local analytics API** — `engine.on()` with quartiles, rebuffer count and
    duration, startup time and time to first frame. Nothing is sent anywhere.
  - **Six languages with RTL** (`en`, `tr`, `de`, `es`, `fr`, `ar`) in their own
    entry point, with localised durations.
  - **Theme presets and slots** for composing your own controls into the chrome.
  - **Vue and Svelte wrappers**, and `<kui-player>` as a custom element.
  
  **`zustand` is gone**: the store is now ~60 lines in-tree, bound to React with
  `useSyncExternalStore`. `engine.store` keeps the same shape, and the package has
  no `dependencies` at all.
- ab9c8eb: Skin mode as a product, Cast as a real target, and a privacy guarantee with a test
  behind it.
  
  - **Skin mode**: `skinAll()` dresses every `<video>` a page already has and keeps
    watching for more; the element's own controls are taken over and restored on
    unmount; `window.kuiPlayer` auto-starts from `data-*` attributes on its own
    script tag, so a no-build page needs one line. New `/skin` entry point for
    bundler users, a demo page, and a WordPress plugin.
  - **Cast**: queues with next/previous, custom receiver app ids, subtitle tracks
    handed to the receiver (and kept in sync while connected), a position-preserving
    handoff back to local playback when the session ends, and a visible failure state.
  - **Privacy**: the player makes no request beyond your media and writes nothing to
    browser storage, enforced by an end-to-end test that records every request.
    `enableCast` now defaults to `false`, because enabling it loads Google's sender
    SDK — the one documented exception.
  - **For assistants**: `llms.txt`, `llms-full.txt` and five copy-pasteable recipes,
    served as plain files from the demo deployment.
  - **Fixed**: theme custom properties set on an ancestor were ignored, because the
    stylesheet redeclared them on the player element. Tokens are now read as inputs
    with fallbacks, so `--kui-accent` works from anywhere above the player.
  
  **Breaking:** `enableCast` defaults to `false`; the embed global is `window.kuiPlayer`
  (`window.__tepegozVideoPlayer` still works and is deprecated).

### Patch Changes

- 708ebf5: The About dialog now shows the version that was actually built, injected from
  `package.json` at build time instead of a hard-coded literal that would go stale
  on the next release.
