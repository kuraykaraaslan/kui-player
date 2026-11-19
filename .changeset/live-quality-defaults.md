---
"@kuraykaraaslan/kui-player": minor
---

Live HLS gets the small-tile quality defaults without the `live` hint too.

- **Quality defaults for every live source.** The hls.js adapter used `startLevel: 0` and `capLevelToPlayerSize: true` only when the page passed `live`. A source found to be live from its playlist (no `EXT-X-ENDLIST`) now gets them as well: size capping is switched on when the first playlist has no end, so it starts with the first segment, before the bandwidth estimate climbs, and a reload or reconnect of that source starts with both in its hls.js config. A small tile stays on the first variant and full screen climbs; the quality menu stays the manual override. On-demand sources keep hls.js's own choices. Either key set in `createHlsAdapter({ config })` wins, including `false`, and `live={false}` applies neither (adapters see it as the new `ResolvedLive.off`).
- **Translations.** A test now checks that every shipped locale (`tr`, `de`, `es`, `fr`, `ar`) has every string, keeps its `{placeholders}`, and translates the live, reconnect and presence prompts. German "Go to live edge" reads "Zurück zu Live".
- Size budgets: core 19.1 → 19.2 kB and the React subpath 42.9 → 43 kB gzipped.
