# Ads (VAST / VMAP)

Optional and separate: `@kuraykaraaslan/kui-player/ads` (about 6.6 kB gzip). The player, the core
entry and the default bundle contain no ad code, and the "no request except your media" guarantee
holds for every player that does not import this.

```tsx
import { VideoPlayer } from "@kuraykaraaslan/kui-player/react";
import { AdsOverlay } from "@kuraykaraaslan/kui-player/ads";

// one pre-roll from a VAST tag
<VideoPlayer src={src} slots={{ top: <AdsOverlay tag="https://ads.example.com/vast.xml" /> }} />

// a full schedule: pre-, mid- and post-rolls
<VideoPlayer src={src} slots={{ top: <AdsOverlay vmap="https://ads.example.com/vmap.xml" /> }} />
```

## What it does

- Parses VAST 3/4 (inline, wrappers up to 4 deep, ad pods in `sequence` order) and VMAP
  (`start`, `end`, `hh:mm:ss`, `%`, `#n`; linear and non-linear breaks).
- Holds the content for a pre-roll (the viewer's first *play*), plays mid-rolls when the
  playhead reaches them (seeking past several plays only the last, once), post-rolls at the end.
- Ad UI: "Ad 1 of 2 · 12s", pause/play, **Skip ad** once the skip offset is reached, **Learn more**
  (opens the click-through with `noopener,noreferrer`).
- Tracking: impressions, `start`/quartiles/`complete`/`skip`/`pause`/`resume`/`mute`/`unmute`,
  click tracking and `Error` URLs with `[ERRORCODE]`, `[CACHEBUSTING]`, `[TIMESTAMP]`,
  `[CONTENTPLAYHEAD]`, `[ASSETURI]` filled in.
- **Non-linear (overlay) ads**, from a VMAP break with `breakType="nonlinear"` (VAST 3/4 `NonLinearAds`).
  Only a `StaticResource` image (png, jpeg, gif, webp, avif over http/https) is shown, as a plain
  `<img>` over the lower part of the video. The content **keeps playing**; the banner has a
  **Close ad** button and hides itself after `minSuggestedDuration` (10 s when the ad gives none).
  `NonLinearClickThrough` opens in a new tab with `rel="noopener noreferrer"` (http/https only; other
  schemes are dropped), `NonLinearClickTracking` fires on click, `Impression` and `creativeView` fire
  when it appears. **`IFrameResource` and `HTMLResource` are ignored on purpose**: running a third
  party's markup or script is not something this entry does. A non-linear break whose playhead is
  more than 5 s behind (a seek) is skipped, not shown late. A break that comes due while a banner
  is up, or while a linear break runs, is queued and shown when the slot frees up. A plain `tag` is still one linear pre-roll;
  non-linear ads need a VMAP schedule. Events: `nonlinear:start`, `nonlinear:click`, `nonlinear:end`
  (`reason: 'dismiss' | 'timeout' | 'replaced'`; `replaced` means a linear break took the banner's place). The text is the `dismiss` label.
- Any failure (tag down, no playable file, ad stalls for 8 s) fires the error URLs and **carries on
  with the content**. A viewer never waits on an ad server.

## Privacy, stated carefully

The overlay makes exactly the requests your ad tag leads to: the tag, its wrappers, the media
file and the tracking pixels. Ad documents are fetched **without cookies** unless you pass
`credentials="include"`. That is still third-party traffic, which is the point of ads — so keep this
out of players where the zero-telemetry promise matters. `onEvent` and `ping` let you observe or
reroute everything it does.

## Not included

- Companion ads, HTML/iframe non-linear creatives, VPAID/SIMID interactive creatives, OMID viewability.
- Server-side ad insertion is a different thing: see the `adbreak:*` events (8.3).
- Ad-blocker handling, frequency capping, ad-pod bumpers, consent (TCF/GPP) — your page's job.
- Verified against synthetic VAST/VMAP documents and a mocked video element, **not against a real ad server**. The non-linear overlay in particular was only exercised with hand-written
  synthetic VAST, never a real non-linear tag.
