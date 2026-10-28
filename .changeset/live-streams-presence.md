---
"@kuraykaraaslan/kui-player": minor
---

Live streams, a presence check and alternate sources — all generic, none of it knows what is streamed.

- **Live mode.** An HLS playlist without `EXT-X-ENDLIST` is live: a LIVE badge, "Go to live edge" when behind, no seek bar (`live={{ dvr: true }}` keeps a bar over the DVR window), and no "ended" while the stream runs, so a live playlist that repeats one segment with `EXT-X-DISCONTINUITY` plays on. `live` can also hint that a source is live up front, which gives the hls.js adapter small-tile defaults (`startLevel: 0`, `capLevelToPlayerSize: true`, overridable with `config`).
- **Reload on a refused or vanished live source.** A 401 / 403 / 404 on a playlist or segment of a live source reloads the original URL once (redirects followed, same-origin cookies sent), then backs off; network errors reconnect with the same back-off; after the limit there is a clear error with Try again, carrying the source's own words (`PlayerError.detail`: a JSON `message` or a short plain-text body). A reconnect shows a spinner, not an error. `live={{ reauth }}` tunes it.
- **Stop when hidden.** A live player scrolled out of view or in a hidden tab makes no requests and rejoins the live edge when seen again (`live={{ stopWhenHidden }}`). Adapters gain optional `suspend()` / `resume()` / `getLiveEdge()` and the host `updateLive()` / `updateRecovery()` / `live`.
- **Presence check.** `presence={{ everyMs, graceMs }}` asks "Still watching?" after `everyMs` of playback and, with no answer within `graceMs`, stops playing and loading ("Paused to save data" + Play). `createPresenceGroup()` and `<PresenceGroupProvider>` (React subpath) make any number of players share one timer and one page-level prompt.
- **Alternate sources.** `sources={[{ label, src }]}` lists "Standard" / "High" in the quality menu; `preferAlternateInFullscreen` plays the second in fullscreen and the first in the card; `onSourceChange` reports the change.
- Translations of the new strings in `tr`, `de`, `es`, `fr` and `ar`. New engine events: `presence:ask`, `presence:continue`, `presence:timeout`, `suspend`, `resume`, `live:reconnect`, `live:recovered`.
- Adapter errors now also reach `engine.on('error')`.

**Behaviour change:** a live stream no longer shows a seek bar or ±10 s buttons by default; pass `live={{ dvr: true }}` for the old bar over the DVR window, or `live={false}` for the previous behaviour entirely. The hls.js adapter now sets `liveDurationInfinity: true`, so live HLS reports an unbounded duration. Size budgets rose with the feature (core 15.5 → 18.9 kB gzipped, React subpath 38.4 → 42.8 kB).
