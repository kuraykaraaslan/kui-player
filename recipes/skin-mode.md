# Skin mode — bring your own `<video>`

Put the player's chrome on a video the page already owns. The element keeps its source
and its pipeline (progressive, hls.js, MSE, blob); only the controls change.

## One script tag, no build step

```html
<video id="clip" src="/media/talk.mp4" poster="/media/talk.jpg" controls></video>

<script
  src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"
  data-auto="video"
  data-accent="#f97316"
></script>
```

That is the whole integration. The bundle reads its configuration from its own tag:

| Attribute | Default | Meaning |
|---|---|---|
| `data-auto` | — | CSS selector to skin. Present but empty means `video` |
| `data-accent` | theme default | any CSS colour; becomes `--kui-accent` |
| `data-autohide` | `true` | hide the controls after inactivity while playing |
| `data-keyboard` | `true` | keyboard shortcuts while the pointer is over the player |
| `data-observe` | `true` | keep skinning videos added later (single-page apps) |
| `data-cast` | `false` | show the Cast button — loads Google's sender SDK |
| `data-speed` | — | playback rate to apply on mount |

## From JavaScript

```js
const skins = kuiPlayer.skinAll("article video", { accent: "#f97316" });
skins.count;      // how many are skinned right now
skins.refresh();  // pick up anything added since
skins.stop();     // remove every skin and restore the native controls

kuiPlayer.mount(document.querySelector("#clip"));   // just this one
kuiPlayer.unmount(document.querySelector("#clip"));
```

## From a bundler

```ts
import { mountSkin, skinAll } from "@kuraykaraaslan/kui-player/skin";

const unmount = mountSkin(document.querySelector("video")!, { accent: "#f97316" });
```

## What it does to the page

- Renders into a shadow root, so the host page's CSS cannot reach the controls and the
  controls cannot leak into the page.
- Hides the element's own `controls` while skinned and restores the attribute exactly as
  it found it on unmount.
- Tracks the *visible* player box rather than the raw element size, which is what keeps
  the overlay aligned inside letterboxed third-party players.
- Never touches the media pipeline: no source rewriting, no `load()`, no MSE takeover.
