import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REAUTH, resolveLive } from '../../modules/videoplayer/videoplayer.live';
import { LoadSuspender } from '../../modules/videoplayer/videoplayer.suspend';
import { watchVisibility } from '../../modules/videoplayer/videoplayer.visibility';
import { LiveRecovery, parseRefusal, readRefusal } from '../../modules/videoplayer/adapters/hls.live';

describe('resolveLive', () => {
  it('defaults to a live stream without a seek bar that stops when hidden and reconnects', () => {
    expect(resolveLive(undefined)).toEqual({
      hinted: false, dvr: false, stopWhenHidden: true, reauth: DEFAULT_REAUTH, credentials: 'same-origin',
    });
  });

  it('treats true and an object as "this source is live"', () => {
    expect(resolveLive(true).hinted).toBe(true);
    const o = resolveLive({ dvr: true, stopWhenHidden: false, reauth: { maxAttempts: 2 }, credentials: 'include' });
    expect(o).toMatchObject({ hinted: true, dvr: true, stopWhenHidden: false, credentials: 'include' });
    expect(o.reauth).toEqual({ ...DEFAULT_REAUTH, maxAttempts: 2 });
    expect(resolveLive({ reauth: false }).reauth).toBe(false);
  });

  it('turns every live behaviour off with false, keeping the old seek bar', () => {
    expect(resolveLive(false)).toEqual({
      hinted: false, dvr: true, stopWhenHidden: false, reauth: false, credentials: 'same-origin',
    });
  });
});

describe('LiveRecovery', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const make = (max = 4) => {
    const reload = vi.fn();
    const giveUp = vi.fn();
    const recovery = new LiveRecovery({ maxAttempts: max, baseDelayMs: 1000, maxDelayMs: 5000 }, { reload, giveUp });
    return { recovery, reload, giveUp };
  };

  it('answers the first refusal with one immediate reload, then backs off', () => {
    const { recovery, reload } = make();
    recovery.fail('auth');
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(reload).toHaveBeenLastCalledWith('auth', 1);

    recovery.fail('auth');
    vi.advanceTimersByTime(999);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(reload).toHaveBeenLastCalledWith('auth', 2);

    recovery.fail('auth');
    vi.advanceTimersByTime(2000);
    expect(reload).toHaveBeenLastCalledWith('auth', 3);
  });

  it('reconnects after a network error with backoff from the first attempt, capped', () => {
    const { recovery, reload } = make(10);
    for (const expected of [1000, 2000, 4000, 5000, 5000]) {
      reload.mockClear();
      recovery.fail('network');
      vi.advanceTimersByTime(expected - 1);
      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(reload).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores a second failure while a reconnect is already scheduled', () => {
    const { recovery, reload } = make();
    recovery.fail('network');
    recovery.fail('network');
    recovery.fail('auth');
    vi.advanceTimersByTime(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('gives up after the limit, and starts over once data flows again', () => {
    const { recovery, reload, giveUp } = make(2);
    recovery.fail('auth'); vi.advanceTimersByTime(0);
    recovery.fail('auth'); vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(giveUp).not.toHaveBeenCalled();
    recovery.fail('auth');
    expect(giveUp).toHaveBeenCalledWith('auth');

    expect(recovery.recovered()).toBe(true);
    expect(recovery.recovered()).toBe(false);
    recovery.fail('auth');
    vi.advanceTimersByTime(0);
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it('cancels a pending reconnect when disposed', () => {
    const { recovery, reload } = make();
    recovery.fail('network');
    recovery.dispose();
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('refusal text', () => {
  it('takes the message of a JSON answer', () => {
    expect(parseRefusal('{"message":"Your plan has no cameras left."}', 'application/json'))
      .toBe('Your plan has no cameras left.');
    expect(parseRefusal('{"message":"No access"}', null)).toBe('No access');
    expect(parseRefusal('{"error":"x"}', 'application/json')).toBeUndefined();
    expect(parseRefusal('{"message": 7}', 'application/json')).toBeUndefined();
    expect(parseRefusal('{broken', 'application/json')).toBeUndefined();
  });

  it('takes a short plain-text body, and nothing that looks like markup', () => {
    expect(parseRefusal('  Session expired.\n', 'text/plain; charset=utf-8')).toBe('Session expired.');
    expect(parseRefusal('Forbidden', undefined)).toBe('Forbidden');
    expect(parseRefusal('<html><body>403</body></html>', 'text/html')).toBeUndefined();
    expect(parseRefusal('<html>x</html>', 'text/plain')).toBeUndefined();
    expect(parseRefusal('', 'text/plain')).toBeUndefined();
    expect(parseRefusal(undefined, 'text/plain')).toBeUndefined();
  });

  it('cuts a long answer short', () => {
    const out = parseRefusal('a'.repeat(1000), 'text/plain') ?? '';
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith('…')).toBe(true);
  });

  it('reads an XMLHttpRequest, a binary body and a fetch Response', async () => {
    const xhr = { responseType: 'text', responseText: '{"message":"Nope"}', getResponseHeader: () => 'application/json' };
    expect(await readRefusal(xhr)).toBe('Nope');

    const binary = {
      responseType: 'arraybuffer',
      response: new TextEncoder().encode('Gone for good').buffer,
      getResponseHeader: () => 'text/plain',
    };
    expect(await readRefusal(binary)).toBe('Gone for good');

    const res = new Response('Pay up', { status: 403, headers: { 'content-type': 'text/plain' } });
    expect(await readRefusal(res)).toBe('Pay up');

    expect(await readRefusal(undefined)).toBeUndefined();
    expect(await readRefusal('text')).toBeUndefined();
  });
});

describe('LoadSuspender', () => {
  const make = (paused = false) => {
    const video = document.createElement('video');
    const pause = vi.spyOn(video, 'pause');
    Object.defineProperty(video, 'paused', { configurable: true, value: paused });
    const adapter = { suspend: vi.fn(), resume: vi.fn() };
    const play = vi.fn();
    const changed = vi.fn();
    const s = new LoadSuspender({
      video: () => video, adapter: () => adapter as never, play, changed,
    });
    return { s, pause, adapter, play, changed };
  };

  it('pauses and stops the adapter once, and starts both again when the last reason goes', () => {
    const { s, pause, adapter, play, changed } = make();
    s.suspend('hidden');
    s.suspend('presence');
    expect(pause).toHaveBeenCalledTimes(1);
    expect(adapter.suspend).toHaveBeenCalledTimes(1);

    s.resume('hidden');
    expect(adapter.resume).not.toHaveBeenCalled();
    s.resume('presence');
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls.map((c) => c.join(':'))).toEqual([
      'suspend:hidden', 'suspend:presence', 'resume:hidden', 'resume:presence',
    ]);
  });

  it('does not start a player that was not playing', () => {
    const { s, play } = make(true);
    s.suspend('hidden');
    s.resume('hidden');
    expect(play).not.toHaveBeenCalled();
    s.suspend('presence');
    s.resume('presence', true);
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe('watchVisibility', () => {
  type Cb = (entries: Partial<IntersectionObserverEntry>[]) => void;
  let callbacks: Cb[];
  let observed: Element[];
  const realIO = globalThis.IntersectionObserver;

  beforeEach(() => {
    callbacks = []; observed = [];
    globalThis.IntersectionObserver = class {
      constructor(cb: Cb) { callbacks.push(cb); }
      observe(el: Element) { observed.push(el); }
      disconnect() { observed = []; }
      unobserve() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    globalThis.IntersectionObserver = realIO;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('reports leaving and entering the viewport, once per change', () => {
    const el = document.createElement('div');
    const seen: boolean[] = [];
    const stop = watchVisibility(el, (v) => seen.push(v));
    expect(observed).toEqual([el]);
    callbacks[0]!([{ isIntersecting: true }]);
    callbacks[0]!([{ isIntersecting: false }]);
    callbacks[0]!([{ isIntersecting: false }]);
    callbacks[0]!([{ isIntersecting: true }]);
    expect(seen).toEqual([false, true]);
    stop();
    expect(observed).toEqual([]);
  });

  it('follows the tab: hidden is not visible, whatever the viewport says', () => {
    const el = document.createElement('div');
    const seen: boolean[] = [];
    const stop = watchVisibility(el, (v) => seen.push(v));
    setHidden(true);
    callbacks[0]!([{ isIntersecting: true }]);
    setHidden(false);
    expect(seen).toEqual([false, true]);
    stop();
    setHidden(true);
    expect(seen).toEqual([false, true]);
  });

  it('starts out right in a tab that is already hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const seen: boolean[] = [];
    watchVisibility(document.createElement('div'), (v) => seen.push(v))();
    expect(seen).toEqual([false]);
  });

  it('falls back to the tab alone without IntersectionObserver', () => {
    // @ts-expect-error simulating a browser without the API
    delete globalThis.IntersectionObserver;
    const seen: boolean[] = [];
    const stop = watchVisibility(document.createElement('div'), (v) => seen.push(v));
    setHidden(true);
    expect(seen).toEqual([false]);
    stop();
  });
});
