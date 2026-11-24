---
"@kuraykaraaslan/kui-player": minor
---

`hideAbout` leaves the About entry out of the settings menu, so its dialog (author, website) can never open: for products that embed the player under their own brand. Default `false`, so the menu stays as it was.

- **Every binding.** React `<VideoPlayer hideAbout>` (and the facade, which forwards its props), skin mode `hideAbout`, the Vue wrapper's `hide-about` / `hideAbout` prop, the Svelte action's `hideAbout` option, `<kui-player hide-about>` (`hide-about="false"` keeps it; a change remounts) and `data-hide-about` on the embed script tag. The WordPress plugin takes `$settings['hide_about'] = true` through the `kui_player_settings` filter.
- With the option on, the About dialog's chunk is never loaded.
