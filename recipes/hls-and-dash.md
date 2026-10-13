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

## Low-latency HLS (LL-HLS)

```ts
createHlsAdapter({ Hls, lowLatency: true });
// or tune it:
createHlsAdapter({ Hls, lowLatency: { liveSyncDuration: 2, liveMaxLatencyDuration: 5, catchUpRate: 1.15 } });
```

`lowLatency` maps to hls.js `lowLatencyMode`, `liveSyncDuration`,
`liveMaxLatencyDuration` and `maxLiveSyncPlaybackRate`. When the viewer drifts past the
max latency, hls.js plays slightly faster (`catchUpRate`, default 1.1×; `1` disables it)
until it is back near the edge. An explicit `config` still wins over these values.

The live badge shows the current delay (`LIVE −4s`) and its tooltip spells it out; click it to jump to the edge.

Requirements on the source side:

- Partial segments: the playlist must carry `EXT-X-PART` / `EXT-X-PART-INF` and
  `EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES`, and the origin/CDN must support blocking playlist reload.
- Native Safari playback (`preferNative`) handles low latency itself; these options apply to hls.js only.
- MediaConvert does not do live. On AWS use MediaLive; on Cloudflare Stream enable LL-HLS on the live input.
