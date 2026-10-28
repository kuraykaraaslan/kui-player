import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayerEngine, type VideoPlayerEngineOptions } from '../../modules/videoplayer/videoplayer.engine';
import type { MediaAdapter, MediaAdapterHost } from '../../modules/videoplayer/adapters/adapter.types';
import { emit } from '../setup';

function fakeAdapter() {
  let host: MediaAdapterHost | undefined;
  const adapter = {
    name: 'fake',
    canPlay: (src: string) => src.endsWith('.m3u8'),
    attach: vi.fn(async (_video: HTMLVideoElement, _src: string, h: MediaAdapterHost) => { host = h; }),
    getQualities: () => [],
    setQuality: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    getLiveEdge: vi.fn((): number | null => null),
    detach: vi.fn(),
  } satisfies MediaAdapter;
  return { adapter, host: () => host! };
}

async function liveEngine(options: VideoPlayerEngineOptions = {}) {
  const { adapter, host } = fakeAdapter();
  const video = document.createElement('video');
  document.body.appendChild(video);
  let end = 100;
  Object.defineProperty(video, 'seekable', {
    configurable: true,
    get: () => ({ length: 1, start: () => 0, end: () => end }),
  });
  const engine = new VideoPlayerEngine({ adapters: [adapter], ...options });
  engine.attach(video);
  await engine.loadSource('https://x/live.m3u8');
  host().updateLive?.(true);
  return { engine, video, adapter, host: host(), setEnd: (v: number) => { end = v; } };
}

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let callbacks: IOCallback[];
const realIO = globalThis.IntersectionObserver;

beforeEach(() => {
  document.body.innerHTML = '';
  callbacks = [];
  globalThis.IntersectionObserver = class {
    constructor(cb: IOCallback) { callbacks.push(cb); }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  globalThis.IntersectionObserver = realIO;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});

const scroll = (visible: boolean) => callbacks[callbacks.length - 1]?.([{ isIntersecting: visible }]);

describe('live mode', () => {
  it('knows a stream is live from the adapter, before the element says anything', async () => {
    const { engine } = await liveEngine();
    const s = engine.store.getState();
    expect(s.isLive).toBe(true);
    expect(s.liveDvr).toBe(false);
  });

  it('uses the edge tolerance of the adapter: HLS plays segments behind the edge on purpose', async () => {
    const { engine, video, host } = await liveEngine();
    host.updateLive?.(true, 40);
    video.currentTime = 70;
    emit(video, 'timeupdate', { currentTime: 70 });
    expect(engine.store.getState().atLiveEdge).toBe(true);   // 30 s behind, 40 s allowed

    host.updateLive?.(true);
    emit(video, 'timeupdate', { currentTime: 70 });
    expect(engine.store.getState().atLiveEdge).toBe(false);  // 30 s behind, 10 s allowed
  });

  it('goes back to live at the adapter\'s sync position when it has one', async () => {
    const { engine, video, adapter } = await liveEngine();
    adapter.getLiveEdge.mockReturnValue(92);
    video.currentTime = 10;
    engine.seekToLive();
    expect(video.currentTime).toBe(92);
  });

  it('has nothing to seek in without a DVR window, and keeps it with one', async () => {
    const off = await liveEngine();
    off.video.currentTime = 50;
    off.engine.seekBy(10);
    off.engine.seek(20);
    off.engine.seekByRatio(0.1);
    expect(off.video.currentTime).toBe(50);

    const on = await liveEngine({ live: { dvr: true } });
    on.video.currentTime = 50;
    emit(on.video, 'timeupdate', { currentTime: 50 });
    on.engine.seekByRatio(0.1);
    expect(on.video.currentTime).toBe(10);
    expect(on.engine.store.getState().liveDvr).toBe(true);
  });

  it('does not end while the stream runs: it goes back to the edge instead', async () => {
    const { engine, video } = await liveEngine();
    const complete = vi.fn();
    engine.on('complete', complete);
    video.currentTime = 60;
    emit(video, 'ended', { ended: true });
    expect(complete).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(100);
  });

  it('ends normally once the playlist gets its end', async () => {
    const { engine, video, host } = await liveEngine();
    const complete = vi.fn();
    engine.on('complete', complete);
    host.updateLive?.(false);
    expect(engine.store.getState().isLive).toBe(false);
    emit(video, 'ended', { ended: true });
    expect(complete).toHaveBeenCalled();
  });

  it('rejoins at the edge, not at the old position, after a reconnect', async () => {
    const { engine, video, host } = await liveEngine();
    const events: string[] = [];
    engine.on('live:reconnect', (e) => events.push(`reconnect:${e.reason}:${e.attempt}`));
    engine.on('live:recovered', () => events.push('recovered'));
    engine.play();
    video.currentTime = 60;

    host.updateRecovery?.({ reconnecting: true, attempt: 1, reason: 'auth' });
    expect(engine.store.getState().reconnecting).toBe(true);
    expect(engine.store.getState().error).toBeNull();

    // The new connection rebuilds the element, which stops it and rewinds it;
    // playback must carry on by itself, without seeking back to the old position.
    video.pause();
    video.currentTime = 0;
    emit(video, 'loadedmetadata', { readyState: 1 });
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(0);

    host.updateRecovery?.({ reconnecting: false });
    expect(engine.store.getState().reconnecting).toBe(false);
    expect(events).toEqual(['reconnect:auth:1', 'recovered']);
  });

  it('surfaces an error the adapter gives up with', async () => {
    const { engine, host } = await liveEngine();
    const errors: string[] = [];
    engine.on('error', (e) => errors.push(e.name));
    host.reportError({ code: 2, name: 'LIVE_REFUSED', message: 'refused', recoverable: true, detail: 'Pay up' });
    expect(engine.store.getState().error?.detail).toBe('Pay up');
    expect(errors).toEqual(['LIVE_REFUSED']);
  });
});

describe('stop when hidden', () => {
  it('makes no requests for a player scrolled out of view, and rejoins the edge when it is back', async () => {
    const { engine, video, adapter } = await liveEngine();
    const log: string[] = [];
    engine.on('suspend', (e) => log.push(`suspend:${e.reason}`));
    engine.on('resume', (e) => log.push(`resume:${e.reason}`));
    engine.play();
    expect(video.paused).toBe(false);

    scroll(false);
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(true);

    scroll(true);
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(false);
    expect(log).toEqual(['suspend:hidden', 'resume:hidden']);
  });

  it('follows the tab as well', async () => {
    const { video, adapter, engine } = await liveEngine();
    engine.play();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(true);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(false);
  });

  it('does not start a stream the viewer had paused', async () => {
    const { video, adapter } = await liveEngine();
    scroll(false);
    scroll(true);
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(true);
  });

  it('leaves playback alone that someone is watching elsewhere', async () => {
    const { engine, adapter } = await liveEngine();
    engine.play();
    engine.store.getState().setIsPip(true);
    scroll(false);
    expect(adapter.suspend).not.toHaveBeenCalled();
  });

  it('watches live players only, and only when asked to', async () => {
    const vod = new VideoPlayerEngine();
    vod.attach(document.createElement('video'));
    expect(callbacks).toHaveLength(0);

    const off = await liveEngine({ live: { stopWhenHidden: false } });
    off.engine.play();
    scroll(false);
    expect(off.adapter.suspend).not.toHaveBeenCalled();
  });

  it('stops watching when the stream turns out to be on demand', async () => {
    const { adapter, host } = await liveEngine();
    scroll(false);
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    host.updateLive?.(false);
    expect(adapter.resume).toHaveBeenCalledTimes(1);
  });
});

describe('presence check in one player', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('asks after the interval, and stops playing and loading when nobody answers', async () => {
    const { engine, video, adapter } = await liveEngine({ presence: { everyMs: 10_000, graceMs: 3000 } });
    const log: string[] = [];
    engine.on('presence:ask', (e) => log.push(`ask:${e.graceMs}`));
    engine.on('presence:timeout', () => log.push('timeout'));
    engine.play();

    vi.advanceTimersByTime(9_900);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(log).toEqual(['ask:3000']);
    expect(engine.store.getState().ownPresence?.store.getState().phase).toBe('asking');

    vi.advanceTimersByTime(3000);
    expect(log).toEqual(['ask:3000', 'timeout']);
    expect(video.paused).toBe(true);
    expect(adapter.suspend).toHaveBeenCalledTimes(1);
    expect(engine.store.getState().presencePaused).toBe(true);
  });

  it('keeps playing after Continue, and asks again a full interval later', async () => {
    const { engine, video, adapter } = await liveEngine({ presence: { everyMs: 10_000, graceMs: 3000 } });
    const asks = vi.fn();
    engine.on('presence:ask', asks);
    engine.on('presence:continue', asks);
    engine.play();
    vi.advanceTimersByTime(10_000);
    expect(asks).toHaveBeenCalledTimes(1);

    engine.confirmPresence();
    expect(asks).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(3000);
    expect(video.paused).toBe(false);
    expect(adapter.suspend).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(asks).toHaveBeenCalledTimes(3);
  });

  it('counts playback only, not time spent paused', async () => {
    const { engine } = await liveEngine({ presence: { everyMs: 10_000, graceMs: 3000 } });
    const ask = vi.fn();
    engine.on('presence:ask', ask);
    engine.play();
    vi.advanceTimersByTime(6000);
    engine.pause();
    vi.advanceTimersByTime(60_000);
    expect(ask).not.toHaveBeenCalled();
    engine.play();
    vi.advanceTimersByTime(3900);
    expect(ask).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('plays again, from the live edge, when the viewer presses Play', async () => {
    const { engine, video, adapter } = await liveEngine({ presence: { everyMs: 1000, graceMs: 500 } });
    engine.play();
    vi.advanceTimersByTime(1500);
    expect(engine.store.getState().presencePaused).toBe(true);

    engine.togglePlay();
    expect(engine.store.getState().presencePaused).toBe(false);
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(video.paused).toBe(false);
    // The count starts over: no question straight away.
    const ask = vi.fn();
    engine.on('presence:ask', ask);
    vi.advanceTimersByTime(900);
    expect(ask).not.toHaveBeenCalled();
  });

  it('stays stopped when the tab comes back, until the viewer presses Play', async () => {
    const { engine, video, adapter } = await liveEngine({ presence: { everyMs: 1000, graceMs: 500 } });
    engine.play();
    scroll(false);
    vi.advanceTimersByTime(60_000);   // hidden, so nothing was playing and nothing was asked
    scroll(true);
    engine.play();   // the hidden state resumed it already; this is just the viewer's own play
    expect(video.paused).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(engine.store.getState().presencePaused).toBe(true);
    scroll(false);
    scroll(true);
    expect(video.paused).toBe(true);   // hidden → visible must not undo "paused to save data"
    expect(adapter.resume).toHaveBeenCalledTimes(1);
  });

  it('works for an ordinary video, which has no adapter to stop', async () => {
    const video = document.createElement('video');
    const engine = new VideoPlayerEngine({ presence: { everyMs: 1000, graceMs: 500 } });
    engine.attach(video);
    engine.play();
    vi.advanceTimersByTime(1500);
    expect(video.paused).toBe(true);
    expect(engine.store.getState().presencePaused).toBe(true);
  });

  it('can be switched off again', async () => {
    const { engine } = await liveEngine({ presence: { everyMs: 1000, graceMs: 500 } });
    engine.play();
    engine.setPresence(undefined);
    expect(engine.store.getState().ownPresence).toBeNull();
    const ask = vi.fn();
    engine.on('presence:ask', ask);
    vi.advanceTimersByTime(10_000);
    expect(ask).not.toHaveBeenCalled();
  });
});
