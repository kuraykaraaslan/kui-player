import { getContext, hasContext, onMount, setContext } from 'svelte';
import { mountPresencePrompt, type PromptOptions } from '../../embed/pagePresence.js';
import { createPresenceGroup, type PresenceGroup } from '../../modules/videoplayer/videoplayer.presence.js';

// `Symbol.for`, so two copies of this module (a bundler that did not dedupe) still agree on the key.
const KEY = Symbol.for('kui-player.presence-group');

export type ProvidePresenceGroupOptions = PromptOptions & {
  /** An existing group (`createPresenceGroup()`); omit to have one made from `everyMs` / `graceMs`. */
  group?: PresenceGroup;
  /** Playback time before the question, ms. Used when `group` is not given. */
  everyMs?: number;
  /** Time to answer, ms. Used when `group` is not given. */
  graceMs?: number;
  /** Render the page-level prompt (default `true`); `false` to place your own with `mountPresencePrompt`. */
  prompt?: boolean;
};

/** Put `group` in this component's context, for its descendants' `getPresenceGroup()`. Component initialisation only. */
export function setPresenceGroup(group: PresenceGroup): PresenceGroup {
  setContext(KEY, group);
  return group;
}

/** The group of the nearest ancestor that called `providePresenceGroup` / `setPresenceGroup`, or `null`. Component initialisation only. */
export function getPresenceGroup(): PresenceGroup | null {
  return hasContext(KEY) ? getContext<PresenceGroup>(KEY) : null;
}

/**
 * Make a presence group for this component and everything below it, and show the
 * one page-level "Still watching?" prompt for it. The Svelte counterpart of React's
 * `<PresenceGroupProvider>`: call it once, while the component initialises, then
 * give the group to each player.
 *
 * ```svelte
 * <script lang="ts">
 *   import { kuiPlayer, providePresenceGroup } from "@kuraykaraaslan/kui-player/wrappers/svelte";
 *   const presence = providePresenceGroup({ everyMs: 600_000, graceMs: 30_000 });
 * </script>
 *
 * {#each cameras as camera}
 *   <video use:kuiPlayer={{ presence, adapters, src: camera.src, live: true }}></video>
 * {/each}
 * ```
 *
 * A child component reads it with `getPresenceGroup()`. The prompt is removed when
 * the component is destroyed; `presence: false` on a player keeps it out of the group.
 */
export function providePresenceGroup(options: ProvidePresenceGroupOptions): PresenceGroup {
  const { group: given, everyMs, graceMs, prompt = true, locale, injectStyles } = options;
  if (!given && (everyMs === undefined || graceMs === undefined)) {
    throw new Error('providePresenceGroup needs a group, or everyMs and graceMs');
  }
  // A group holds no resources until a player joins it, so there is nothing to dispose.
  const group = given ?? createPresenceGroup({ everyMs: everyMs as number, graceMs: graceMs as number });
  setContext(KEY, group);
  // The prompt is a DOM node: the browser only, once the component is mounted.
  onMount(() => (prompt ? mountPresencePrompt(group, { locale, injectStyles }) : undefined));
  return group;
}

export { createPresenceGroup };
export type { PresenceGroup };
