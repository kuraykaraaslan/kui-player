---
"@kuraykaraaslan/kui-player": minor
---

`hideAbout` leaves the About entry out of the settings menu, so its dialog (author, website) can never open: for products that embed the player under their own brand. Built-in default `false`, so the menu stays as it was.

- **Every binding.** React `<VideoPlayer hideAbout>` (and the facade, which forwards its props), skin mode `hideAbout`, the Vue wrapper's `hide-about` / `hideAbout` prop, the Svelte action's `hideAbout` option, `<kui-player hide-about>` (`hide-about="false"` keeps it; a change remounts) and `data-hide-about` on the embed script tag. The WordPress plugin takes `$settings['hide_about'] = true` through the `kui_player_settings` filter.
- With the option on, the About dialog's chunk is never loaded.
- **Library-wide defaults.** `configurePlayer({ hideAbout: true })` sets it once for every player on the page, and `playerDefaults()` reads it back; both come from the core entry (and the React, skin, Vue and Svelte entries, and `window.kuiPlayer` in the script build). A player's own option still wins, so `hideAbout={false}` / `hide-about="false"` shows the entry again. The defaults live on `globalThis` under `Symbol.for('kui-player.defaults')`, so two copies of the library on one page agree. `PlayerDefaults` is the start of the library's configuration standard; more keys will follow.
- Size budgets: core 19.2 → 19.3 kB, the React subpath 43 → 43.1 kB (52.0 → 52.2 kB with every lazy chunk), the embed script 59.6 → 59.8 kB and skin mode 43.8 → 44 kB gzipped.
