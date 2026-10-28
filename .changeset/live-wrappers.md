---
"@kuraykaraaslan/kui-player": minor
---

The Vue and Svelte wrappers, skin mode and `<kui-player>` take the live-stream, presence-check and alternate-source options the React player already had, and can share one "Still watching?" across a page.

- **Skin mode** (`mountSkin`, `skinAll`, `window.kuiPlayer`): new `SkinOptions` `live`, `presence`, `loadOnPlay`, `locale`, `on` (engine events by name), `adapters` + `src` and `sources` + `preferAlternateInFullscreen` + `onSourceChange`. `mountSkin` now returns the unmount function with `.engine` and `.update({ live, presence, loadOnPlay })` attached. Passing no new option changes nothing; `adapters` and `sources` are the only options that make a skin open a source itself.
- **One prompt for a page.** `setPagePresence({ everyMs, graceMs })` (also `getPagePresence`, `createPagePresenceGroup`, `mountPresencePrompt`, and on the script tag `data-presence-every-ms` / `data-presence-grace-ms`) creates a group and its single page-level prompt; every skinned video, `<kui-player>` and wrapper player without its own `presence` joins it. `presence: false` or `data-kui-presence="off"` opts one out. New script-tag attributes `data-live`, `data-load-on-play`, `data-presence`.
- **Vue:** `<KuiPlayer>` props `live`, `presence`, `loadOnPlay`, `adapters`, `sources`, `preferAlternateInFullscreen`, `locale` and emits `sourceChange`, `presenceAsk`, `presenceContinue`, `presenceTimeout`, `suspend`, `resume`, `liveReconnect`, `liveRecovered`, `error`; `<PresenceGroupProvider>` and `usePresenceGroup()` share one timer and prompt. `src` is optional when `sources` is given.
- **Svelte:** the `kuiPlayer` action takes the same options and callbacks (`on`, `onSourceChange`); `providePresenceGroup()`, `getPresenceGroup()` and `setPresenceGroup()` share a group through component context.
- **`<kui-player>`:** attributes `live`, `presence`, `presence-every-ms`, `presence-grace-ms`, `load-on-play`, `sources`, `prefer-alternate-in-fullscreen`; properties `adapters`, `sources`, `live`, `presence`, `locale`; `kui-*` events.
- **Fix:** in skin mode (controls in a shadow root) a click inside the settings menu closed the menu before it landed, so the quality menu could not be used; the outside-click check now uses the event's composed path. This also affects the React player rendered inside a shadow root.
- Size budgets rose with the feature: the single-script embed 57.6 → 59.6 kB and skin mode 41.4 → 43.8 kB gzipped.
