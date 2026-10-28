import {
  defineComponent, h, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType,
} from 'vue';
import {
  mountSkin, sameItems, type SkinEventHandlers, type SkinHandle, type SkinOptions,
} from '../../embed/mountSkin.js';
import { setPagePresence } from '../../embed/pagePresence.js';
import { isPresenceGroup, type PresenceGroup, type PresenceOptions } from '../../modules/videoplayer/videoplayer.presence.js';
import type { MediaAdapter } from '../../modules/videoplayer/adapters/adapter.types.js';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine.js';
import type { LiveInput } from '../../modules/videoplayer/videoplayer.live.js';
import type { AlternateSource } from '../../modules/videoplayer/videoplayer.types.js';
import type { PartialDictionary } from '../../react/i18n/index.js';
import { PRESENCE_GROUP_KEY } from './presence.js';

export {
  PresenceGroupProvider, usePresenceGroup, createPresenceGroup,
} from './presence.js';
export { setPagePresence };
export type { PresenceGroup, PresenceOptions, LiveInput, AlternateSource, MediaAdapter };

/**
 * `<KuiPlayer>` for Vue 3.
 *
 * The component owns a plain `<video>` and hands it to skin mode, so Vue never
 * has to know that the controls are React underneath — and the element stays a
 * real media element you can `ref` and drive directly.
 *
 * Live streams, the presence check and alternate sources take the same options
 * as the React `<VideoPlayer>`, spelled as Vue props, and the engine's events
 * come out as emits (`@presence-ask`, `@live-reconnect`, `@source-change`, …).
 * Inside a `<PresenceGroupProvider>` every player shares one timer and one prompt.
 */
export const KuiPlayer = defineComponent({
  name: 'KuiPlayer',
  props: {
    /** The address. Optional when `sources` gives them. */
    src: { type: String, default: undefined },
    poster: { type: String, default: undefined },
    title: { type: String, default: undefined },
    accent: { type: String, default: undefined },
    autoplay: { type: Boolean, default: false },
    loop: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    cast: { type: Boolean, default: false },
    options: { type: Object as PropType<SkinOptions>, default: () => ({}) },

    /**
     * Live behaviour: `live` says "this source is live" up front, `:live="{ dvr: true }"`
     * keeps a seek bar over the DVR window, `:live="false"` turns it all off.
     */
    live: { type: [Boolean, Object] as PropType<LiveInput>, default: undefined },
    /**
     * `{ everyMs, graceMs }` for this player, a `PresenceGroup`, or `false` to stay
     * out of the nearest `<PresenceGroupProvider>`.
     */
    presence: { type: [Object, Boolean] as PropType<PresenceOptions | PresenceGroup | false>, default: undefined },
    /** Hold an HLS source back until the first play (needs `adapters`). */
    loadOnPlay: { type: Boolean, default: false },
    /** Streaming adapters (`createHlsAdapter`) that open `src` / `sources`. Keep the array stable. */
    adapters: { type: Array as PropType<MediaAdapter[]>, default: undefined },
    /** Alternate addresses ("Standard" / "High") for the quality menu; the first is the default. */
    sources: { type: Array as PropType<AlternateSource[]>, default: undefined },
    /** With `sources`: the second plays in fullscreen, the first in the card. */
    preferAlternateInFullscreen: { type: Boolean, default: false },
    /** A dictionary for the controls and the presence prompt. */
    locale: { type: Object as PropType<PartialDictionary>, default: undefined },
  },
  emits: {
    /** The viewer (or the fullscreen rule) picked another entry of `sources`. */
    sourceChange: (_index: number, _source: AlternateSource) => true,
    /** "Still watching?" appeared. */
    presenceAsk: (_e: { graceMs: number }) => true,
    presenceContinue: (_e: Record<string, never>) => true,
    /** Nobody answered: this player stopped playing and loading. */
    presenceTimeout: (_e: Record<string, never>) => true,
    /** Loading stopped (`hidden` or `presence`) and started again. */
    suspend: (_e: { reason: 'hidden' | 'presence' }) => true,
    resume: (_e: { reason: 'hidden' | 'presence' }) => true,
    liveReconnect: (_e: { attempt: number; reason: 'auth' | 'network' }) => true,
    liveRecovered: (_e: Record<string, never>) => true,
    /** A playback error, including `LIVE_REFUSED` / `LIVE_UNAVAILABLE` from a live source. */
    error: (_e: unknown) => true,
  },
  setup(props, { expose, emit }) {
    const video = ref<HTMLVideoElement | null>(null);
    const engine = shallowRef<VideoPlayerEngine | null>(null);
    const group = inject(PRESENCE_GROUP_KEY, null);
    let handle: SkinHandle | null = null;

    // An inline `:adapters="[hls]"` is a new array on every render of the parent: only a different item is a change.
    let lastAdapters = props.adapters;
    const adapters = () => {
      if (!sameItems(lastAdapters, props.adapters)) lastAdapters = props.adapters;
      return lastAdapters;
    };

    /** Does skin mode open the source (an adapter, or the first alternate), rather than the element? */
    const managed = () => !!props.sources?.length
      || (!!props.src && !!props.adapters?.some((a) => a.canPlay(props.src as string)));

    /** This player's own options, the provider's group, or nothing (the page's group, if any, applies). */
    const presence = (): SkinOptions['presence'] => {
      if (props.presence === false) return false;
      if (props.presence && typeof props.presence === 'object') return props.presence;
      return group?.value;
    };

    // Stable proxies: the listeners an app passes may change; the mounted skin should not.
    const on: SkinEventHandlers = {
      'presence:ask': (e) => emit('presenceAsk', e),
      'presence:continue': (e) => emit('presenceContinue', e),
      'presence:timeout': (e) => emit('presenceTimeout', e),
      suspend: (e) => emit('suspend', e),
      resume: (e) => emit('resume', e),
      'live:reconnect': (e) => emit('liveReconnect', e),
      'live:recovered': (e) => emit('liveRecovered', e),
      error: (e) => emit('error', e),
    };

    const skin = () => {
      handle?.();
      handle = video.value
        ? mountSkin(video.value, {
            ...props.options,
            ...(props.accent ? { accent: props.accent } : {}),
            ...(props.title ? { title: props.title } : {}),
            cast: props.cast,
            live: props.live,
            presence: presence(),
            loadOnPlay: props.loadOnPlay,
            adapters: adapters(),
            sources: props.sources,
            src: managed() ? props.src : undefined,
            preferAlternateInFullscreen: props.preferAlternateInFullscreen,
            locale: props.locale,
            onSourceChange: (index, source) => emit('sourceChange', index, source),
            on,
          })
        : null;
      engine.value = handle?.engine ?? null;
    };

    onMounted(skin);
    // Options are read once at mount, so a change means a remount. After the DOM
    // has been patched, so the element's `src` is settled before the skin opens a source.
    // (An array of getters, so each is compared on its own: a getter that returns an array is "changed" every time it runs.)
    watch(
      [
        () => props.accent, () => props.cast, () => props.title, adapters, () => props.locale,
        () => props.preferAlternateInFullscreen, managed, () => (managed() ? props.src : undefined),
        () => JSON.stringify(props.sources ?? null), () => group?.value,
      ],
      skin,
      { flush: 'post' },
    );
    // These three change in place: no remount, so a stream keeps playing.
    watch(
      [() => JSON.stringify(props.live ?? null), () => props.loadOnPlay, () => presenceKey(presence())],
      () => handle?.update({ live: props.live, presence: presence(), loadOnPlay: props.loadOnPlay }),
    );
    onBeforeUnmount(() => { handle?.(); handle = null; engine.value = null; });

    expose({ video, engine });

    return () => h('video', {
      ref: video,
      // A source the skin opens (an adapter, or `sources`) is not also the element's own.
      src: managed() ? undefined : props.src,
      poster: props.poster,
      autoplay: props.autoplay,
      loop: props.loop,
      muted: props.muted,
      playsinline: true,
      style: { width: '100%', height: '100%', display: 'block', background: '#000' },
    });
  },
});

/** A group is compared by identity, plain options by value (an inline `:presence="{…}"` is a new object each render). */
function presenceKey(value: SkinOptions['presence']): unknown {
  if (!value || isPresenceGroup(value)) return value ?? null;
  return `${value.everyMs}/${value.graceMs}`;
}

export default KuiPlayer;
