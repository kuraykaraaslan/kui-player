import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountSkin, type SkinHandle } from '../../embed/mountSkin';
import { createPagePresenceGroup, mountPresencePrompt, setPagePresence } from '../../embed/pagePresence';
import { createPresenceGroup } from '../../modules/videoplayer/videoplayer.presence';
import { tr } from '../../react/i18n/locales/tr';
import { fakeAdapter, pageVideo, stubFullscreen, stubObservers } from './skin-harness';

/*
 * Skin mode with the live-stream options: the engine gets what the React
 * `<VideoPlayer>` would give it, the chrome shows it, and a page of players
 * shares one "Still watching?".
 */

const LIVE = 'https://example.com/cam/live.m3u8';
const SECOND = 1000;

let observers: ReturnType<typeof stubObservers>;
let unmounts: (() => void)[];

beforeEach(() => {
  observers = stubObservers();
  unmounts = [];
});
afterEach(() => {
  unmounts.forEach((u) => u());
  setPagePresence(null);
  observers.restore();
  document.body.innerHTML = '';
});

/** Mount and keep for teardown. React renders the chrome inside `act`. */
function skin(video: HTMLVideoElement, options: Parameters<typeof mountSkin>[1] = {}): SkinHandle {
  let handle!: SkinHandle;
  act(() => { handle = mountSkin(video, options); });
  unmounts.push(handle);
  return handle;
}

/** The overlay's shadow root for one video. */
const chromeOf = (index = 0) => {
  const host = document.querySelectorAll<HTMLElement>('[data-tepegoz-video-player]')[index]!;
  return within(host.shadowRoot as unknown as HTMLElement);
};

describe('skin mode: live', () => {
  it('hands the live hint and options to the adapter, and shows a LIVE badge with no seek bar', async () => {
    const { adapter, hosts } = fakeAdapter();
    const video = pageVideo();
    skin(video, { adapters: [adapter], src: LIVE, live: { credentials: 'include' } });

    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(hosts[0]!.live).toMatchObject({ hinted: true, credentials: 'include', stopWhenHidden: true });
    // The adapter owns the pipeline, so the element has no address of its own.
    expect(video.hasAttribute('src')).toBe(false);

    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => { hosts[0]!.updateLive?.(true); video.currentTime = 99; });
    expect(await chromeOf().findByRole('button', { name: 'LIVE' })).toBeInTheDocument();
    expect(chromeOf().queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();
  });

  it('keeps a seek bar over the DVR window with live.dvr', async () => {
    const { adapter, hosts } = fakeAdapter();
    const video = pageVideo();
    skin(video, { adapters: [adapter], src: LIVE, live: { dvr: true } });
    await waitFor(() => expect(hosts).toHaveLength(1));
    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => hosts[0]!.updateLive?.(true));
    await chromeOf().findByRole('button', { name: /LIVE|Go to live edge/ });
    expect(chromeOf().getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
  });

  it('changes live in place', async () => {
    const { adapter, hosts } = fakeAdapter();
    const video = pageVideo();
    const handle = skin(video, { adapters: [adapter], src: LIVE, live: true });
    await waitFor(() => expect(hosts).toHaveLength(1));
    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => hosts[0]!.updateLive?.(true));
    await chromeOf().findByRole('button', { name: /LIVE|Go to live edge/ });
    expect(chromeOf().queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();

    act(() => handle.update({ live: { dvr: true } }));
    expect(await chromeOf().findByRole('slider', { name: 'Seek' })).toBeInTheDocument();
    expect(adapter.attach).toHaveBeenCalledTimes(1);
  });

  it('reports reconnects and refusals through `on`', async () => {
    const { adapter, hosts } = fakeAdapter();
    const reconnect = vi.fn();
    const recovered = vi.fn();
    const error = vi.fn();
    skin(pageVideo(), {
      adapters: [adapter], src: LIVE, live: true,
      on: { 'live:reconnect': reconnect, 'live:recovered': recovered, error },
    });
    await waitFor(() => expect(hosts).toHaveLength(1));

    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'auth' }));
    expect(reconnect).toHaveBeenCalledWith({ attempt: 1, reason: 'auth' });
    act(() => hosts[0]!.updateRecovery?.({ reconnecting: false }));
    expect(recovered).toHaveBeenCalledTimes(1);

    act(() => {
      hosts[0]!.reportError({
        code: 2, name: 'LIVE_REFUSED', message: 'The live stream refused the connection.', recoverable: true,
        detail: 'This month\'s camera minutes are used up.',
      });
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ name: 'LIVE_REFUSED' }));
    expect(await chromeOf().findByRole('alert')).toHaveTextContent('camera minutes are used up');
  });

  it('stops a live element that is scrolled out of view, and picks it up again', async () => {
    const { adapter, hosts } = fakeAdapter();
    const suspend = vi.fn();
    const resume = vi.fn();
    const video = pageVideo();
    skin(video, { adapters: [adapter], src: LIVE, live: true, on: { suspend, resume } });
    await waitFor(() => expect(hosts).toHaveLength(1));
    act(() => hosts[0]!.updateLive?.(true));
    act(() => { void video.play(); });

    // The visibility watch is the last observer made; skin mode made its own two before it.
    const watcher = observers.intersections[observers.intersections.length - 1]!;
    act(() => watcher([{ isIntersecting: false }]));
    expect(suspend).toHaveBeenCalledWith({ reason: 'hidden' });
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    act(() => watcher([{ isIntersecting: true }]));
    expect(resume).toHaveBeenCalledWith({ reason: 'hidden' });
    expect(adapter.resume).toHaveBeenCalledTimes(1);
  });

  it('leaves the element alone when none of the options are given', () => {
    const video = pageVideo({ src: 'https://example.com/a.mp4' });
    const handle = skin(video);
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4');
    expect(handle.engine.adapter).toBeNull();
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
  });
});

describe('skin mode: load on first play', () => {
  it('attaches nothing until Play is pressed', async () => {
    const { adapter, hosts } = fakeAdapter();
    skin(pageVideo(), { adapters: [adapter], src: LIVE, live: true, loadOnPlay: true });
    await act(async () => { await Promise.resolve(); });
    expect(adapter.attach).not.toHaveBeenCalled();

    await userEvent.setup().click(chromeOf().getAllByRole('button', { name: 'Play' })[0]!);
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(adapter.attach).toHaveBeenCalledTimes(1);
  });

  it('loads at once for an element that autoplays', async () => {
    const { adapter, hosts } = fakeAdapter();
    skin(pageVideo({ autoplay: '' }), { adapters: [adapter], src: LIVE, loadOnPlay: true });
    await waitFor(() => expect(hosts).toHaveLength(1));
  });

  it('loads when loadOnPlay is turned off in place', async () => {
    const { adapter, hosts } = fakeAdapter();
    const handle = skin(pageVideo(), { adapters: [adapter], src: LIVE, loadOnPlay: true });
    expect(adapter.attach).not.toHaveBeenCalled();
    act(() => handle.update({ loadOnPlay: false }));
    await waitFor(() => expect(hosts).toHaveLength(1));
  });

  it('does not hold back a source no adapter claims', () => {
    const { adapter } = fakeAdapter();
    const video = pageVideo({ src: 'https://example.com/a.mp4' });
    skin(video, { adapters: [adapter], loadOnPlay: true });
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4');
    expect(adapter.attach).not.toHaveBeenCalled();
  });
});

describe('skin mode: presence', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: false }); });
  afterEach(() => { vi.useRealTimers(); });
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  function wall(count: number, options: Parameters<typeof mountSkin>[1] = {}) {
    const videos = Array.from({ length: count }, (_, i) => pageVideo({ src: `https://example.com/${i}.mp4`, title: `Camera ${i + 1}` }));
    const handles = videos.map((v) => skin(v, options));
    act(() => { for (const v of videos) void v.play(); });
    return { videos, handles };
  }

  it('asks once for nine players that share a group, and stops all nine on no answer', () => {
    const group = createPagePresenceGroup({ everyMs: 60 * SECOND, graceMs: 20 * SECOND });
    unmounts.push(() => group.dispose());
    const asked = vi.fn();
    const timedOut = vi.fn();
    const { videos } = wall(9, { presence: group, on: { 'presence:ask': asked, 'presence:timeout': timedOut } });

    advance(59 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    advance(1 * SECOND);

    const dialogs = document.querySelectorAll('[role="alertdialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent('Still watching?');
    // One question for the page, not one inside each tile.
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    expect(asked).toHaveBeenCalledTimes(9);

    advance(20 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(timedOut).toHaveBeenCalledTimes(9);
    for (const v of videos) expect(v.paused).toBe(true);
    // Each tile says so and has its own Play button.
    for (let i = 0; i < 9; i += 1) expect(chromeOf(i).getByText('Paused to save data')).toBeInTheDocument();
  });

  it('keeps all of them playing when the viewer says Continue', () => {
    const group = createPagePresenceGroup({ everyMs: 60 * SECOND, graceMs: 20 * SECOND });
    unmounts.push(() => group.dispose());
    const continued = vi.fn();
    const { videos } = wall(3, { presence: group, on: { 'presence:continue': continued } });
    advance(60 * SECOND);
    act(() => { (document.querySelector('.kui-presence-btn') as HTMLButtonElement).click(); });
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(continued).toHaveBeenCalledTimes(3);
    advance(59 * SECOND);
    for (const v of videos) expect(v.paused).toBe(false);
  });

  it('gives every skinned player the page\'s group', () => {
    setPagePresence({ everyMs: 10 * SECOND, graceMs: 5 * SECOND });
    wall(4);
    advance(10 * SECOND);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it('lets a player opt out of the page\'s group, by option or by attribute', () => {
    setPagePresence({ everyMs: 10 * SECOND, graceMs: 5 * SECOND });
    const optionOut = pageVideo();
    const attributeOut = pageVideo({ 'data-kui-presence': 'off' });
    skin(optionOut, { presence: false });
    skin(attributeOut);
    act(() => { void optionOut.play(); void attributeOut.play(); });
    advance(60 * SECOND);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(optionOut.paused).toBe(false);
    expect(attributeOut.paused).toBe(false);
  });

  it('asks inside a single player that has its own presence option', () => {
    const video = pageVideo();
    skin(video, { presence: { everyMs: 5 * SECOND, graceMs: 5 * SECOND } });
    act(() => { void video.play(); });
    advance(5 * SECOND);
    expect(chromeOf().getByRole('alertdialog')).toHaveTextContent('Still watching?');
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
    advance(5 * SECOND);
    expect(chromeOf().getByText('Paused to save data')).toBeInTheDocument();
  });

  it('joins and leaves a group in place', () => {
    const video = pageVideo();
    const handle = skin(video);
    act(() => { void video.play(); });
    advance(60 * SECOND);
    expect(video.paused).toBe(false);

    act(() => handle.update({ presence: { everyMs: 5 * SECOND, graceMs: 5 * SECOND } }));
    advance(5 * SECOND);
    expect(chromeOf().getByRole('alertdialog')).toBeInTheDocument();
    act(() => handle.update({ presence: false }));
    expect(chromeOf().queryByRole('alertdialog')).not.toBeInTheDocument();
    advance(60 * SECOND);
    expect(video.paused).toBe(false);
  });

  it('does not restart a running timer when an unrelated option is re-applied', () => {
    const video = pageVideo();
    const presence = { everyMs: 10 * SECOND, graceMs: 5 * SECOND };
    const handle = skin(video, { presence });
    act(() => { void video.play(); });
    advance(9 * SECOND);
    act(() => handle.update({ presence: { ...presence }, live: true }));
    advance(1 * SECOND);
    expect(chromeOf().getByRole('alertdialog')).toBeInTheDocument();
  });

  it('shows the prompt in another language, and removes it with the group', () => {
    const group = createPresenceGroup({ everyMs: SECOND, graceMs: 10 * SECOND });
    const unmountPrompt = mountPresencePrompt(group, { locale: tr });
    const video = pageVideo();
    skin(video, { presence: group, locale: tr });
    act(() => { void video.play(); });
    advance(SECOND);
    const dialog = within(document.body).getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Hâlâ izliyor musunuz?');
    expect(within(dialog).getByRole('button', { name: 'Devam et' })).toBeInTheDocument();

    act(() => unmountPrompt());
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    group.dispose();
  });

  it('replaces the page\'s group, and removes its prompt, when it is set again or cleared', () => {
    const first = setPagePresence({ everyMs: SECOND, graceMs: SECOND });
    const second = setPagePresence({ everyMs: 2 * SECOND, graceMs: SECOND });
    expect(second).not.toBe(first);
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    expect(setPagePresence(null)).toBeNull();
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(0);
  });

  it('rejects options with nothing to count', () => {
    expect(() => setPagePresence({ everyMs: 0, graceMs: 1 })).toThrow(TypeError);
  });
});

describe('skin mode: alternate sources', () => {
  const SOURCES = [
    { label: 'Standard', src: 'https://example.com/sd.mp4' },
    { label: 'High', src: 'https://example.com/hd.mp4' },
  ];
  let restoreFullscreen: () => void;
  beforeEach(() => { restoreFullscreen = stubFullscreen(); });
  afterEach(() => restoreFullscreen());

  const setFullscreen = (on: boolean) => act(() => {
    (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = on ? document.body : null;
    document.dispatchEvent(new Event('fullscreenchange'));
  });

  it('opens the first and lists both in the quality menu', async () => {
    const video = pageVideo();
    skin(video, { sources: SOURCES });
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);

    const u = userEvent.setup();
    await u.click(chromeOf().getByRole('button', { name: 'Settings' }));
    await u.click(await chromeOf().findByRole('menuitem', { name: /Quality/ }));
    expect(chromeOf().getByRole('menuitemradio', { name: 'Standard' })).toBeChecked();
    expect(chromeOf().getByRole('menuitemradio', { name: 'High' })).not.toBeChecked();
  });

  it('switches when the viewer picks the other one, says so, and keeps the place', async () => {
    const video = pageVideo();
    const onSourceChange = vi.fn();
    skin(video, { sources: SOURCES, onSourceChange });
    video.currentTime = 42;

    const u = userEvent.setup();
    await u.click(chromeOf().getByRole('button', { name: 'Settings' }));
    await u.click(await chromeOf().findByRole('menuitem', { name: /Quality/ }));
    await u.click(chromeOf().getByRole('menuitemradio', { name: 'High' }));
    expect(video.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenCalledWith(1, SOURCES[1]);

    video.currentTime = 0;   // what a reload does
    act(() => { video.dispatchEvent(new Event('loadedmetadata')); });
    expect(video.currentTime).toBe(42);
  });

  it('plays the second in fullscreen and the first in the card', () => {
    const video = pageVideo();
    const onSourceChange = vi.fn();
    skin(video, { sources: SOURCES, preferAlternateInFullscreen: true, onSourceChange });
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);
    expect(onSourceChange).not.toHaveBeenCalled();

    setFullscreen(true);
    expect(video.getAttribute('src')).toBe(SOURCES[1]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(1, SOURCES[1]);
    setFullscreen(false);
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);
    expect(onSourceChange).toHaveBeenLastCalledWith(0, SOURCES[0]);
  });

  it('leaves the source alone in fullscreen unless asked to', () => {
    const video = pageVideo();
    skin(video, { sources: SOURCES });
    setFullscreen(true);
    expect(video.getAttribute('src')).toBe(SOURCES[0]!.src);
  });

  it('hands an alternate to the adapter that claims it, and back to the element when none does', async () => {
    const { adapter, hosts } = fakeAdapter();
    const video = pageVideo();
    skin(video, {
      adapters: [adapter], preferAlternateInFullscreen: true,
      sources: [{ label: 'Standard', src: LIVE }, { label: 'High', src: 'https://example.com/hd.mp4' }],
    });
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(adapter.attach).toHaveBeenCalledWith(video, LIVE, expect.anything());
    expect(video.hasAttribute('src')).toBe(false);

    setFullscreen(true);
    expect(adapter.detach).toHaveBeenCalled();
    expect(video.getAttribute('src')).toBe('https://example.com/hd.mp4');
  });

  it('takes the held-back first play into account: the entry chosen before Play is the one that loads', async () => {
    const { adapter } = fakeAdapter();
    const u = userEvent.setup();
    skin(pageVideo(), {
      adapters: [adapter], loadOnPlay: true,
      sources: [{ label: 'Standard', src: LIVE }, { label: 'High', src: 'https://example.com/hd.m3u8' }],
    });
    await u.click(chromeOf().getByRole('button', { name: 'Settings' }));
    await u.click(await chromeOf().findByRole('menuitem', { name: /Quality/ }));
    await u.click(chromeOf().getByRole('menuitemradio', { name: 'High' }));
    expect(adapter.attach).not.toHaveBeenCalled();
    await u.click(chromeOf().getAllByRole('button', { name: 'Play' })[0]!);
    await waitFor(() => expect(adapter.attach).toHaveBeenCalledTimes(1));
    expect(adapter.attach).toHaveBeenCalledWith(expect.anything(), 'https://example.com/hd.m3u8', expect.anything());
  });
});
