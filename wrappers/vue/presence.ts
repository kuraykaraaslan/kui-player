import {
  computed, defineComponent, inject, onBeforeUnmount, onMounted, provide, watch,
  type ComputedRef, type InjectionKey, type PropType,
} from 'vue';
import { mountPresencePrompt } from '../../embed/pagePresence.js';
import {
  createPresenceGroup, type PresenceGroup,
} from '../../modules/videoplayer/videoplayer.presence.js';
import type { PartialDictionary } from '../../react/i18n/index.js';

/** The group a `<PresenceGroupProvider>` shares with every `<KuiPlayer>` below it. */
export const PRESENCE_GROUP_KEY: InjectionKey<ComputedRef<PresenceGroup>> = Symbol('kui-presence-group');

/** The presence group of the nearest provider, or `null` outside one. */
export function usePresenceGroup(): PresenceGroup | null {
  return inject(PRESENCE_GROUP_KEY, null)?.value ?? null;
}

/**
 * Every `<KuiPlayer>` below this shares one presence timer and one prompt: a page
 * with nine live tiles asks "Still watching?" once, and when nobody answers within
 * the grace period all nine stop playing and loading.
 *
 * ```vue
 * <PresenceGroupProvider :every-ms="600_000" :grace-ms="30_000">
 *   <KuiPlayer v-for="c in cameras" :key="c.id" :src="c.src" :adapters="adapters" live />
 * </PresenceGroupProvider>
 * ```
 *
 * A `<KuiPlayer :presence="false">` stays out of its group. Pass `:group` to share
 * a group made with `createPresenceGroup()` (keep it out of `ref()`: use `markRaw`
 * or `shallowRef`, so the group is not wrapped in a reactive proxy).
 */
export const PresenceGroupProvider = defineComponent({
  name: 'PresenceGroupProvider',
  props: {
    /** An existing group; omit to have one made from `everyMs` / `graceMs`. */
    group: { type: Object as PropType<PresenceGroup>, default: undefined },
    /** Playback time before the question, ms. Used when `group` is not given. */
    everyMs: { type: Number, default: undefined },
    /** Time to answer, ms. Used when `group` is not given. */
    graceMs: { type: Number, default: undefined },
    /** Render the page-level prompt (default `true`); `false` to place your own. */
    prompt: { type: Boolean, default: true },
    /** Dictionary for the prompt — the same value you give the players. */
    locale: { type: Object as PropType<PartialDictionary>, default: undefined },
    /** Inject the player stylesheet into the document head (default `true`). */
    injectStyles: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    // A group holds no resources until a player joins it and its timer stops when
    // the last one leaves, so there is nothing to dispose when this unmounts.
    const own = props.group ? null : (() => {
      if (props.everyMs === undefined || props.graceMs === undefined) {
        throw new Error('PresenceGroupProvider needs a group, or everyMs and graceMs');
      }
      return createPresenceGroup({ everyMs: props.everyMs, graceMs: props.graceMs });
    })();
    const active = computed(() => props.group ?? own as PresenceGroup);
    provide(PRESENCE_GROUP_KEY, active);

    let removePrompt: (() => void) | null = null;
    const showPrompt = () => {
      removePrompt?.();
      removePrompt = props.prompt
        ? mountPresencePrompt(active.value, { locale: props.locale, injectStyles: props.injectStyles })
        : null;
    };
    // The prompt is a DOM node, so it exists only in the browser, once mounted.
    let mounted = false;
    onMounted(() => { mounted = true; showPrompt(); });
    watch(() => [active.value, props.prompt, props.locale, props.injectStyles], () => { if (mounted) showPrompt(); });
    onBeforeUnmount(() => { mounted = false; removePrompt?.(); removePrompt = null; });

    return () => slots.default?.();
  },
});

export { createPresenceGroup };
export type { PresenceGroup };
