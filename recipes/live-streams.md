# Live streams, the presence check and alternate sources

None of this knows what is being streamed. A source is live when its HLS playlist has no
`EXT-X-ENDLIST`; everything below is about how a player behaves while one runs, and about
what it costs to leave one running. The same options serve a security-camera wall, a
webinar or a sports feed.

## Live mode

```tsx
import Hls from "hls.js";
import { createHlsAdapter } from "@kuraykaraaslan/kui-player";
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";

const adapters = [createHlsAdapter({ Hls })];   // once, outside render

<VideoPlayer src="https://example.com/live/stream.m3u8" adapters={adapters} live />;
```

Detection needs no option: the adapter reads `details.live` from every playlist refresh.
What `live` adds is a *hint* ("this source is live"), which lets the adapter pick small-tile
defaults before the first playlist arrives: `startLevel: 0` and
`capLevelToPlayerSize: true`, so a small tile stays on the first variant and a full-screen
player climbs. Both can be overridden with `createHlsAdapter({ config })`.

While a live stream plays:

- The clock becomes a **LIVE** badge, red at the edge and grey behind it. Pause for a while
  and the badge turns into **Go to live edge**. "Behind the edge" is judged against what
  hls.js aims for (its target latency plus a segment, never less than 10 s), because HLS
  plays a few segments behind on purpose.
- **There is no seek bar**, no ±10 s buttons and no seek shortcuts. Keep the DVR window with
  `live={{ dvr: true }}`.
- It never shows "ended" while the playlist has no end. A live playlist that repeats one
  segment with `EXT-X-DISCONTINUITY` (a "please wait" slate) is an ordinary live playlist:
  if the element reports `ended` at the edge anyway, the player goes back to the edge.
- `live={false}` switches all of this off (the seek bar over the DVR window, nothing stopped,
  nothing reloaded).

## When the session ends: reload, then back off

A source behind a session (a media server that answers a link with a `302` and a cookie) ends
the session after a while: playlists and segments start answering **401**, **403** or **404**.
For a live source the adapter then:

1. reloads the **original URL** once, at once. That opens a new session: redirects are
   followed, and same-origin requests carry cookies;
2. if that is refused too, retries with a doubling delay (1 s, 2 s, 4 s ... capped at 15 s);
3. on a **network error** (no answer, a timeout) reconnects with the same back-off;
4. gives up after 5 attempts with an error state and a **Try again** button. The error
   carries the source's own words when it gave any: a JSON body's `message`, or a short
   plain-text body, shown under the message as `PlayerError.detail`.

While it reconnects the viewer sees the spinner ("Reconnecting..."), not an error; a segment
that loads ends the recovery and starts the count over. Tune it:

```tsx
<VideoPlayer
  live={{ reauth: { maxAttempts: 8, baseDelayMs: 500, maxDelayMs: 10_000 } }}
  // reauth: false  turns the reload off
  // credentials: 'include'  also sends cookies on cross-origin playlist and segment requests
/>
```

A source that was never seen playing is not reopened: a refusal on the very first playlist is
shown at once, with its text. Where the browser plays HLS itself (Safari, iOS) there is no
hls.js and no status code to read; the engine's ordinary network retry applies there.

Events: `live:reconnect` (`{ attempt, reason: 'auth' | 'network' }`), `live:recovered`, and
`error` when it gives up (`LIVE_REFUSED`, `LIVE_UNAVAILABLE`).

## Load on first play

```tsx
<VideoPlayer src={src} adapters={adapters} live loadOnPlay />
```

With `loadOnPlay` an HLS source is not attached and nothing is requested (no playlist, no segment)
until the viewer presses Play or code calls `engine.play()`; `autoPlay` loads at once. The player
shows its poster and a Play button. A player that never started is not "playing": it is not counted
by the presence check and is not watched for visibility. Sources no adapter claims (MP4) are
unaffected, and with `sources` the entry chosen before Play is the one that loads.

## Stop when nobody can see it

A live player that is scrolled out of view, or in a hidden tab, **makes no requests**: the
element is paused and the adapter stops loading (`hls.stopLoad()`; a natively played stream
drops its source). When it is seen again it picks the stream up at the live edge and plays on
if it was playing. Playback someone is watching elsewhere (Picture-in-Picture, AirPlay, Cast)
is left alone. On by default for live streams only; `live={{ stopWhenHidden: false }}` turns
it off. Events: `suspend` / `resume` (`{ reason: 'hidden' | 'presence' }`).

## "Still watching?"

```tsx
<VideoPlayer src={src} adapters={adapters} live presence={{ everyMs: 10 * 60_000, graceMs: 30_000 }} />
```

After `everyMs` of *playback* (paused time does not count) a prompt asks "Still watching?"
with a countdown of `graceMs`. **Continue** keeps playing and starts the count again. With
no answer, playback and loading stop and the player shows *Paused to save data* with a Play
button; Play starts it again. The check saves cost for honest viewers; it cannot be enforced
against a modified client, so enforce limits on the server.

### One prompt for a page of players

```tsx
import { PresenceGroupProvider, VideoPlayer } from "@kuraykaraaslan/kui-player/react";

<PresenceGroupProvider everyMs={10 * 60_000} graceMs={30_000}>
  {cameras.map((c) => <VideoPlayer key={c.id} src={c.src} adapters={adapters} live />)}
</PresenceGroupProvider>
```

Every player below the provider shares **one timer and one page-level prompt**: nine tiles
ask once, and when nobody answers all nine stop within the grace period. Each stopped tile
has its own Play button. The timer runs while at least one tile plays. Pass `presence={false}`
to keep a player out of its group; a `presence` option on a player inside a group is ignored
in favour of the group's.

Without React, create the group yourself and give it to each engine:

```ts
import { VideoPlayerEngine, createPresenceGroup } from "@kuraykaraaslan/kui-player";

const group = createPresenceGroup({ everyMs: 600_000, graceMs: 30_000 });
const engine = new VideoPlayerEngine({ presence: group });
group.store.subscribe((s) => { if (s.phase === "asking") showMyPrompt(s.remainingMs); });
// the viewer's answer: group.confirm()
```

`<PresenceGroupProvider prompt={false} group={group}>` plus `<PresencePrompt group={group} />`
places the built-in prompt yourself. Events on each engine: `presence:ask`,
`presence:continue`, `presence:timeout`.

## Alternate sources

```tsx
<VideoPlayer
  sources={[
    { label: "Standard", src: "https://example.com/cam1/sub.m3u8" },
    { label: "High", src: "https://example.com/cam1/main.m3u8" },
  ]}
  preferAlternateInFullscreen
  onSourceChange={(index, source) => console.log(index, source.label)}
  adapters={adapters}
  live
/>
```

`sources` replaces `src` and fills the **Quality** menu (two or more entries; the first is the
default). Picking one swaps the address and carries the viewer's state over: an on-demand
video keeps its position, a live stream rejoins the edge. With
`preferAlternateInFullscreen` the second entry plays in fullscreen and the first in the card,
until the viewer picks one by hand; the next fullscreen change applies the rule again.
Where `sources` is given the alternates win the menu over a single master's renditions.
