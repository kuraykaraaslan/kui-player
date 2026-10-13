# Analytics and QoE

The player measures a session and hands you the numbers. It sends nothing
anywhere — where they go is entirely your call, which is what makes the
[privacy guarantee](../README.md#privacy) enforceable.

```tsx
import { useVideoPlayerEngine } from "@kuraykaraaslan/kui-player/react";

function Analytics() {
  const engine = useVideoPlayerEngine();

  useEffect(() => {
    const off = [
      engine.on("ready", ({ startupMs, timeToFirstFrameMs }) =>
        track("video_start", { startupMs, timeToFirstFrameMs })),
      engine.on("stall", ({ count, durationMs, totalMs }) =>
        track("video_rebuffer", { count, durationMs, totalMs })),
      engine.on("quartile", ({ percent }) => track(`video_${percent}`)),
      engine.on("error", (error) => track("video_error", { name: error.name })),
      engine.on("complete", () => track("video_complete")),
    ];
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [engine]);

  return null;
}
```

Render it anywhere inside `<VideoPlayer>` — it needs the engine from context:

```tsx
<VideoPlayer src={src} slots={{ top: <Analytics /> }} />
```

Or, with the vanilla core, straight off the engine:

```ts
const engine = new VideoPlayerEngine();
engine.attach(video);
engine.on("quartile", ({ percent }) => beacon(percent));
```

## The events

| Event | Payload | Why it matters |
|---|---|---|
| `ready` | `startupMs`, `timeToFirstFrameMs` | the two numbers that decide whether a player feels fast |
| `stall` | `count`, `durationMs`, `totalMs` | rebuffering — the main QoE metric |
| `qoe:stall` | `count`, `currentTime` | a rebuffer just *began* (`stall` fires when it ends) |
| `qoe` | `playingMs`, `stallCount/Ms/Ratio`, `switches`, `rendition`, `avgBitrate`, `droppedFrames`, `bandwidthBps` | periodic summary every `qoeIntervalMs` (default 10 s) while playing, plus one on pause/end. `engine.getQoe()` returns the same on demand |
| `adbreak:start` / `adbreak:end` | the `AdBreak` (`id`, `start`, `end`, `duration`, `source`) | the playhead entered / left an ad break the stream marks (HLS `EXT-X-CUE-OUT`/`CUE-IN`, `EXT-X-DATERANGE` with `SCTE35-OUT` or an ad/interstitial `CLASS`). Needs the hls.js adapter; the player does not show ads, it only tells you where they are |
| `chapter` | `index`, `title`, `kind` | the playhead entered a chapter (`intro` / `recap` / `credits` / `content`) |
| `quartile` | `percent` (25/50/75/100) | the engagement standard; each fires once per source |
| `complete` | `duration` | reached the end |
| `error` | the `PlayerError` | `name` is stable and safe to group by |
| `sourcechange` | `src` | a new source started loading; counters reset here |
| `play` `pause` `seeking` `seeked` | position | transport |
| `ratechange` `volumechange` `qualitychange` `audiotrackchange` | the new value | what the viewer changed |

Every `on()` returns its own unsubscribe function, and a listener that throws is
contained — a broken analytics call can never break playback.

## CMCD

For CDN-side visibility, [Common Media Client Data](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf)
is the adapter's job, not the player's, because the adapter owns the requests.
With hls.js:

```ts
createHlsAdapter({
  Hls,
  config: {
    cmcd: { sessionId: crypto.randomUUID(), contentId: video.id },
  },
});
```

dash.js takes the same idea through `settings.streaming.cmcd`.
