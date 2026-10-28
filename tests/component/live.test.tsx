import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { PresenceGroupProvider, VideoPlayer, createPresenceGroup } from '../../react';
import { tr } from '../../react/i18n/locales/tr';
import { de } from '../../react/i18n/locales/de';
import { es } from '../../react/i18n/locales/es';
import { fr } from '../../react/i18n/locales/fr';
import { ar } from '../../react/i18n/locales/ar';
import { en } from '../../react/i18n/index';
import type { MediaAdapter, MediaAdapterHost } from '../../modules/videoplayer/adapters/adapter.types';
import { emit } from '../setup';

const LIVE = 'https://example.com/cam/live.m3u8';

/** A stand-in for hls.js that hands the host to the test, so the "stream" can say what it is. */
function liveAdapter() {
  const hosts: MediaAdapterHost[] = [];
  const adapter = {
    name: 'fake',
    canPlay: (src: string) => src.endsWith('.m3u8'),
    attach: vi.fn(async (_v: HTMLVideoElement, _s: string, host: MediaAdapterHost) => { hosts.push(host); }),
    getQualities: () => [],
    setQuality: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    detach: vi.fn(),
  } satisfies MediaAdapter;
  return { adapter, hosts };
}

function seekable(video: HTMLVideoElement, start: number, end: number) {
  Object.defineProperty(video, 'seekable', {
    configurable: true,
    value: { length: 1, start: () => start, end: () => end },
  });
}

describe('live mode', () => {
  it('shows a LIVE badge and no seek bar for a stream without an end', async () => {
    const { adapter, hosts } = liveAdapter();
    const { container } = render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    // Nothing is known yet: an ordinary player.
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument();

    const video = container.querySelector('video') as HTMLVideoElement;
    seekable(video, 0, 100);
    act(() => hosts[0]!.updateLive?.(true));

    act(() => { emit(video, 'timeupdate', { currentTime: 99 }); });
    expect(await screen.findByRole('button', { name: 'LIVE' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rewind/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Forward/ })).not.toBeInTheDocument();
  });

  it('offers "back to live" once the viewer is behind the edge', async () => {
    const { adapter, hosts } = liveAdapter();
    const { container } = render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    const video = container.querySelector('video') as HTMLVideoElement;
    seekable(video, 0, 100);
    act(() => hosts[0]!.updateLive?.(true));

    act(() => { emit(video, 'timeupdate', { currentTime: 99 }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'LIVE' })).toBeDisabled());

    act(() => { emit(video, 'timeupdate', { currentTime: 40 }); });
    const back = await screen.findByRole('button', { name: 'Go to live edge' });
    await userEvent.setup().click(back);
    expect(video.currentTime).toBe(100);
  });

  it('keeps a seek bar over the DVR window when asked to', async () => {
    const { adapter, hosts } = liveAdapter();
    const { container } = render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} live={{ dvr: true }} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    seekable(container.querySelector('video') as HTMLVideoElement, 0, 100);
    act(() => hosts[0]!.updateLive?.(true));
    await screen.findByRole('button', { name: /LIVE|Go to live edge/ });
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
  });

  it('hands the page\'s "this is live" to the adapter, and the live options with it', async () => {
    const { adapter, hosts } = liveAdapter();
    render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} live={{ credentials: 'include' }} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(hosts[0]!.live).toMatchObject({ hinted: true, credentials: 'include', stopWhenHidden: true });
  });

  it('shows a reconnect as a spinner, not an error, and the source\'s own words when it gives up', async () => {
    const { adapter, hosts } = liveAdapter();
    render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    const host = hosts[0]!;

    act(() => { host.updateLive?.(true); host.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'auth' }); });
    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      host.reportError({
        code: 2, name: 'LIVE_REFUSED', message: 'The live stream refused the connection.', recoverable: true,
        detail: 'This month\'s camera minutes are used up.',
      });
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The live stream refused the connection.');
    expect(alert).toHaveTextContent('This month\'s camera minutes are used up.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('is announced in the live region', async () => {
    const { adapter, hosts } = liveAdapter();
    const { container } = render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    const region = container.querySelector('[aria-live="polite"]') as HTMLElement;
    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'network' }));
    await waitFor(() => expect(region).toHaveTextContent('Reconnecting to the live stream'));
  });
});

describe('stop when scrolled away', () => {
  type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let callbacks: IOCallback[];
  const realIO = globalThis.IntersectionObserver;
  beforeEach(() => {
    callbacks = [];
    globalThis.IntersectionObserver = class {
      constructor(cb: IOCallback) { callbacks.push(cb); }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => { globalThis.IntersectionObserver = realIO; });

  it('stops loading when the player leaves the viewport, and picks the stream up again when it is back', async () => {
    const { adapter, hosts } = liveAdapter();
    const { container } = render(<VideoPlayer src={LIVE} adapters={[adapter]} enableCast={false} />);
    await waitFor(() => expect(hosts).toHaveLength(1));
    const video = container.querySelector('video') as HTMLVideoElement;
    act(() => hosts[0]!.updateLive?.(true));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Play' }));
    expect(video.paused).toBe(false);

    act(() => callbacks[callbacks.length - 1]!([{ isIntersecting: false }]));
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(true);

    act(() => callbacks[callbacks.length - 1]!([{ isIntersecting: true }]));
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(false);
  });

  it('does nothing for an ordinary video', async () => {
    render(<VideoPlayer src="https://example.com/a.mp4" enableCast={false} />);
    expect(callbacks).toHaveLength(0);
  });
});


describe('presence check', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: false }); });
  afterEach(() => { vi.useRealTimers(); });

  const SECOND = 1000;
  const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  function wall(count = 9) {
    const utils = render(
      <PresenceGroupProvider everyMs={60 * SECOND} graceMs={20 * SECOND}>
        {Array.from({ length: count }, (_, i) => (
          <VideoPlayer key={i} src={`https://example.com/${i}.mp4`} title={`Camera ${i + 1}`} enableCast={false} />
        ))}
      </PresenceGroupProvider>,
    );
    const videos = Array.from(utils.container.querySelectorAll('video'));
    expect(videos).toHaveLength(count);
    act(() => { for (const v of videos) void v.play(); });
    return { ...utils, videos };
  }

  it('shows one "Still watching?" for nine players after the interval', () => {
    wall();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    advance(59 * SECOND);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    advance(1 * SECOND);

    const dialogs = screen.getAllByRole('alertdialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveTextContent('Still watching?');
    expect(dialogs[0]).toHaveTextContent('Playback stops in 20s to save data.');
    // The question lives on the page, not inside a tile.
    expect(dialogs[0]!.closest('.kui-player')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  });

  it('counts the grace period down', () => {
    wall(2);
    advance(60 * SECOND);
    advance(5 * SECOND);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Playback stops in 15s');
  });

  it('keeps all nine playing when the viewer says Continue', () => {
    const { videos } = wall();
    advance(60 * SECOND);
    act(() => { screen.getByRole('button', { name: 'Continue' }).click(); });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    advance(59 * SECOND);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.kui-overlay--paused')).toHaveLength(0);
    for (const v of videos) expect(v.paused).toBe(false);

    // ...and a full interval after the answer, it asks again.
    advance(1 * SECOND);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('stops all nine, with a Play button each, when nobody answers within the grace period', () => {
    const { videos } = wall();
    advance(60 * SECOND);
    advance(20 * SECOND);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.kui-overlay--paused')).toHaveLength(9);
    for (const v of videos) expect(v.paused).toBe(true);
  });

  it('starts one tile again with its own Play button', () => {
    const { videos } = wall(3);
    advance(80 * SECOND);
    const paused = Array.from(document.querySelectorAll<HTMLElement>('.kui-overlay--paused'));
    expect(paused).toHaveLength(3);

    act(() => { within(paused[1]!).getByRole('button', { name: 'Play' }).click(); });
    expect(videos[1]!.paused).toBe(false);
    expect(videos[0]!.paused).toBe(true);
    expect(document.querySelectorAll('.kui-overlay--paused')).toHaveLength(2);
  });

  it('works in a language other than English', () => {
    render(
      <PresenceGroupProvider everyMs={SECOND} graceMs={10 * SECOND} locale={tr}>
        <VideoPlayer src="https://example.com/a.mp4" enableCast={false} locale={tr} />
      </PresenceGroupProvider>,
    );
    act(() => { void (document.querySelector('video') as HTMLVideoElement).play(); });
    advance(SECOND);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Hâlâ izliyor musunuz?');
    expect(within(dialog).getByRole('button', { name: 'Devam et' })).toBeInTheDocument();
  });

  it('is accessible', async () => {
    vi.useRealTimers();
    const group = createPresenceGroup({ everyMs: 10, graceMs: 60_000 });
    const { container } = render(
      <PresenceGroupProvider group={group}>
        <VideoPlayer src="https://example.com/a.mp4" enableCast={false} />
      </PresenceGroupProvider>,
    );
    act(() => { void (container.querySelector('video') as HTMLVideoElement).play(); });
    await screen.findByRole('alertdialog');
    const results = await axe.run(document.body, { rules: { region: { enabled: false } }, resultTypes: ['violations'] });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('asks inside a single player that has its own presence option', () => {
    const { container } = render(
      <VideoPlayer src="https://example.com/a.mp4" enableCast={false} presence={{ everyMs: 5 * SECOND, graceMs: 5 * SECOND }} />,
    );
    act(() => { void (container.querySelector('video') as HTMLVideoElement).play(); });
    advance(5 * SECOND);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.closest('.kui-player')).not.toBeNull();
    advance(5 * SECOND);
    expect(container.querySelector('.kui-overlay--paused')).toHaveTextContent('Paused to save data');
  });

  it('lets a player opt out of its group', () => {
    render(
      <PresenceGroupProvider everyMs={SECOND} graceMs={SECOND}>
        <VideoPlayer src="https://example.com/a.mp4" enableCast={false} presence={false} />
      </PresenceGroupProvider>,
    );
    act(() => { void (document.querySelector('video') as HTMLVideoElement).play(); });
    advance(10 * SECOND);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('rejects a provider with nothing to count', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<PresenceGroupProvider>x</PresenceGroupProvider>)).toThrow();
    quiet.mockRestore();
  });
});

describe('alternate sources', () => {
  const SOURCES = [
    { label: 'Standard', src: 'https://example.com/sd.mp4' },
    { label: 'High', src: 'https://example.com/hd.mp4' },
  ];
  const srcOf = (container: HTMLElement) => container.querySelector('video source')?.getAttribute('src');

  it('plays the first and lists both in the quality menu', async () => {
    const u = userEvent.setup();
    const { container } = render(<VideoPlayer sources={SOURCES} enableCast={false} />);
    expect(srcOf(container)).toBe(SOURCES[0]!.src);

    await u.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menuitem', { name: /Quality/ })).toHaveTextContent('Standard');
    await u.click(screen.getByRole('menuitem', { name: /Quality/ }));
    expect(screen.getByRole('menuitemradio', { name: 'Standard' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: 'High' })).not.toBeChecked();
  });

  it('switches the source when the viewer picks the other one, and says so', async () => {
    const u = userEvent.setup();
    const onSourceChange = vi.fn();
    const { container } = render(<VideoPlayer sources={SOURCES} enableCast={false} onSourceChange={onSourceChange} />);
    await u.click(screen.getByRole('button', { name: 'Settings' }));
    await u.click(await screen.findByRole('menuitem', { name: /Quality/ }));
    await u.click(screen.getByRole('menuitemradio', { name: 'High' }));

    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[1]!.src));
    expect(onSourceChange).toHaveBeenCalledWith(1, SOURCES[1]);

    await u.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('menuitem', { name: /Quality/ })).toHaveTextContent('High');
  });

  it('does not touch the source when "prefer alternate in fullscreen" is off', async () => {
    const u = userEvent.setup();
    const { container } = render(<VideoPlayer sources={SOURCES} enableCast={false} />);
    await u.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    await screen.findByRole('button', { name: 'Exit fullscreen' });
    expect(srcOf(container)).toBe(SOURCES[0]!.src);
  });

  it('plays the second in fullscreen and the first in the card', async () => {
    const u = userEvent.setup();
    const onSourceChange = vi.fn();
    const { container } = render(
      <VideoPlayer sources={SOURCES} enableCast={false} preferAlternateInFullscreen onSourceChange={onSourceChange} />,
    );
    expect(srcOf(container)).toBe(SOURCES[0]!.src);
    expect(onSourceChange).not.toHaveBeenCalled();

    await u.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[1]!.src));
    expect(onSourceChange).toHaveBeenLastCalledWith(1, SOURCES[1]);

    await u.click(await screen.findByRole('button', { name: 'Exit fullscreen' }));
    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[0]!.src));
    expect(onSourceChange).toHaveBeenLastCalledWith(0, SOURCES[0]);
  });

  it('lets a pick made by hand stand until the next fullscreen change', async () => {
    const u = userEvent.setup();
    const { container } = render(<VideoPlayer sources={SOURCES} enableCast={false} preferAlternateInFullscreen />);
    await u.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[1]!.src));

    await u.click(screen.getByRole('button', { name: 'Settings' }));
    await u.click(await screen.findByRole('menuitem', { name: /Quality/ }));
    await u.click(screen.getByRole('menuitemradio', { name: 'Standard' }));
    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[0]!.src));
  });

  it('keeps the viewer\'s place on an on-demand video when the source changes', async () => {
    const u = userEvent.setup();
    const { container } = render(<VideoPlayer sources={SOURCES} enableCast={false} />);
    const video = container.querySelector('video') as HTMLVideoElement;
    emit(video, 'loadedmetadata', { duration: 120 });
    video.currentTime = 42;

    await u.click(screen.getByRole('button', { name: 'Settings' }));
    await u.click(await screen.findByRole('menuitem', { name: /Quality/ }));
    await u.click(screen.getByRole('menuitemradio', { name: 'High' }));
    await waitFor(() => expect(srcOf(container)).toBe(SOURCES[1]!.src));
    video.currentTime = 0;   // what a reload does
    emit(video, 'loadedmetadata', { duration: 120 });
    expect(video.currentTime).toBe(42);
  });

  it('ignores a single entry: there is nothing to choose between', () => {
    const { container } = render(<VideoPlayer sources={[SOURCES[0]!]} enableCast={false} />);
    expect(srcOf(container)).toBe(SOURCES[0]!.src);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });
});

describe('translations', () => {
  const KEYS = [
    'presenceTitle', 'presenceCountdown', 'presenceContinue', 'presencePaused', 'reconnecting',
    'error.LIVE_REFUSED', 'error.LIVE_UNAVAILABLE', 'state.reconnecting', 'state.presencePaused',
  ] as const;

  it.each([['tr', tr], ['de', de], ['es', es], ['fr', fr], ['ar', ar]])('%s translates every new string', (_name, dict) => {
    for (const key of KEYS) {
      expect(dict[key], key).toBeTypeOf('string');
      expect(dict[key], key).not.toBe('');
      expect(dict[key], key).not.toBe(en[key]);
    }
    // Placeholders survive translation.
    expect(dict.presenceCountdown).toContain('{seconds}');
  });
});
