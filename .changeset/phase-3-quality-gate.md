---
"@kuraykaraaslan/kui-player": minor
---

Accessibility, tests and CI — the `0.1.0` release gate.

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
