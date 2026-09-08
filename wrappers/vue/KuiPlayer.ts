import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { mountSkin, type SkinOptions } from '../../embed/mountSkin.js';

/**
 * `<KuiPlayer>` for Vue 3.
 *
 * The component owns a plain `<video>` and hands it to skin mode, so Vue never
 * has to know that the controls are React underneath — and the element stays a
 * real media element you can `ref` and drive directly.
 */
export const KuiPlayer = defineComponent({
  name: 'KuiPlayer',
  props: {
    src: { type: String, required: true },
    poster: { type: String, default: undefined },
    title: { type: String, default: undefined },
    accent: { type: String, default: undefined },
    autoplay: { type: Boolean, default: false },
    loop: { type: Boolean, default: false },
    muted: { type: Boolean, default: false },
    cast: { type: Boolean, default: false },
    options: { type: Object as PropType<SkinOptions>, default: () => ({}) },
  },
  setup(props, { expose }) {
    const video = ref<HTMLVideoElement | null>(null);
    let unmount: (() => void) | null = null;

    const skin = () => {
      unmount?.();
      unmount = video.value
        ? mountSkin(video.value, {
            ...props.options,
            ...(props.accent ? { accent: props.accent } : {}),
            ...(props.title ? { title: props.title } : {}),
            cast: props.cast,
          })
        : null;
    };

    onMounted(skin);
    // Options are read once at mount, so a change means a remount.
    watch(() => [props.accent, props.cast, props.title], skin);
    onBeforeUnmount(() => { unmount?.(); unmount = null; });

    expose({ video });

    return () => h('video', {
      ref: video,
      src: props.src,
      poster: props.poster,
      autoplay: props.autoplay,
      loop: props.loop,
      muted: props.muted,
      playsinline: true,
      style: { width: '100%', height: '100%', display: 'block', background: '#000' },
    });
  },
});

export default KuiPlayer;
