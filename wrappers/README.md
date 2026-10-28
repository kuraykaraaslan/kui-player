# Framework wrappers

The chrome is React, but nothing that uses it has to be. Each wrapper hands a
plain `<video>` — one the framework itself renders — to skin mode, so the
element stays a real media element with its own `src`, events and methods.

| Framework | What to use |
|---|---|
| React | `@kuraykaraaslan/kui-player/react` — the real component, not a wrapper |
| Vue 3 | `@kuraykaraaslan/kui-player/wrappers/vue` ([source](./vue/KuiPlayer.ts)) |
| Svelte 5 | `@kuraykaraaslan/kui-player/wrappers/svelte` ([source](./svelte/kuiPlayer.ts)) — an action |
| Angular, Solid, Qwik, plain HTML | `<kui-player>`, the custom element |

All of them take the same options as the React `<VideoPlayer>` for live streams, the
"Still watching?" check and alternate sources, spelled the way the framework spells things:

| Option | What it does |
|---|---|
| `live` | `true` / `{ dvr?, stopWhenHidden?, reauth?, credentials? }` says the source is live; `false` turns the live behaviours off |
| `presence` | `{ everyMs, graceMs }` for this player, a `PresenceGroup`, or `false` to stay out of the group |
| `loadOnPlay` | hold an HLS source back until the first play |
| `adapters` | `createHlsAdapter(...)` and friends, to open `src` / `sources` |
| `sources`, `preferAlternateInFullscreen` | "Standard" / "High" in the quality menu; the second in fullscreen on request |
| `locale` | a dictionary for the controls and the presence prompt |

> **Skin mode normally leaves the media pipeline alone** — the page's own hls.js or
> `<video src>` keeps feeding the element. Two of these options touch it, and only when
> you give them: `adapters` (the skin opens the source through your adapter) and
> `sources` (the skin sets the element's source when the viewer picks another).
> `live`, `presence` and `loadOnPlay` never do.

The live-stream options need the adapter to see the playlist, so for HLS pass `adapters`
and **let the wrapper open the source**: the `<video>` is rendered without a `src` of its own
when an adapter claims it, so the two never race.

```ts
import Hls from "hls.js";
import { createHlsAdapter } from "@kuraykaraaslan/kui-player";
const adapters = [createHlsAdapter({ Hls })];   // once, outside any render
```

## Vue

```vue
<script setup lang="ts">
import { KuiPlayer } from "@kuraykaraaslan/kui-player/wrappers/vue";
</script>

<template>
  <KuiPlayer src="/media/talk.mp4" poster="/media/talk.jpg" accent="#f97316" />
</template>
```

### Live streams, props and events

```vue
<KuiPlayer
  :src="camera.src"
  :adapters="adapters"
  live
  load-on-play
  :presence="{ everyMs: 600_000, graceMs: 30_000 }"
  @live-reconnect="({ attempt, reason }) => log(attempt, reason)"
  @error="(e) => e.name === 'LIVE_REFUSED' && showQuota(e.detail)"
/>
```

| Prop | Type | |
|---|---|---|
| `src` | `string` | optional when `sources` gives the addresses |
| `live` | `boolean \| LiveOptions` | `live`, `:live="{ dvr: true }"`, `:live="false"` |
| `presence` | `{ everyMs, graceMs } \| PresenceGroup \| false` | `false` stays out of the nearest `<PresenceGroupProvider>` |
| `load-on-play` | `boolean` | an adapter-managed source is not attached until Play; `autoplay` loads at once |
| `adapters` | `MediaAdapter[]` | keep the array stable (an inline `[hls]` is fine: only a different item counts as a change) |
| `sources` | `{ label, src }[]` | the first is the default |
| `prefer-alternate-in-fullscreen` | `boolean` | the second plays in fullscreen, the first in the card |
| `locale` | `PartialDictionary` | for the controls and the presence prompt |
| `accent`, `title`, `cast`, `poster`, `autoplay`, `loop`, `muted`, `options` | | as before; `options` takes any `SkinOptions` |

| Event | Payload |
|---|---|
| `@source-change` | `(index, source)` — the viewer, or the fullscreen rule, picked another entry of `sources` |
| `@presence-ask` | `{ graceMs }` |
| `@presence-continue` | |
| `@presence-timeout` | this player stopped playing and loading |
| `@suspend`, `@resume` | `{ reason: 'hidden' \| 'presence' }` |
| `@live-reconnect` | `{ attempt, reason: 'auth' \| 'network' }` |
| `@live-recovered` | |
| `@error` | a `PlayerError`, including `LIVE_REFUSED` / `LIVE_UNAVAILABLE` with the source's own words in `detail` |

`live`, `presence` and `load-on-play` change in place; changing `src`, `sources`, `adapters`,
`accent`, `locale`, … remounts the skin. A template ref exposes `video` and `engine`
(`engine.seekToLive()`, `engine.store`).

### One prompt for a page of players

```vue
<script setup lang="ts">
import { KuiPlayer, PresenceGroupProvider } from "@kuraykaraaslan/kui-player/wrappers/vue";
</script>

<template>
  <PresenceGroupProvider :every-ms="600_000" :grace-ms="30_000">
    <KuiPlayer v-for="c in cameras" :key="c.id" :src="c.src" :adapters="adapters" live />
    <KuiPlayer src="/media/promo.mp4" :presence="false" />   <!-- stays out of the group -->
  </PresenceGroupProvider>
</template>
```

Every player below the provider shares **one timer and one page-level prompt**: nine tiles
ask once, and when nobody answers all nine stop within the grace period, each with its own
Play button. Props of `PresenceGroupProvider`: `group` (a `createPresenceGroup()` result — keep it out
of `ref()`, use `markRaw` / `shallowRef`), `every-ms`, `grace-ms`, `prompt` (default `true`),
`locale`, `inject-styles` (default `true`). `usePresenceGroup()` returns the group of the nearest
provider, or `null`. A provider with neither a `group` nor both times throws.

## Svelte

```svelte
<script lang="ts">
  import { kuiPlayer } from "@kuraykaraaslan/kui-player/wrappers/svelte";
</script>

<video use:kuiPlayer={{ accent: "#f97316" }} src="/media/talk.mp4" playsinline></video>
```

### Live streams, options and callbacks

The action takes skin mode's options object. Callbacks are plain functions: `onSourceChange(index, source)`
and `on`, a map from engine event names to handlers.

```svelte
<script lang="ts">
  import { kuiPlayer } from "@kuraykaraaslan/kui-player/wrappers/svelte";
  let { camera, adapters } = $props();
</script>

<!-- no src attribute: the action opens it through the adapter -->
<video
  use:kuiPlayer={{
    adapters,
    src: camera.src,
    live: true,
    loadOnPlay: true,
    presence: { everyMs: 600_000, graceMs: 30_000 },
    on: {
      "live:reconnect": ({ attempt, reason }) => log(attempt, reason),
      error: (e) => e.name === "LIVE_REFUSED" && showQuota(e.detail),
    },
  }}
></video>
```

`on` takes `presence:ask`, `presence:continue`, `presence:timeout`, `suspend`, `resume`,
`live:reconnect`, `live:recovered`, `error` and every other engine event (see `PlayerEventMap`).
`live`, `presence` and `loadOnPlay` change in place; `src`, `sources`, `adapters`, `accent`, `locale`,
… remount. New callbacks are picked up without a remount; so is an inline `sources` or `presence`
literal that did not change.

### One prompt for a page of players

```svelte
<!-- Cameras.svelte -->
<script lang="ts">
  import { providePresenceGroup } from "@kuraykaraaslan/kui-player/wrappers/svelte";
  import Tile from "./Tile.svelte";
  let { cameras } = $props();

  providePresenceGroup({ everyMs: 600_000, graceMs: 30_000 });   // once, while the component initialises
</script>

{#each cameras as camera (camera.id)}<Tile {camera} />{/each}

<!-- Tile.svelte -->
<script lang="ts">
  import { kuiPlayer, getPresenceGroup } from "@kuraykaraaslan/kui-player/wrappers/svelte";
  let { camera, adapters } = $props();
  const presence = getPresenceGroup() ?? undefined;
</script>

<video use:kuiPlayer={{ presence, adapters, src: camera.src, live: true }}></video>
```

`providePresenceGroup({ group?, everyMs?, graceMs?, prompt?, locale?, injectStyles? })` creates the
group (or takes yours), puts it in context, shows the one page-level prompt once the component is
mounted and removes it when it is destroyed; it returns the group. `getPresenceGroup()` reads
the nearest one (or `null`), `setPresenceGroup(group)` puts one in context without a prompt. An action
has no access to context, so each player is *given* the group in its options. `presence: false` keeps
a player out of it.

## Without a component tree: the page's group

Both wrappers (and skin mode, and `<kui-player>`) also join a **page-level group** when they were
not given a `presence` of their own:

```ts
import { setPagePresence } from "@kuraykaraaslan/kui-player/wrappers/vue";   // or /svelte, or /skin

setPagePresence({ everyMs: 600_000, graceMs: 30_000 });   // before the players mount
```

It creates the group and its prompt; `setPagePresence(null)` removes them. Each bundle entry
(`/skin`, `/wrappers/vue`, `/wrappers/svelte`) keeps its own page group.

## The custom element

```html
<script type="module">
  import { defineKuiPlayer } from "@kuraykaraaslan/kui-player/skin";
  defineKuiPlayer();
</script>

<kui-player src="/media/talk.mp4" poster="/media/talk.jpg" accent="#f97316"></kui-player>
```

Or with no build step at all — the single-script bundle registers the element
as soon as it sees the tag:

```html
<script src="https://cdn.jsdelivr.net/npm/@kuraykaraaslan/kui-player/dist/embed.js"></script>
<kui-player src="/media/talk.mp4"></kui-player>
```

`<kui-player>` forwards `src`, `currentTime`, `paused`, `play()` and `pause()`,
and exposes the underlying element as `.video` for everything else.

### Live-stream attributes, properties and events

```html
<kui-player
  src="https://example.com/cam/live.m3u8"
  live
  load-on-play
  presence-every-ms="600000"
  presence-grace-ms="30000"
></kui-player>

<script type="module">
  import Hls from "hls.js";
  import { createHlsAdapter } from "@kuraykaraaslan/kui-player";
  const player = document.querySelector("kui-player");
  player.adapters = [createHlsAdapter({ Hls })];            // objects are properties
  player.addEventListener("kui-live-reconnect", (e) => console.log(e.detail));
</script>
```

| Attribute | Meaning |
|---|---|
| `live` | bare or `live="true"`: the source is live. `live="false"` / `"off"`: live behaviours off. `live='{"dvr":true}'`: options |
| `presence-every-ms`, `presence-grace-ms` | both: this player asks "Still watching?" on its own |
| `presence` | `presence="off"` stays out of the page's group; `presence='{"everyMs":…,"graceMs":…}'` is the same pair as JSON |
| `load-on-play` | hold an HLS source back until Play |
| `sources` | JSON: `'[{"label":"Standard","src":"…"},{"label":"High","src":"…"}]'` |
| `prefer-alternate-in-fullscreen` | the second plays in fullscreen |

Properties for what an attribute cannot carry: `adapters`, `sources`, `live`, `presence` (a
`PresenceGroup` too) and `locale`. `live`, `presence` and `load-on-play` change in place; the others
remount. `.skin` gives the engine (`el.skin.engine`).

Events are `CustomEvent`s with the payload in `detail`, prefixed `kui-` because `suspend`, `resume`
and `error` already mean something to a `<video>`: `kui-presence-ask`, `kui-presence-continue`,
`kui-presence-timeout`, `kui-suspend`, `kui-resume`, `kui-live-reconnect`, `kui-live-recovered`,
`kui-error`, and `kui-source-change` with `{ index, source }`.

For one prompt over a page of elements, set the page's group first (`kuiPlayer.setPagePresence(...)`,
or the `data-presence-*` attributes of the embed script — see [skin mode](../recipes/skin-mode.md)).
