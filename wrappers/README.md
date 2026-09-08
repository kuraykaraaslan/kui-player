# Framework wrappers

The chrome is React, but nothing that uses it has to be. Each wrapper hands a
plain `<video>` — one the framework itself renders — to skin mode, so the
element stays a real media element with its own `src`, events and methods.

| Framework | What to use |
|---|---|
| React | `@kuraykaraaslan/kui-player/react` — the real component, not a wrapper |
| Vue 3 | [`wrappers/vue/KuiPlayer.ts`](./vue/KuiPlayer.ts) |
| Svelte 5 | [`wrappers/svelte/kuiPlayer.ts`](./svelte/kuiPlayer.ts) — an action |
| Angular, Solid, Qwik, plain HTML | `<kui-player>`, the custom element |

## Vue

```vue
<script setup lang="ts">
import { KuiPlayer } from "@kuraykaraaslan/kui-player/wrappers/vue/KuiPlayer";
</script>

<template>
  <KuiPlayer src="/media/talk.mp4" poster="/media/talk.jpg" accent="#f97316" />
</template>
```

## Svelte

```svelte
<script lang="ts">
  import { kuiPlayer } from "@kuraykaraaslan/kui-player/wrappers/svelte/kuiPlayer";
</script>

<video use:kuiPlayer={{ accent: "#f97316" }} src="/media/talk.mp4" playsinline></video>
```

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
