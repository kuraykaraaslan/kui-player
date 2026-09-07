---
"@kuraykaraaslan/kui-player": minor
---

Skin mode as a product, Cast as a real target, and a privacy guarantee with a test
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
