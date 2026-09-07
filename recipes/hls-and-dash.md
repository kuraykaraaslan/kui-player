# HLS and DASH

kui-player bundles no streaming engine. You install the one you want and hand the player
an adapter, so an app that only serves MP4 pays nothing for streaming support.

```bash
pnpm add hls.js
```

```tsx
import Hls from "hls.js";
import { createHlsAdapter } from "@kuraykaraaslan/kui-player";
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

// Build it once, outside render — a new array each render re-registers it.
const adapters = [createHlsAdapter({ Hls })];

export function Live() {
  return <VideoPlayer src="https://example.com/stream.m3u8" adapters={adapters} />;
}
```

What you get for free:

- `.m3u8` goes to hls.js, `.mp4` stays native — the adapter is asked per source.
- On Safari and iOS the URL is handed to the element instead, keeping hardware
  decoding and AirPlay. Pass `preferNative: false` to always use hls.js.
- Manifest renditions fill the quality menu, with an **Auto** entry that returns
  control to ABR and shows which level it settled on.
- Multi-language audio renditions appear under *Audio Language* and actually switch.

DASH is the same shape:

```ts
import dashjs from "dashjs";
import { createDashAdapter } from "@kuraykaraaslan/kui-player";

const adapters = [createDashAdapter({ dashjs })];
```

With the vanilla core:

```ts
const engine = new VideoPlayerEngine();
engine.attach(video);
engine.use(createHlsAdapter({ Hls }));
await engine.loadSource("https://example.com/stream.m3u8");
engine.selectQuality("auto");
```

Loading either library from a `<script>` tag instead? Omit the option and the adapter
picks up the `window.Hls` / `window.dashjs` global.
