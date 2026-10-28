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
| `data-live` | — | live behaviour for every skinned video: bare / `true` says "live", `false` / `off` turns the live behaviours off, JSON gives options (`'{"dvr":true}'`) |
| `data-load-on-play` | `false` | hold an adapter-managed source back until Play (no effect on the page's own pipeline) |
| `data-presence-every-ms`, `data-presence-grace-ms` | — | both: make the **page's "Still watching?" group** (below) |
| `data-presence` | — | `off`: no page group, and skinned videos stay out of one |

## From JavaScript

```js
const skins = kuiPlayer.skinAll("article video", { accent: "#f97316" });
skins.count;      // how many are skinned right now
skins.refresh();  // pick up anything added since
skins.stop();     // remove every skin and restore the native controls

kuiPlayer.mount(document.querySelector("#clip"));   // just this one
kuiPlayer.unmount(document.querySelector("#clip"));
```

## Live streams and "Still watching?"

Skin mode takes the same live-stream options as the React player. Live is detected from the
element (an unbounded duration), so `live` is only a hint and a way to say `dvr`:

```js
kuiPlayer.skinAll("video.camera", { live: true, loadOnPlay: true });
```

A page full of cameras should ask "Still watching?" **once**. Make one group for the page, with its
one prompt, before the players are skinned, and every skinned video joins it:

```html
<script src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"
        data-auto="video.camera"
        data-live
        data-presence-every-ms="600000"
        data-presence-grace-ms="30000"></script>
```

or from JavaScript:

```js
kuiPlayer.setPagePresence({ everyMs: 600_000, graceMs: 30_000 });   // creates the group and its prompt
kuiPlayer.skinAll("video.camera");

kuiPlayer.setPagePresence({ everyMs: 600_000, graceMs: 30_000, locale: myDictionary, prompt: true });
kuiPlayer.getPagePresence();           // the group, or null
kuiPlayer.setPagePresence(null);       // remove it (and its prompt)
const own = kuiPlayer.createPagePresenceGroup({ everyMs: 60_000, graceMs: 10_000 });  // not the default
kuiPlayer.mount(video, { presence: own });
```

When nobody answers, every `<video>` is paused together. An adapter you gave through `adapters`
also stops loading; a pipeline the page owns is not told, so it may keep buffering. A single video keeps out of the group with a
`data-kui-presence="off"` attribute on the element, or `{ presence: false }`; `{ presence: { everyMs, graceMs } }`
gives it a check of its own, asked inside the player. `prompt: false` leaves the prompt out so
you can place it yourself.

Options added to `SkinOptions` (all optional; leave them out and skin mode behaves as before):

| Option | |
|---|---|
| `live` | `true` / `{ dvr?, stopWhenHidden?, reauth?, credentials? }` / `false` |
| `presence` | `{ everyMs, graceMs }`, a `PresenceGroup`, or `false` |
| `loadOnPlay` | hold an adapter-managed source back until the first play |
| `locale` | a dictionary for the controls and the presence prompt |
| `on` | engine events by name: `{ "presence:ask": …, "live:reconnect": …, error: … }` |
| `adapters`, `src` | open `src` through `createHlsAdapter(...)`; the element should have no `src` of its own |
| `sources`, `preferAlternateInFullscreen`, `onSourceChange` | "Standard" / "High" in the quality menu |

`mountSkin` returns the function that unmounts, which also carries `.engine` and
`.update({ live, presence, loadOnPlay })` to change those three without a remount.

Two of the options reach into the pipeline, and only when you pass them: `adapters` (the skin
opens the source) and `sources` (the skin sets the element's `src` when the viewer picks another
address). A page whose own hls.js already feeds the element should pass neither and keep
the guarantee below.

`<kui-player>` takes the same options as attributes (`live`, `presence`, `presence-every-ms`,
`presence-grace-ms`, `load-on-play`, `sources`, `prefer-alternate-in-fullscreen`), properties
(`adapters`, `sources`, `live`, `presence`, `locale`) and `kui-*` events — see
[wrappers](../wrappers/README.md).

## From a bundler

```ts
import { mountSkin, skinAll } from "@kuraykaraaslan/kui-player/skin";

const unmount = mountSkin(document.querySelector("video")!, { accent: "#f97316" });

// a page-level "Still watching?" group, as above
import { setPagePresence, createPagePresenceGroup, mountPresencePrompt, createPresenceGroup } from "@kuraykaraaslan/kui-player/skin";
setPagePresence({ everyMs: 600_000, graceMs: 30_000 });
```

`createPresenceGroup` plus `mountPresencePrompt(group, { locale?, injectStyles? })` is the
group and the prompt separately; `createPagePresenceGroup` is the two together.

## What it does to the page

- Renders into a shadow root, so the host page's CSS cannot reach the controls and the
  controls cannot leak into the page.
- Hides the element's own `controls` while skinned and restores the attribute exactly as
  it found it on unmount.
- Tracks the *visible* player box rather than the raw element size, which is what keeps
  the overlay aligned inside letterboxed third-party players.
- Never touches the media pipeline: no source rewriting, no `load()`, no MSE takeover — unless
  you pass `adapters` or `sources`, which are how a skin is asked to open a source itself.
