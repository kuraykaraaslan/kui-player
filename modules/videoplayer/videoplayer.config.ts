/*
 * Library-wide defaults: what an application sets once instead of on every
 * player. Every binding (React, the facade, skin mode, `<kui-player>`, the Vue
 * and Svelte wrappers, the embed script) reads them, and an option given to one
 * player still wins over the default.
 *
 * The object lives on `globalThis` under a registered symbol, so two copies of
 * the library on one page (say the React entry and the embed bundle) see the
 * same defaults.
 */

/**
 * Defaults for every player on the page, set with `configurePlayer`. This is the
 * library's configuration standard: each key is the name of a per-player option,
 * and the per-player value, when given, wins. More keys will follow.
 */
export type PlayerDefaults = {
  /**
   * Hide the About entry of the settings menu and its dialog (author, website)
   * on every player, for white-label products. A player's own `hideAbout` wins.
   * Default `false`.
   */
  hideAbout?: boolean;
};

const KEY = Symbol.for('kui-player.defaults');

type DefaultsHolder = { [KEY]?: PlayerDefaults };

/** The shared object: one per page, whichever copy of the library made it first. */
function shared(): PlayerDefaults {
  const holder = globalThis as DefaultsHolder;
  return (holder[KEY] ??= {});
}

/**
 * Set library-wide defaults. Keys merge into what is already set; a key given as
 * `undefined` goes back to the built-in default. Players read the defaults when
 * they render or mount, so call this once at start-up, before the first player.
 *
 * ```ts
 * import { configurePlayer } from "@kuraykaraaslan/kui-player";
 * configurePlayer({ hideAbout: true });
 * ```
 */
export function configurePlayer(defaults: PlayerDefaults): void {
  const current = shared();
  for (const [key, value] of Object.entries(defaults) as [keyof PlayerDefaults, PlayerDefaults[keyof PlayerDefaults]][]) {
    if (value === undefined) delete current[key];
    else current[key] = value;
  }
}

/** The defaults set with `configurePlayer`, as a frozen snapshot. */
export function playerDefaults(): Readonly<PlayerDefaults> {
  return Object.freeze({ ...shared() });
}

/** A player's `hideAbout`: its own value when given, else the configured default, else `false`. */
export function resolveHideAbout(own: boolean | undefined): boolean {
  return own ?? shared().hideAbout ?? false;
}
