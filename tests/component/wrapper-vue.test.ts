import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createApp, defineComponent, h, nextTick, reactive, ref, type App, type VNode } from 'vue';
import {
  KuiPlayer, PresenceGroupProvider, createPresenceGroup, setPagePresence, usePresenceGroup as groupOfProvider,
} from '../../wrappers/vue/KuiPlayer';
import { tr } from '../../react/i18n/locales/tr';
import { fakeAdapter, stubFullscreen, stubObservers } from './skin-harness';

/*
 * The Vue 3 wrapper with the live-stream options: props reach the engine, the
 * engine's events come out as emits, and a <PresenceGroupProvider> gives a page
 * of players one timer and one prompt.
 */

const LIVE = 'https://example.com/cam/live.m3u8';
const SECOND = 1000;

let observers: ReturnType<typeof stubObservers>;
let apps: App[];

beforeEach(() => { observers = stubObservers(); apps = []; });
afterEach(() => {
  act(() => { apps.forEach((a) => a.unmount()); });
  setPagePresence(null);
  observers.restore();
  document.body.innerHTML = '';
});

/** Mount a root render function; the skin renders in a React root, so the whole thing runs inside `act`. */
async function mount(render: () => VNode | VNode[]): Promise<App> {
  const app = createApp({ render });
  apps.push(app);
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { app.mount(el); await nextTick(); });
  return app;
}

const videos = () => Array.from(document.querySelectorAll('video'));
const chromeOf = (index = 0) => {
  const host = document.querySelectorAll<HTMLElement>('[data-tepegoz-video-player]')[index]!;
  return within(host.shadowRoot as unknown as HTMLElement);
};

describe('Vue wrapper: live', () => {
  it('opens an adapter-managed source, hints it as live, and leaves the element without a src', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    await mount(() => h(KuiPlayer, { src: LIVE, adapters, live: { credentials: 'include' } }));
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(hosts[0]!.live).toMatchObject({ hinted: true, credentials: 'include' });
    expect(videos()[0]!.hasAttribute('src')).toBe(false);
  });

  it('renders the src itself when nothing else opens it', async () => {
    await mount(() => h(KuiPlayer, { src: 'https://example.com/a.mp4' }));
    expect(videos()[0]!.getAttribute('src')).toBe('https://example.com/a.mp4');
  });

  it('is an ordinary player when none of the new props are given', async () => {
    await mount(() => h(KuiPlayer, { src: 'https://example.com/a.mp4' }));
    expect(chromeOf().getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
  });

  it('emits liveReconnect, liveRecovered and error from the stream', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    const reconnect = vi.fn();
    const recovered = vi.fn();
    const error = vi.fn();
    await mount(() => h(KuiPlayer, {
      src: LIVE, adapters, live: true,
      onLiveReconnect: reconnect, onLiveRecovered: recovered, onError: error,
    }));
    await waitFor(() => expect(hosts).toHaveLength(1));

    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'auth' }));
    expect(reconnect).toHaveBeenCalledWith({ attempt: 1, reason: 'auth' });
    act(() => hosts[0]!.updateRecovery?.({ reconnecting: false }));
    expect(recovered).toHaveBeenCalledTimes(1);
    act(() => {
      hosts[0]!.reportError({ code: 2, name: 'LIVE_REFUSED', message: 'refused', recoverable: true });
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ name: 'LIVE_REFUSED' }));
  });

  it('emits suspend and resume when a live player leaves and re-enters the viewport', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    const suspend = vi.fn();
    const resume = vi.fn();
    await mount(() => h(KuiPlayer, { src: LIVE, adapters, live: true, onSuspend: suspend, onResume: resume }));
    await waitFor(() => expect(hosts).toHaveLength(1));
    act(() => hosts[0]!.updateLive?.(true));
    const watcher = observers.intersections[observers.intersections.length - 1]!;
    act(() => watcher([{ isIntersecting: false }]));
    expect(suspend).toHaveBeenCalledWith({ reason: 'hidden' });
    act(() => watcher([{ isIntersecting: true }]));
    expect(resume).toHaveBeenCalledWith({ reason: 'hidden' });
  });

  it('changes live in place, without remounting the stream', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    const state = reactive<{ live: boolean | { dvr: boolean } }>({ live: true });
    await mount(() => h(KuiPlayer, { src: LIVE, adapters, live: state.live }));
    await waitFor(() => expect(hosts).toHaveLength(1));
    const video = videos()[0]!;
    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => hosts[0]!.updateLive?.(true));
    await chromeOf().findByRole('button', { name: /LIVE|Go to live edge/ });
    expect(chromeOf().queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();

    await act(async () => { state.live = { dvr: true }; await nextTick(); });
    expect(await chromeOf().findByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    expect(adapter.attach).toHaveBeenCalledTimes(1);
    expect(adapter.detach).not.toHaveBeenCalled();
  });

  it('does not remount when a parent re-renders with equal inline objects and arrays', async () => {
    const { adapter, hosts } = fakeAdapter();
    const tick = ref(0);
    // Inline literals, new on every render of the parent.
    await mount(() => { void tick.value; return h(KuiPlayer, { src: LIVE, adapters: [adapter], live: { dvr: true }, presence: { everyMs: 1000, graceMs: 1000 } }); });
    await waitFor(() => expect(hosts).toHaveLength(1));
    await act(async () => { tick.value += 1; await nextTick(); });
    expect(adapter.attach).toHaveBeenCalledTimes(1);
    expect(adapter.detach).not.toHaveBeenCalled();
  });

  it('exposes the video and the engine to a template ref', async () => {
    const player = ref<InstanceType<typeof KuiPlayer> | null>(null);
    await mount(() => h(KuiPlayer, { ref: player, src: 'https://example.com/a.mp4' }));
    const exposed = player.value as unknown as { video: HTMLVideoElement; engine: { store: { getState(): { playing: boolean } } } | null };
    expect(exposed.video).toBe(videos()[0]);
    expect(exposed.engine?.store.getState().playing).toBe(false);
  });
});

describe('Vue wrapper: load on first play', () => {
  it('attaches nothing until Play is pressed', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    await mount(() => h(KuiPlayer, { src: LIVE, adapters, live: true, loadOnPlay: true }));
    await act(async () => { await Promise.resolve(); });
    expect(adapter.attach).not.toHaveBeenCalled();
    await userEvent.setup().click(chromeOf().getAllByRole('button', { name: 'Play' })[0]!);
    await waitFor(() => expect(hosts).toHaveLength(1));
  });

  it('loads at once with autoplay', async () => {
    const { adapter, hosts } = fakeAdapter();
    const adapters = [adapter];
    await mount(() => h(KuiPlayer, { src: LIVE, adapters, loadOnPlay: true, autoplay: true }));
    await waitFor(() => expect(hosts).toHaveLength(1));
  });
});

describe('Vue wrapper: alternate sources', () => {
  const SOURCES = [
    { label: 'Standard', src: 'https://example.com/sd.mp4' },
    { label: 'High', src: 'https://example.com/hd.mp4' },
  ];
  let restoreFullscreen: () => void;
  beforeEach(() => { restoreFullscreen = stubFullscreen(); });
  afterEach(() => restoreFullscreen());

  it('opens the first, and emits sourceChange when the viewer picks the other from the quality menu', async () => {
    const onSourceChange = vi.fn();
    await mount(() => h(KuiPlayer, { sources: SOURCES, onSourceChange }));
    expect(videos()[0]!.getAttribute('src')).toBe(SOURCES[0]!.src);

    const u = userEvent.setup();
    await u.click(chromeOf().getByRole('button', { name: 'Settings' }));
    await u.click(await chromeOf().findByRole('menuitem', { name: /Quality/ }));
    await u.click(chromeOf().getByRole('menuitemradio', { name: 'High' }));
    expect(videos()[0]!.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenCalledWith(1, SOURCES[1]);
  });

  it('plays the second in fullscreen and the first in the card', async () => {
    const onSourceChange = vi.fn();
    await mount(() => h(KuiPlayer, { sources: SOURCES, preferAlternateInFullscreen: true, onSourceChange }));
    const setFullscreen = (on: boolean) => act(() => {
      (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = on ? document.body : null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    setFullscreen(true);
    expect(videos()[0]!.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(1, SOURCES[1]);
    setFullscreen(false);
    expect(videos()[0]!.getAttribute('src')).toBe(SOURCES[0]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(0, SOURCES[0]);
  });

  it('remounts on a new list of sources, and picks up the new first one', async () => {
    const state = reactive({ sources: SOURCES });
    await mount(() => h(KuiPlayer, { sources: state.sources }));
    const next = [{ label: 'Low', src: 'https://example.com/low.mp4' }, { label: 'Top', src: 'https://example.com/top.mp4' }];
    await act(async () => { state.sources = next; await nextTick(); });
    await waitFor(() => expect(videos()[0]!.getAttribute('src')).toBe(next[0]!.src));
    expect(document.querySelectorAll('[data-tepegoz-video-player]')).toHaveLength(1);
  });
});

describe('Vue wrapper: presence', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: false }); });
  afterEach(() => { vi.useRealTimers(); });
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  async function wall(count: number, extra: Record<string, unknown> = {}, providerProps: Record<string, unknown> = {}) {
    const asked = vi.fn();
    const timedOut = vi.fn();
    const continued = vi.fn();
    await mount(() => h(
      PresenceGroupProvider,
      { everyMs: 60 * SECOND, graceMs: 20 * SECOND, ...providerProps },
      () => Array.from({ length: count }, (_, i) => h(KuiPlayer, {
        key: i, src: `https://example.com/${i}.mp4`, title: `Camera ${i + 1}`,
        onPresenceAsk: asked, onPresenceTimeout: timedOut, onPresenceContinue: continued, ...extra,
      })),
    ));
    expect(videos()).toHaveLength(count);
    return { asked, timedOut, continued };
  }

  it('asks once for nine players, and stops all nine when nobody answers', async () => {
    const { asked, timedOut } = await wall(9);
    act(() => { for (const v of videos()) void v.play(); });

    advance(59 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    advance(1 * SECOND);
    const dialogs = document.querySelectorAll('[role="alertdialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent('Still watching?');
    expect(dialogs[0]!.closest('.kui-player')).toBeNull();
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    expect(asked).toHaveBeenCalledTimes(9);

    advance(20 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(timedOut).toHaveBeenCalledTimes(9);
    for (const v of videos()) expect(v.paused).toBe(true);
  });

  it('keeps all playing on Continue and emits presenceContinue for each', async () => {
    const { continued } = await wall(3);
    act(() => { for (const v of videos()) void v.play(); });
    advance(60 * SECOND);
    act(() => { (document.querySelector('.kui-presence-btn') as HTMLButtonElement).click(); });
    expect(continued).toHaveBeenCalledTimes(3);
    advance(59 * SECOND);
    for (const v of videos()) expect(v.paused).toBe(false);
  });

  it('lets a player opt out of its group with :presence="false"', async () => {
    const timedOut = vi.fn();
    await mount(() => h(PresenceGroupProvider, { everyMs: SECOND, graceMs: SECOND }, () => [
      h(KuiPlayer, { src: 'https://example.com/a.mp4', presence: false, onPresenceTimeout: timedOut }),
    ]));
    act(() => { void videos()[0]!.play(); });
    advance(10 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(videos()[0]!.paused).toBe(false);
  });

  it('shows the prompt in the locale it is given', async () => {
    await wall(1, { locale: tr }, { locale: tr, everyMs: SECOND });
    act(() => { void videos()[0]!.play(); });
    advance(SECOND);
    const dialog = within(document.body).getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Hâlâ izliyor musunuz?');
  });

  it('leaves the prompt out with :prompt="false"', async () => {
    await wall(1, {}, { prompt: false, everyMs: SECOND });
    act(() => { void videos()[0]!.play(); });
    advance(SECOND);
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('shares a group made with createPresenceGroup, and hands it to usePresenceGroup()', async () => {
    const group = createPresenceGroup({ everyMs: 5 * SECOND, graceMs: 5 * SECOND });
    let seen: unknown = null;
    const Probe = defineComponent({ setup() { seen = groupOfProvider(); return () => null; } });
    await mount(() => h(PresenceGroupProvider, { group }, () => [h(Probe), h(KuiPlayer, { src: 'https://example.com/a.mp4' })]));
    expect(seen).toBe(group);
    act(() => { void videos()[0]!.play(); });
    advance(5 * SECOND);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it('answers null for usePresenceGroup outside a provider', async () => {
    let seen: unknown = 'unset';
    const Probe = defineComponent({ setup() { seen = groupOfProvider(); return () => null; } });
    await mount(() => h(Probe));
    expect(seen).toBeNull();
  });

  it('rejects a provider with nothing to count', () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createApp({ render: () => h(PresenceGroupProvider) });
    const el = document.createElement('div');
    expect(() => app.mount(el)).toThrow('needs a group, or everyMs and graceMs');
    quiet.mockRestore();
  });

  it('asks inside a single player with its own presence prop', async () => {
    await mount(() => h(KuiPlayer, { src: 'https://example.com/a.mp4', presence: { everyMs: 5 * SECOND, graceMs: 5 * SECOND } }));
    act(() => { void videos()[0]!.play(); });
    advance(5 * SECOND);
    expect(chromeOf().getByRole('alertdialog')).toBeInTheDocument();
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
  });

  it('follows the page\'s group when no provider is around', async () => {
    setPagePresence({ everyMs: 5 * SECOND, graceMs: 5 * SECOND });
    await mount(() => [h(KuiPlayer, { src: 'https://example.com/a.mp4' }), h(KuiPlayer, { src: 'https://example.com/b.mp4' })]);
    act(() => { for (const v of videos()) void v.play(); });
    advance(5 * SECOND);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it('removes its prompt when the provider goes away', async () => {
    const show = ref(true);
    await mount(() => (show.value ? [h(PresenceGroupProvider, { everyMs: SECOND, graceMs: SECOND }, () => [h(KuiPlayer, { src: 'https://example.com/a.mp4' })])] : []));
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    await act(async () => { show.value = false; await nextTick(); });
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-tepegoz-video-player]')).toHaveLength(0);
  });
});
