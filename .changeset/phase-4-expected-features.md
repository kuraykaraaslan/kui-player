---
"@kuraykaraaslan/kui-player": minor
---

The features a comparison table asks about — and zero runtime dependencies.

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
