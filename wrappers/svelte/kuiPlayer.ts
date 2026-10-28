import { mountSkin, sameItems, type SkinHandle, type SkinOptions } from '../../embed/mountSkin.js';
import { setPagePresence } from '../../embed/pagePresence.js';
import type { PlayerEventHandler, PlayerEventName } from '../../modules/videoplayer/videoplayer.events.js';

export {
  providePresenceGroup, getPresenceGroup, setPresenceGroup, createPresenceGroup,
} from './presence.js';
export type { ProvidePresenceGroupOptions, PresenceGroup } from './presence.js';
export { mountPresencePrompt } from '../../embed/pagePresence.js';
export { setPagePresence };
export type { SkinOptions, SkinEventHandlers } from '../../embed/mountSkin.js';
export type { PresenceOptions } from '../../modules/videoplayer/videoplayer.presence.js';
export type { LiveInput } from '../../modules/videoplayer/videoplayer.live.js';
export type { AlternateSource } from '../../modules/videoplayer/videoplayer.types.js';
export type { MediaAdapter } from '../../modules/videoplayer/adapters/adapter.types.js';

/** Options that change in place; every other one is read at mount time. */
const IN_PLACE = new Set(['live', 'presence', 'loadOnPlay']);
/** Callbacks are kept current without a remount. */
const CALLBACKS = new Set(['on', 'onSourceChange']);

/** Did anything that needs a remount change? (`sources` by value and `adapters` by item: a fresh literal each render is not a change.) */
function needsRemount(prev: SkinOptions, next: SkinOptions): boolean {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys) {
    if (IN_PLACE.has(key) || CALLBACKS.has(key)) continue;
    const a = prev[key as keyof SkinOptions];
    const b = next[key as keyof SkinOptions];
    if (key === 'sources') {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) return true;
    } else if (key === 'adapters') {
      if (!sameItems(a as SkinOptions['adapters'], b as SkinOptions['adapters'])) return true;
    } else if (!Object.is(a, b)) return true;
  }
  // Which events are listened to is fixed at mount; their handlers are not.
  return Object.keys(prev.on ?? {}).sort().join() !== Object.keys(next.on ?? {}).sort().join();
}

/**
 * A Svelte action: `<video use:kuiPlayer={{ accent: '#f97316' }} src="…" />`.
 *
 * Svelte 5 has no need for a component wrapper here — an action is the idiomatic
 * way to attach behaviour to an element the template already owns, which is
 * exactly what skin mode does.
 *
 * The options are skin mode's, including the live-stream ones: `live`,
 * `presence` (`{ everyMs, graceMs }`, a group from `providePresenceGroup()`, or
 * `false`), `loadOnPlay`, `adapters` + `src`, `sources` +
 * `preferAlternateInFullscreen`, and the callbacks `onSourceChange(index, source)`
 * and `on: { 'presence:ask': …, 'live:reconnect': …, error: … }`. `live`,
 * `presence` and `loadOnPlay` change in place; the rest remount.
 */
export function kuiPlayer(node: HTMLVideoElement, options: SkinOptions = {}) {
  let current = options;

  // Stable proxies for the callbacks: the options object is new on every update.
  const mount = (opts: SkinOptions): SkinHandle => mountSkin(node, {
    ...opts,
    onSourceChange: (index, source) => current.onSourceChange?.(index, source),
    on: Object.fromEntries(Object.keys(opts.on ?? {}).map((name) => [
      name,
      (payload: unknown) => (current.on?.[name as PlayerEventName] as PlayerEventHandler<PlayerEventName> | undefined)?.(payload as never),
    ])),
  });

  let handle = mount(options);

  return {
    update(next: SkinOptions) {
      const previous = current;
      current = next;
      if (needsRemount(previous, next)) {
        handle();
        handle = mount(next);
      } else {
        handle.update({ live: next.live, presence: next.presence, loadOnPlay: next.loadOnPlay });
      }
    },
    destroy() {
      handle();
    },
  };
}

export default kuiPlayer;
