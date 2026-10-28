import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHlsAdapter } from '../../modules/videoplayer/adapters/hls.adapter';
import { resolveLive, type LiveInput } from '../../modules/videoplayer/videoplayer.live';
import type { MediaAdapterHost } from '../../modules/videoplayer/adapters/adapter.types';

const EVENTS = {
  MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'level', LEVEL_LOADED: 'levelLoaded', LEVEL_UPDATED: 'levelUpdated',
  FRAG_LOADED: 'fragLoaded', AUDIO_TRACKS_UPDATED: 'audios', AUDIO_TRACK_SWITCHED: 'audio', ERROR: 'error',
};

type Handler = (e: string, d: unknown) => void;

class FakeHls {
  static instances: FakeHls[] = [];
  static isSupported() { return true; }
  static Events = EVENTS;
  levels = [{ height: 720, bitrate: 1e6 }];
  audioTracks: unknown[] = [];
  currentLevel = -1;
  autoLevelEnabled = true;
  audioTrack = 0;
  liveSyncPosition: number | null = 118;
  targetLatency: number | null = 24;
  destroyed = false;
  stopped = 0;
  started: (number | undefined)[] = [];
  source?: string;
  media?: HTMLMediaElement;
  handlers = new Map<string, Handler[]>();
  constructor(public config?: Record<string, unknown>) { FakeHls.instances.push(this); }
  on(event: string, cb: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]); }
  fire(event: string, data?: unknown) { for (const h of this.handlers.get(event) ?? []) h(event, data); }
  attachMedia(v: HTMLMediaElement) { this.media = v; }
  loadSource(src: string) { this.source = src; }
  stopLoad() { this.stopped += 1; }
  startLoad(position?: number) { this.started.push(position); }
  destroy() { this.destroyed = true; }
}

const last = () => FakeHls.instances[FakeHls.instances.length - 1]!;

function makeHost(live: LiveInput | null = true) {
  const host = {
    live: resolveLive(live ?? undefined),
    updateQualities: vi.fn(),
    updateRendition: vi.fn(),
    updateAdBreaks: vi.fn(),
    updateAudioTracks: vi.fn(),
    reportError: vi.fn(),
    updateLive: vi.fn(),
    updateRecovery: vi.fn(),
  };
  return host as typeof host & MediaAdapterHost;
}

const SRC = 'https://nb.example/api/cameras/1/live.m3u8';
const livePlaylist = { details: { live: true, targetduration: 2, fragments: [] } };
const refusal = (code: number, body?: string, type = 'text/plain') => ({
  fatal: true,
  type: 'networkError',
  details: 'levelLoadError',
  response: { code },
  networkDetails: body === undefined
    ? undefined
    : { responseType: 'text', responseText: body, getResponseHeader: () => type },
});

async function attach(live: LiveInput | null = true, opts: Parameters<typeof createHlsAdapter>[0] = {}) {
  const adapter = createHlsAdapter({ Hls: FakeHls, ...opts });
  const host = makeHost(live);
  const video = document.createElement('video');
  await adapter.attach(video, SRC, host);
  return { adapter, host, video, first: last() };
}

beforeEach(() => { FakeHls.instances = []; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('hls adapter: live detection', () => {
  it('tells the host whether the playlist has an end, and how far behind the edge is still live', async () => {
    const { host, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    expect(host.updateLive).toHaveBeenLastCalledWith(true, 26);   // target latency 24 + one 2 s segment

    first.fire(EVENTS.LEVEL_UPDATED, { details: { live: false, fragments: [] } });   // EXT-X-ENDLIST arrived
    expect(host.updateLive).toHaveBeenLastCalledWith(false, undefined);
  });

  it('never asks for less than ten seconds of tolerance', async () => {
    const { host, first } = await attach();
    first.targetLatency = null;
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    expect(host.updateLive).toHaveBeenLastCalledWith(true, 10);
  });

  it('exposes where the live edge is', async () => {
    const { adapter, first } = await attach();
    expect(adapter.getLiveEdge?.()).toBe(118);
    first.liveSyncPosition = null;
    expect(adapter.getLiveEdge?.()).toBeNull();
  });
});

describe('hls adapter: reload on a refused or vanished live source', () => {
  it('recovers from a 401 without ever showing an error', async () => {
    const { host, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);

    first.fire(EVENTS.ERROR, refusal(401, 'Session expired'));
    expect(host.updateRecovery).toHaveBeenCalledWith({ reconnecting: true, attempt: 1, reason: 'auth' });
    expect(FakeHls.instances).toHaveLength(1);

    vi.advanceTimersByTime(0);
    expect(FakeHls.instances).toHaveLength(2);
    expect(first.destroyed).toBe(true);
    expect(last().source).toBe(SRC);   // the original address, not the one the old session ended on
    expect(last().media).toBeDefined();

    last().fire(EVENTS.FRAG_LOADED);
    expect(host.updateRecovery).toHaveBeenLastCalledWith({ reconnecting: false });
    expect(host.reportError).not.toHaveBeenCalled();
  });

  it.each([403, 404])('treats a %i like a ended session too (a deleted path answers 404)', async (code) => {
    const { host, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(code));
    vi.advanceTimersByTime(0);
    expect(FakeHls.instances).toHaveLength(2);
    expect(host.reportError).not.toHaveBeenCalled();
  });

  it('backs off when the reopened source is refused too, then gives up with the source\'s own words', async () => {
    const { host, first } = await attach({ reauth: { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 4000 } });
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(401));
    vi.advanceTimersByTime(0);
    expect(FakeHls.instances).toHaveLength(2);

    last().fire(EVENTS.ERROR, refusal(401));
    vi.advanceTimersByTime(999);
    expect(FakeHls.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeHls.instances).toHaveLength(3);

    last().fire(EVENTS.ERROR, refusal(403, '{"message":"This month\'s minutes are used up."}', 'application/json'));
    await vi.advanceTimersByTimeAsync(0);
    expect(host.reportError).toHaveBeenCalledTimes(1);
    expect(host.reportError).toHaveBeenCalledWith(expect.objectContaining({
      name: 'LIVE_REFUSED', recoverable: true, detail: 'This month\'s minutes are used up.',
    }));
    expect(host.updateRecovery).toHaveBeenLastCalledWith({ reconnecting: false });
    expect(FakeHls.instances).toHaveLength(3);
  });

  it('reconnects after a network error with backoff, and reports an unreachable source', async () => {
    const { host, first } = await attach({ reauth: { maxAttempts: 1, baseDelayMs: 500 } });
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    const offline = { fatal: true, type: 'networkError', details: 'fragLoadError', response: { code: 0 } };

    first.fire(EVENTS.ERROR, offline);
    expect(host.updateRecovery).toHaveBeenCalledWith({ reconnecting: true, attempt: 1, reason: 'network' });
    vi.advanceTimersByTime(499);
    expect(FakeHls.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeHls.instances).toHaveLength(2);

    last().fire(EVENTS.ERROR, offline);
    await vi.advanceTimersByTimeAsync(0);
    expect(host.reportError).toHaveBeenCalledWith(expect.objectContaining({ name: 'LIVE_UNAVAILABLE' }));
  });

  it('starts counting again once data flows', async () => {
    const { host, first } = await attach({ reauth: { maxAttempts: 1 } });
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(401));
    vi.advanceTimersByTime(0);
    last().fire(EVENTS.FRAG_LOADED);

    last().fire(EVENTS.ERROR, refusal(401));   // a later session end: one more reload, not a give-up
    vi.advanceTimersByTime(0);
    expect(FakeHls.instances).toHaveLength(3);
    expect(host.reportError).not.toHaveBeenCalled();
  });

  it('reports a refusal straight away for a source that never played, with its text', async () => {
    const { host, first } = await attach();
    first.fire(EVENTS.ERROR, { ...refusal(403, 'Not for you', 'text/plain'), details: 'manifestLoadError' });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeHls.instances).toHaveLength(1);
    expect(host.reportError).toHaveBeenCalledWith(expect.objectContaining({
      name: 'HLS_manifestLoadError', detail: 'Not for you',
    }));
  });

  it('leaves everything to the page when reauth is off', async () => {
    const { host, first } = await attach({ reauth: false });
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(401));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeHls.instances).toHaveLength(1);
    expect(host.reportError).toHaveBeenCalledTimes(1);
  });

  it('does not reopen an on-demand stream that ended (the playlist said it had an end)', async () => {
    const { host, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, { details: { live: false, fragments: [] } });
    first.fire(EVENTS.ERROR, refusal(404));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(FakeHls.instances).toHaveLength(1);
    expect(host.reportError).toHaveBeenCalledTimes(1);
  });

  it('stops everything when detached, even with a reconnect pending', async () => {
    const { adapter, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(401));
    adapter.detach();
    vi.advanceTimersByTime(60_000);
    expect(FakeHls.instances).toHaveLength(1);
  });
});

describe('hls adapter: small-tile defaults and credentials', () => {
  it('keeps a hinted live source on the first variant, capped to the player size', async () => {
    const { first } = await attach(true);
    expect(first.config).toMatchObject({ startLevel: 0, capLevelToPlayerSize: true, liveDurationInfinity: true });
  });

  it('leaves the quality choice to hls.js for a source nobody said was live', async () => {
    const { first } = await attach(null);
    expect(first.config).not.toHaveProperty('startLevel');
    expect(first.config).not.toHaveProperty('capLevelToPlayerSize');
    expect(first.config).toMatchObject({ liveDurationInfinity: true });
  });

  it('lets an explicit config win', async () => {
    const { first } = await attach(true, { config: { startLevel: 2, capLevelToPlayerSize: false } });
    expect(first.config).toMatchObject({ startLevel: 2, capLevelToPlayerSize: false });
  });

  it('sends nothing special for same-origin requests (cookies and redirects are the browser\'s defaults)', async () => {
    const { first } = await attach(true);
    expect(first.config).not.toHaveProperty('xhrSetup');
  });

  it('sends cookies cross-origin only when asked', async () => {
    const { first } = await attach({ credentials: 'include' });
    const xhr = { withCredentials: false } as XMLHttpRequest;
    (first.config!.xhrSetup as (x: XMLHttpRequest) => void)(xhr);
    expect(xhr.withCredentials).toBe(true);
  });
});

describe('hls adapter: stop and resume', () => {
  it('stops requesting while suspended and rejoins the live edge on resume', async () => {
    const { adapter, first, video } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);

    adapter.suspend?.();
    expect(first.stopped).toBe(1);

    adapter.resume?.();
    expect(first.started).toEqual([-1]);
    first.fire(EVENTS.LEVEL_UPDATED, livePlaylist);
    expect(video.currentTime).toBe(118);

    video.currentTime = 5;
    first.fire(EVENTS.LEVEL_UPDATED, livePlaylist);   // only the first refresh after resuming jumps
    expect(video.currentTime).toBe(5);
  });

  it('holds a reconnect back while nobody can see the player, and makes it when they can', async () => {
    const { adapter, first } = await attach();
    first.fire(EVENTS.LEVEL_LOADED, livePlaylist);
    first.fire(EVENTS.ERROR, refusal(401));
    adapter.suspend?.();
    vi.advanceTimersByTime(60_000);
    expect(FakeHls.instances).toHaveLength(1);

    adapter.resume?.();
    vi.advanceTimersByTime(1000);
    expect(FakeHls.instances).toHaveLength(2);
    expect(last().source).toBe(SRC);
  });

  it('drops the source of a natively played stream and puts it back', async () => {
    const adapter = createHlsAdapter({ Hls: FakeHls });
    const video = document.createElement('video');
    video.canPlayType = () => 'maybe';
    await adapter.attach(video, SRC, makeHost());
    expect(video.getAttribute('src')).toBe(SRC);
    expect(FakeHls.instances).toHaveLength(0);

    adapter.suspend?.();
    expect(video.hasAttribute('src')).toBe(false);
    adapter.resume?.();
    expect(video.getAttribute('src')).toBe(SRC);
  });
});
