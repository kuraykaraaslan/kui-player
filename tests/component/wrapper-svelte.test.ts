import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { kuiPlayer, createPresenceGroup, setPagePresence, type SkinOptions } from '../../wrappers/svelte/kuiPlayer';
import { tr } from '../../react/i18n/locales/tr';
import PresenceHost from './fixtures/PresenceHost.svelte';
import SetHost from './fixtures/SetHost.svelte';
import { fakeAdapter, pageVideo, stubFullscreen, stubObservers } from './skin-harness';

/*
 * The Svelte wrapper: `use:kuiPlayer` takes the live-stream options as skin mode
 * does, keeps callbacks current, and `providePresenceGroup()` gives a page of
 * players one timer and one prompt through component context.
 */

const LIVE = 'https://example.com/cam/live.m3u8';
const SECOND = 1000;

let observers: ReturnType<typeof stubObservers>;
let cleanups: (() => void)[];

beforeEach(() => { observers = stubObservers(); cleanups = []; });
afterEach(() => {
  act(() => { cleanups.forEach((c) => c()); });
  setPagePresence(null);
  observers.restore();
  document.body.innerHTML = '';
});

type Action = ReturnType<typeof kuiPlayer>;
function useAction(video: HTMLVideoElement, options: SkinOptions): Action {
  let action!: Action;
  act(() => { action = kuiPlayer(video, options); });
  cleanups.push(() => action.destroy());
  return action;
}
const chromeOf = (index = 0) => {
  const host = document.querySelectorAll<HTMLElement>('[data-tepegoz-video-player]')[index]!;
  return within(host.shadowRoot as unknown as HTMLElement);
};

describe('Svelte action: live', () => {
  it('opens an adapter-managed source with the live hint and options', async () => {
    const { adapter, hosts } = fakeAdapter();
    useAction(pageVideo(), { adapters: [adapter], src: LIVE, live: { credentials: 'include' } });
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(hosts[0]!.live).toMatchObject({ hinted: true, credentials: 'include' });
  });

  it('keeps working with just the old options', () => {
    const video = pageVideo({ src: 'https://example.com/a.mp4' });
    useAction(video, { accent: '#f97316' });
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4');
    expect(video.hasAttribute('data-kui-skinned')).toBe(true);
  });

  it('calls `on` handlers, and the newest ones after an update', async () => {
    const { adapter, hosts } = fakeAdapter();
    const first = vi.fn();
    const second = vi.fn();
    const base = { adapters: [adapter], src: LIVE, live: true };
    const action = useAction(pageVideo(), { ...base, on: { 'live:reconnect': first } });
    await waitFor(() => expect(hosts).toHaveLength(1));

    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'auth' }));
    expect(first).toHaveBeenCalledTimes(1);

    act(() => action.update({ ...base, on: { 'live:reconnect': second } }));
    expect(adapter.attach).toHaveBeenCalledTimes(1);   // a new handler is not a remount
    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 2, reason: 'network' }));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith({ attempt: 2, reason: 'network' });
  });

  it('changes live in place and remounts for anything else', async () => {
    const { adapter, hosts } = fakeAdapter();
    const base = { adapters: [adapter], src: LIVE };
    const video = pageVideo();
    const action = useAction(video, { ...base, live: true });
    await waitFor(() => expect(hosts).toHaveLength(1));
    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => hosts[0]!.updateLive?.(true));
    await chromeOf().findByRole('button', { name: /LIVE|Go to live edge/ });
    expect(chromeOf().queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();

    act(() => action.update({ ...base, live: { dvr: true } }));
    expect(await chromeOf().findByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    expect(adapter.attach).toHaveBeenCalledTimes(1);

    act(() => action.update({ ...base, live: { dvr: true }, accent: '#f97316' }));
    await waitFor(() => expect(adapter.attach).toHaveBeenCalledTimes(2));
    expect(adapter.detach).toHaveBeenCalledTimes(1);
  });

  it('does not remount for an equal inline `sources` or `presence` literal', async () => {
    const { adapter, hosts } = fakeAdapter();
    const make = (): SkinOptions => ({
      adapters: [adapter],
      sources: [{ label: 'Standard', src: LIVE }, { label: 'High', src: 'https://example.com/hd.m3u8' }],
      presence: { everyMs: 1000, graceMs: 1000 },
    });
    const action = useAction(pageVideo(), make());
    await waitFor(() => expect(hosts).toHaveLength(1));
    act(() => action.update(make()));
    expect(adapter.attach).toHaveBeenCalledTimes(1);
    expect(adapter.detach).not.toHaveBeenCalled();
  });

  it('removes the skin on destroy', () => {
    const video = pageVideo();
    const action = useAction(video, {});
    expect(document.querySelectorAll('[data-tepegoz-video-player]')).toHaveLength(1);
    act(() => action.destroy());
    expect(document.querySelectorAll('[data-tepegoz-video-player]')).toHaveLength(0);
    expect(video.hasAttribute('data-kui-skinned')).toBe(false);
  });
});

describe('Svelte action: load on first play', () => {
  it('attaches nothing until Play is pressed', async () => {
    const { adapter, hosts } = fakeAdapter();
    useAction(pageVideo(), { adapters: [adapter], src: LIVE, live: true, loadOnPlay: true });
    await act(async () => { await Promise.resolve(); });
    expect(adapter.attach).not.toHaveBeenCalled();
    await userEvent.setup().click(chromeOf().getAllByRole('button', { name: 'Play' })[0]!);
    await waitFor(() => expect(hosts).toHaveLength(1));
  });
});

describe('Svelte action: alternate sources', () => {
  const SOURCES = [
    { label: 'Standard', src: 'https://example.com/sd.mp4' },
    { label: 'High', src: 'https://example.com/hd.mp4' },
  ];
  let restoreFullscreen: () => void;
  beforeEach(() => { restoreFullscreen = stubFullscreen(); });
  afterEach(() => restoreFullscreen());

  it('opens the first, and calls onSourceChange for the viewer\'s pick and for the fullscreen rule', async () => {
    const video = pageVideo();
    const onSourceChange = vi.fn();
    useAction(video, { sources: SOURCES, preferAlternateInFullscreen: true, onSourceChange });
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);

    const setFullscreen = (on: boolean) => act(() => {
      (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = on ? document.body : null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    setFullscreen(true);
    expect(video.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(1, SOURCES[1]);
    setFullscreen(false);
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);

    const u = userEvent.setup();
    await u.click(chromeOf().getByRole('button', { name: 'Settings' }));
    await u.click(await chromeOf().findByRole('menuitem', { name: /Quality/ }));
    await u.click(chromeOf().getByRole('menuitemradio', { name: 'High' }));
    expect(video.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(1, SOURCES[1]);
  });
});

describe('Svelte: presence', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: false }); });
  afterEach(() => { vi.useRealTimers(); });
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
  const tiles = () => Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-testid="tile"]'));

  function host(props: Record<string, unknown>) {
    const target = document.createElement('div');
    document.body.appendChild(target);
    let component!: ReturnType<typeof mount>;
    act(() => { component = mount(PresenceHost, { target, props }); flushSync(); });
    cleanups.push(() => unmount(component));
  }

  it('asks once for nine players that read the group from context, and stops all nine', () => {
    const asked = vi.fn();
    const timedOut = vi.fn();
    host({ count: 9, everyMs: 60 * SECOND, graceMs: 20 * SECOND, onAsk: asked, onTimeout: timedOut });
    expect(tiles()).toHaveLength(9);
    act(() => { for (const v of tiles()) void v.play(); });

    advance(59 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    advance(1 * SECOND);
    const dialogs = document.querySelectorAll('[role="alertdialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent('Still watching?');
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    expect(asked).toHaveBeenCalledTimes(9);

    advance(20 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(timedOut).toHaveBeenCalledTimes(9);
    for (const v of tiles()) expect(v.paused).toBe(true);
  });

  it('keeps a player with presence: false out of the group', () => {
    host({ count: 1, everyMs: SECOND, graceMs: SECOND });
    const outsider = document.querySelector<HTMLVideoElement>('[data-testid="outsider"]')!;
    act(() => { void outsider.play(); });
    advance(10 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(outsider.paused).toBe(false);
  });

  it('shows the prompt in the given locale', () => {
    host({ count: 1, everyMs: SECOND, graceMs: 10 * SECOND, locale: tr });
    act(() => { void tiles()[0]!.play(); });
    advance(SECOND);
    expect(within(document.body).getByRole('alertdialog')).toHaveTextContent('Hâlâ izliyor musunuz?');
  });

  it('leaves the prompt out with prompt: false', () => {
    host({ count: 1, everyMs: SECOND, graceMs: SECOND, prompt: false });
    act(() => { void tiles()[0]!.play(); });
    advance(SECOND);
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('shares a group made with createPresenceGroup', () => {
    const group = createPresenceGroup({ everyMs: 5 * SECOND, graceMs: 5 * SECOND });
    host({ count: 2, group });
    act(() => { for (const v of tiles()) void v.play(); });
    advance(5 * SECOND);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it('removes the prompt when the component is destroyed', () => {
    host({ count: 1, everyMs: SECOND, graceMs: SECOND });
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    act(() => { cleanups.splice(0).forEach((c) => c()); });
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(0);
  });

  it('rejects a provider with nothing to count', () => {
    const target = document.createElement('div');
    expect(() => mount(PresenceHost, { target, props: { count: 1 } })).toThrow('needs a group, or everyMs and graceMs');
  });

  it('hands the group set by an ancestor to getPresenceGroup(), and null outside one', () => {
    const group = createPresenceGroup({ everyMs: SECOND, graceMs: SECOND });
    const seen = vi.fn();
    const target = document.createElement('div');
    const inside = mount(SetHost, { target, props: { group, onGroup: seen } });
    flushSync();
    expect(seen).toHaveBeenLastCalledWith(group);
    unmount(inside);
  });

  it('follows the page\'s group when no component provides one', () => {
    setPagePresence({ everyMs: 5 * SECOND, graceMs: 5 * SECOND });
    const a = pageVideo();
    const b = pageVideo();
    useAction(a, {});
    useAction(b, {});
    act(() => { void a.play(); void b.play(); });
    advance(5 * SECOND);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });
});
