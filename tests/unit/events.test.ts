import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';
import { QuartileTracker } from '../../modules/videoplayer/videoplayer.events';
import { emit } from '../setup';

function setup() {
  const video = document.createElement('video');
  document.body.appendChild(video);
  const engine = new VideoPlayerEngine();
  engine.attach(video);
  return { engine, video };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('QuartileTracker', () => {
  it('fires each mark once, in order', () => {
    const tracker = new QuartileTracker();
    expect(tracker.update(10, 100)).toEqual([]);
    expect(tracker.update(30, 100)).toEqual([25]);
    expect(tracker.update(80, 100)).toEqual([50, 75]);
    expect(tracker.update(85, 100)).toEqual([]);
    expect(tracker.update(100, 100)).toEqual([100]);
  });

  it('ignores an unknown duration and resets per source', () => {
    const tracker = new QuartileTracker();
    expect(tracker.update(10, 0)).toEqual([]);
    expect(tracker.update(10, NaN)).toEqual([]);
    tracker.update(30, 100);
    tracker.reset();
    expect(tracker.update(30, 100)).toEqual([25]);
  });

  it('reports the marks a viewer skipped past when playback ends', () => {
    const tracker = new QuartileTracker();
    tracker.update(30, 100);
    expect(tracker.finish()).toEqual([50, 75, 100]);
    expect(tracker.finish()).toEqual([]);
  });
});

describe('engine events', () => {
  it('reports transport changes', () => {
    const { engine, video } = setup();
    const seen: string[] = [];
    engine.on('play', () => seen.push('play'));
    engine.on('pause', () => seen.push('pause'));
    engine.on('ratechange', ({ rate }) => seen.push(`rate:${rate}`));
    engine.on('volumechange', ({ volume }) => seen.push(`volume:${volume}`));

    emit(video, 'play', { paused: false });
    emit(video, 'pause', { paused: true });
    // jsdom fires `ratechange` and `volumechange` from the setters, as a
    // browser does — no manual dispatch needed.
    video.playbackRate = 2;
    video.volume = 0.5;

    expect(seen).toEqual(['play', 'pause', 'rate:2', 'volume:0.5']);
    engine.dispose();
  });

  it('measures rebuffers', () => {
    vi.useFakeTimers();
    const { engine, video } = setup();
    const stalls: { count: number; durationMs: number; totalMs: number }[] = [];
    engine.on('stall', (payload) => stalls.push(payload));

    emit(video, 'waiting');
    vi.advanceTimersByTime(1200);
    emit(video, 'playing', { paused: false });
    expect(stalls[0]).toMatchObject({ count: 1, durationMs: 1200, totalMs: 1200 });

    emit(video, 'waiting');
    vi.advanceTimersByTime(300);
    emit(video, 'playing');
    expect(stalls[1]).toMatchObject({ count: 2, totalMs: 1500 });
    vi.useRealTimers();
    engine.dispose();
  });

  it('reports startup and time to first frame once per source', () => {
    vi.useFakeTimers();
    const { engine, video } = setup();
    const ready: { startupMs: number; timeToFirstFrameMs: number }[] = [];
    engine.on('ready', (payload) => ready.push(payload));

    emit(video, 'loadstart');
    vi.advanceTimersByTime(400);
    emit(video, 'loadedmetadata', { duration: 100 });
    vi.advanceTimersByTime(600);
    emit(video, 'playing', { paused: false });

    expect(ready).toHaveLength(1);
    expect(ready[0]).toMatchObject({ startupMs: 400, timeToFirstFrameMs: 1000 });

    emit(video, 'playing');
    expect(ready).toHaveLength(1);
    vi.useRealTimers();
    engine.dispose();
  });

  it('reports quartiles while playing and completes at the end', () => {
    const { engine, video } = setup();
    const marks: number[] = [];
    engine.on('quartile', ({ percent }) => marks.push(percent));
    const completed = vi.fn();
    engine.on('complete', completed);

    emit(video, 'loadstart');
    video.duration = 100;
    emit(video, 'loadedmetadata', { duration: 100 });
    video.currentTime = 60;
    emit(video, 'timeupdate', { currentTime: 60, duration: 100 });
    expect(marks).toEqual([25, 50]);

    emit(video, 'ended', { paused: true });
    expect(marks).toEqual([25, 50, 75, 100]);
    expect(completed).toHaveBeenCalledWith({ duration: 100 });
    engine.dispose();
  });

  it('surfaces errors, and unsubscribing stops delivery', () => {
    const { engine, video } = setup();
    const handler = vi.fn();
    const off = engine.on('error', handler);

    emit(video, 'error', { error: { code: 2 } as MediaError });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));

    off();
    emit(video, 'error', { error: { code: 4 } as MediaError });
    expect(handler).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it('keeps playing when a listener throws', () => {
    const { engine, video } = setup();
    const good = vi.fn();
    engine.on('play', () => { throw new Error('listener bug'); });
    engine.on('play', good);
    expect(() => emit(video, 'play', { paused: false })).not.toThrow();
    expect(good).toHaveBeenCalled();
    engine.dispose();
  });
});

describe('live and DVR', () => {
  function liveVideo(start: number, end: number) {
    const { engine, video } = setup();
    Object.defineProperty(video, 'seekable', {
      configurable: true,
      value: { length: 1, start: () => start, end: () => end },
    });
    return { engine, video };
  }

  it('detects a live stream and its DVR window', () => {
    const { engine, video } = liveVideo(30, 130);
    video.duration = Infinity;
    emit(video, 'durationchange', { duration: Infinity });

    const s = engine.store.getState();
    expect(s.isLive).toBe(true);
    expect(s.dvrStart).toBe(30);
    expect(s.dvrWindow).toBe(100);
    engine.dispose();
  });

  it('knows whether the viewer is at the edge', () => {
    const { engine, video } = liveVideo(0, 100);
    video.duration = Infinity;
    emit(video, 'durationchange', { duration: Infinity });

    video.currentTime = 98;
    emit(video, 'timeupdate', { currentTime: 98 });
    expect(engine.store.getState().atLiveEdge).toBe(true);

    video.currentTime = 40;
    emit(video, 'timeupdate', { currentTime: 40 });
    expect(engine.store.getState().atLiveEdge).toBe(false);
    engine.dispose();
  });

  it('seeks proportionally inside the DVR window, and jumps to the edge', () => {
    const { engine, video } = liveVideo(100, 200);
    video.duration = Infinity;
    emit(video, 'durationchange', { duration: Infinity });

    engine.seekByRatio(0.5);
    expect(video.currentTime).toBe(150);

    engine.seekToLive();
    expect(video.currentTime).toBe(200);
    engine.dispose();
  });

  it('leaves on-demand media alone', () => {
    const { engine, video } = setup();
    video.duration = 120;
    emit(video, 'durationchange', { duration: 120 });
    expect(engine.store.getState().isLive).toBe(false);
    engine.seekByRatio(0.25);
    expect(video.currentTime).toBe(30);
    engine.dispose();
  });
});

describe('AirPlay', () => {
  it('appears only once the element offers it and a target exists', () => {
    const video = document.createElement('video');
    const picker = vi.fn();
    Object.defineProperty(video, 'webkitShowPlaybackTargetPicker', { configurable: true, value: picker });

    const engine = new VideoPlayerEngine();
    engine.attach(video);
    expect(engine.store.getState().airPlaySupported).toBe(true);
    expect(engine.store.getState().airPlayAvailable).toBe(false);

    const event = new Event('webkitplaybacktargetavailabilitychanged');
    Object.assign(event, { availability: 'available' });
    video.dispatchEvent(event);
    expect(engine.store.getState().airPlayAvailable).toBe(true);

    engine.showAirPlayPicker();
    expect(picker).toHaveBeenCalled();
    engine.dispose();
  });

  it('reports nothing where the element has no AirPlay at all', () => {
    const { engine } = setup();
    expect(engine.store.getState().airPlaySupported).toBe(false);
    expect(() => engine.showAirPlayPicker()).not.toThrow();
    engine.dispose();
  });
});
