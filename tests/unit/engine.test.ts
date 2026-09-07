import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';
import type { MediaAdapter } from '../../modules/videoplayer/adapters/adapter.types';
import { emit, loadCount } from '../setup';

function setup(opts: ConstructorParameters<typeof VideoPlayerEngine>[0] = {}) {
  const video = document.createElement('video');
  document.body.appendChild(video);
  const engine = new VideoPlayerEngine(opts);
  engine.attach(video);
  return { engine, video, state: () => engine.store.getState() };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('attach / detach', () => {
  it('leaves no listeners behind after detach', () => {
    const video = document.createElement('video');
    const add = vi.spyOn(video, 'addEventListener');
    const remove = vi.spyOn(video, 'removeEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');

    const engine = new VideoPlayerEngine();
    engine.attach(video);
    engine.detach();

    expect(add.mock.calls.length).toBeGreaterThan(0);
    expect(remove.mock.calls.map((c) => c[0]).sort()).toEqual(add.mock.calls.map((c) => c[0]).sort());
    expect(docRemove.mock.calls.map((c) => c[0]).sort()).toEqual(docAdd.mock.calls.map((c) => c[0]).sort());
  });

  it('re-attaching detaches the previous element first', () => {
    const engine = new VideoPlayerEngine();
    const first = document.createElement('video');
    const second = document.createElement('video');
    engine.attach(first);
    engine.attach(second);

    emit(first, 'play', { paused: false });
    expect(engine.store.getState().playing).toBe(false); // first element is orphaned
    emit(second, 'play', { paused: false });
    expect(engine.store.getState().playing).toBe(true);
  });

  it('survives actions with nothing attached', () => {
    const engine = new VideoPlayerEngine();
    expect(() => {
      engine.play(); engine.pause(); engine.togglePlay();
      engine.seek(10); engine.seekBy(5); engine.seekByRatio(0.5);
      engine.switchSource('x.mp4'); engine.retry(); engine.captureRestorePoint();
    }).not.toThrow();
    engine.setVolume(0.25);
    expect(engine.store.getState().volume).toBe(0.25);
    engine.toggleMute();
    expect(engine.store.getState().muted).toBe(true);
    engine.setSpeed(1.5);
    expect(engine.store.getState().speed).toBe(1.5);
  });
});

describe('seeking', () => {
  it('clamps to the media bounds', () => {
    const { engine, video } = setup();
    video.duration = 100;
    engine.seek(-50);
    expect(video.currentTime).toBe(0);
    engine.seek(1e6);
    expect(video.currentTime).toBe(100);
    engine.seek(42);
    expect(video.currentTime).toBe(42);
  });

  it('treats an unknown duration as zero rather than seeking to NaN', () => {
    const { engine, video } = setup();
    engine.seek(30);
    expect(video.currentTime).toBe(0);
    expect(Number.isNaN(video.currentTime)).toBe(false);
  });

  it('seekBy is relative and still clamped', () => {
    const { engine, video } = setup();
    video.duration = 60;
    video.currentTime = 50;
    engine.seekBy(30);
    expect(video.currentTime).toBe(60);
    engine.seekBy(-1000);
    expect(video.currentTime).toBe(0);
  });

  it('seekByRatio clamps the ratio, and no-ops without a duration', () => {
    const { engine, video } = setup();
    engine.seekByRatio(0.5);
    expect(video.currentTime).toBe(0);
    video.duration = 200;
    engine.seekByRatio(0.25);
    expect(video.currentTime).toBe(50);
    engine.seekByRatio(5);
    expect(video.currentTime).toBe(200);
    engine.seekByRatio(-5);
    expect(video.currentTime).toBe(0);
  });
});

describe('volume and rate', () => {
  it('clamps volume and keeps mute in step', () => {
    const { engine, video, state } = setup();
    engine.setVolume(2);
    expect(video.volume).toBe(1);
    expect(state().volume).toBe(1);
    engine.setVolume(-1);
    expect(video.volume).toBe(0);
    expect(video.muted).toBe(true);
    expect(state().muted).toBe(true);
    engine.setVolume(0.5);
    expect(video.muted).toBe(false);
    expect(state().volume).toBe(0.5);
  });

  it('mirrors changes made directly on the element', () => {
    const { video, state } = setup();
    video.volume = 0.3;
    video.dispatchEvent(new Event('volumechange'));
    expect(state().volume).toBeCloseTo(0.3);
    video.playbackRate = 2;
    video.dispatchEvent(new Event('ratechange'));
    expect(state().speed).toBe(2);
  });

  it('toggleMute flips the element, which reports back', () => {
    const { engine, video, state } = setup();
    engine.toggleMute();
    expect(video.muted).toBe(true);
    expect(state().muted).toBe(true);
    engine.toggleMute();
    expect(state().muted).toBe(false);
  });
});

describe('errors and retry', () => {
  it('surfaces a fatal error instead of spinning forever', () => {
    const { video, state } = setup();
    emit(video, 'waiting');
    expect(state().loading).toBe(true);
    video.error = { code: 4 } as MediaError;
    emit(video, 'error');
    expect(state().loading).toBe(false);
    expect(state().error).toMatchObject({ code: 4, name: 'MEDIA_ERR_SRC_NOT_SUPPORTED', recoverable: false });
    expect(state().retrying).toBe(false);
  });

  it('retries network errors with backoff, then gives up', async () => {
    vi.useFakeTimers();
    const { video, state } = setup({ maxAutoRetries: 2 });
    // `load()` clears `element.error`, so each failed attempt re-sets it —
    // exactly what a browser does when the retry fails again.
    const fail = () => emit(video, 'error', { error: { code: 2 } as MediaError });

    fail();
    expect(state().retrying).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(loadCount(video)).toBe(1);

    fail();
    await vi.advanceTimersByTimeAsync(1000);
    expect(loadCount(video)).toBe(2);

    fail();
    await vi.advanceTimersByTimeAsync(5000);
    expect(loadCount(video)).toBe(2);
    expect(state().retrying).toBe(false);
    expect(state().error?.code).toBe(2);
    vi.useRealTimers();
  });

  it('a manual retry reloads and clears the banner', () => {
    const { engine, video, state } = setup();
    video.error = { code: 3 } as MediaError;
    emit(video, 'error');
    engine.retry();
    expect(state().error).toBeNull();
    expect(loadCount(video)).toBe(1);
    emit(video, 'canplay', { readyState: 4 });
    expect(state().loading).toBe(false);
  });

  it('reports a failing <source> child, which fires no error on the element', async () => {
    vi.useFakeTimers();
    const video = document.createElement('video');
    const source = document.createElement('source');
    source.src = 'https://example.com/missing.mp4';
    video.appendChild(source);
    Object.defineProperty(video, 'networkState', { configurable: true, value: 3 }); // NETWORK_NO_SOURCE

    const engine = new VideoPlayerEngine();
    engine.attach(video);
    source.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.store.getState().error).toMatchObject({ code: 4 });
    expect(engine.store.getState().loading).toBe(false);
    vi.useRealTimers();
  });

  it('ignores a <source> failure while another source is still being tried', async () => {
    vi.useFakeTimers();
    const video = document.createElement('video');
    const source = document.createElement('source');
    video.appendChild(source);
    Object.defineProperty(video, 'networkState', { configurable: true, value: 2 }); // NETWORK_LOADING

    const engine = new VideoPlayerEngine();
    engine.attach(video);
    source.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.store.getState().error).toBeNull();
    vi.useRealTimers();
  });

  it('reports an error present on the element at attach time', () => {
    const video = document.createElement('video');
    video.error = { code: 4 } as MediaError;
    const engine = new VideoPlayerEngine();
    engine.attach(video);
    expect(engine.store.getState().error?.code).toBe(4);
  });
});

describe('source switching', () => {
  it('restores position, rate, volume and play state', async () => {
    const { engine, video } = setup();
    video.duration = 300;
    video.currentTime = 42;
    video.playbackRate = 1.5;
    video.volume = 0.4;
    await video.play();

    engine.switchSource('https://example.com/720.mp4');
    expect(video.src).toContain('720.mp4');
    expect(loadCount(video)).toBe(1);

    // The new media arrives at zero, as a real element would.
    video.playbackRate = 1;
    video.volume = 1;
    video.pause();
    emit(video, 'loadedmetadata', { currentTime: 0, duration: 300 });

    expect(video.currentTime).toBe(42);
    expect(video.playbackRate).toBe(1.5);
    expect(video.volume).toBeCloseTo(0.4);
    expect(video.paused).toBe(false);
  });

  it('captureRestorePoint covers a consumer-driven swap and keeps it paused', () => {
    const { engine, video } = setup();
    video.duration = 300;
    video.currentTime = 90;
    engine.captureRestorePoint();
    emit(video, 'loadedmetadata', { currentTime: 0, duration: 300 });
    expect(video.currentTime).toBe(90);
    expect(video.paused).toBe(true);
  });

  it('never restores past the end of a shorter source', () => {
    const { engine, video } = setup();
    video.duration = 300;
    video.currentTime = 280;
    engine.captureRestorePoint();
    emit(video, 'loadedmetadata', { currentTime: 0, duration: 100 });
    expect(video.currentTime).toBe(100);
  });
});

describe('controls visibility', () => {
  it('hides after playback starts and reappears on pause', () => {
    vi.useFakeTimers();
    const { video, state } = setup({ autoHideControls: true });
    emit(video, 'play', { paused: false });
    expect(state().showControls).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(state().showControls).toBe(false);
    emit(video, 'pause', { paused: true });
    expect(state().showControls).toBe(true);
    vi.useRealTimers();
  });

  it('never hides while focus is inside the player', () => {
    vi.useFakeTimers();
    const { engine, video, state } = setup({ autoHideControls: true });
    engine.keyboardFocus = true;
    emit(video, 'play', { paused: false });
    vi.advanceTimersByTime(10000);
    expect(state().showControls).toBe(true);
    engine.hideIfPlaying();
    expect(state().showControls).toBe(true);
    vi.useRealTimers();
  });

  it('a controlled player ignores internal visibility changes', () => {
    vi.useFakeTimers();
    const { engine, video, state } = setup({ controlsVisible: false });
    emit(video, 'play', { paused: false });
    vi.advanceTimersByTime(5000);
    expect(engine.effectiveControls).toBe(false);
    engine.forceShow();
    expect(engine.effectiveControls).toBe(false);
    engine.updateProps({ controlsVisible: true, autoHideControls: true });
    expect(engine.effectiveControls).toBe(true);
    expect(state().showControls).toBe(true);
    vi.useRealTimers();
  });

  it('toggleControls flips visibility for a tap', () => {
    const { engine, state } = setup();
    expect(state().showControls).toBe(true);
    engine.toggleControls();
    expect(state().showControls).toBe(false);
    engine.toggleControls();
    expect(state().showControls).toBe(true);
  });
});

describe('casting', () => {
  const remote = () => ({
    player: { isPaused: false, currentTime: 10, duration: 100, volumeLevel: 1, isMuted: false, isConnected: true },
    controller: {
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      playOrPause: vi.fn(), seek: vi.fn(), setVolumeLevel: vi.fn(), muteOrUnmute: vi.fn(), stop: vi.fn(),
    },
  });

  it('routes every transport action to the remote player', () => {
    const { engine, video, state } = setup();
    const { player, controller } = remote();
    engine.attachCast(player, controller);
    state().setCastState('connected');
    expect(engine.isCasting).toBe(true);

    engine.togglePlay();
    expect(controller.playOrPause).toHaveBeenCalled();
    expect(video.paused).toBe(true); // local element untouched

    engine.seekBy(15);
    expect(player.currentTime).toBe(25);
    expect(controller.seek).toHaveBeenCalled();

    engine.seekByRatio(0.5);
    expect(player.currentTime).toBe(50);

    engine.setVolume(0.5);
    expect(player.volumeLevel).toBe(0.5);
    expect(controller.setVolumeLevel).toHaveBeenCalled();

    engine.toggleMute();
    expect(controller.muteOrUnmute).toHaveBeenCalled();

    engine.detachCast();
    expect(engine.remotePlayer).toBeNull();
  });

  it('keeps the controls up and skips Picture-in-Picture while casting', async () => {
    vi.useFakeTimers();
    const { engine, video, state } = setup();
    state().setCastState('connected');
    emit(video, 'play', { paused: false });
    vi.advanceTimersByTime(5000);
    expect(state().showControls).toBe(true);
    expect(engine.effectiveControls).toBe(true);
    vi.useRealTimers();

    await engine.togglePictureInPicture();
    expect(document.pictureInPictureElement).toBeNull();
  });
});

describe('picture-in-picture', () => {
  it('enters and leaves, mirroring the element events', async () => {
    const { engine, video, state } = setup();
    expect(state().pipSupported).toBe(true);
    await engine.togglePictureInPicture();
    expect(document.pictureInPictureElement).toBe(video);
    expect(state().isPip).toBe(true);
    await engine.togglePictureInPicture();
    expect(document.pictureInPictureElement).toBeNull();
    emit(video, 'leavepictureinpicture');
    expect(state().isPip).toBe(false);
  });

  it('reports no support when the element opts out', () => {
    const video = document.createElement('video');
    (video as HTMLVideoElement & { disablePictureInPicture: boolean }).disablePictureInPicture = true;
    const engine = new VideoPlayerEngine();
    engine.attach(video);
    expect(engine.store.getState().pipSupported).toBe(false);
  });
});

describe('fullscreen', () => {
  it('uses the standard API when the document allows it', () => {
    const { engine } = setup();
    const container = document.createElement('div');
    const request = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    container.requestFullscreen = request;

    engine.toggleFullscreen(container);
    expect(request).toHaveBeenCalled();
    expect(container.style.position).not.toBe('fixed');
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
  });

  it('falls back to an emulated container, and restores it on exit', () => {
    const { engine, state } = setup();
    const container = document.createElement('div');
    container.style.cssText = 'border-radius:12px';

    engine.toggleFullscreen(container);
    expect(container.style.position).toBe('fixed');
    expect(state().isFullscreen).toBe(true);
    expect(state().fakeFullscreen).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    engine.toggleFullscreen(container);
    expect(container.style.cssText).toBe('border-radius: 12px;');
    expect(state().isFullscreen).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('leaves emulated fullscreen when the player is detached', () => {
    const { engine } = setup();
    const container = document.createElement('div');
    engine.enterFullscreen(container);
    engine.dispose();
    expect(container.style.position).not.toBe('fixed');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('media adapters', () => {
  function fakeAdapter(overrides: Partial<MediaAdapter> = {}) {
    const calls: string[] = [];
    const adapter: MediaAdapter = {
      name: 'fake',
      canPlay: (src) => src.endsWith('.m3u8'),
      attach: async (_v, src, host) => {
        calls.push(`attach:${src}`);
        host.updateQualities([{ label: '1080p', value: '0' }, { label: '720p', value: '1' }], 1, true);
        host.updateAudioTracks([{ label: 'English' }, { label: 'Türkçe' }], 0);
      },
      getQualities: () => [],
      setQuality: (i) => calls.push(`quality:${i}`),
      setAudioTrack: (i) => calls.push(`audio:${i}`),
      detach: () => calls.push('detach'),
      ...overrides,
    };
    return { adapter, calls };
  }

  it('claims only the sources it can play', async () => {
    const { adapter } = fakeAdapter();
    const { engine } = setup({ adapters: [adapter] });
    expect(engine.hasAdapterFor('a.m3u8')).toBe(true);
    expect(engine.hasAdapterFor('a.mp4')).toBe(false);
    expect(await engine.loadSource('a.mp4')).toBe(false);
    expect(await engine.loadSource('a.m3u8')).toBe(true);
    expect(engine.adapter).toBe(adapter);
  });

  it('publishes renditions and switches through the adapter', async () => {
    const { adapter, calls } = fakeAdapter();
    const { engine, state } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');

    expect(state().adaptiveQualities).toHaveLength(2);
    expect(state().qualityAuto).toBe(true);
    expect(state().selectedQuality).toBe('auto');
    expect(state().activeQualityLabel).toBe('720p');
    expect(state().adaptiveAudioTracks).toHaveLength(2);

    engine.selectQuality('1');
    expect(calls).toContain('quality:1');
    expect(state().qualityAuto).toBe(false);
    engine.selectQuality('auto');
    expect(calls).toContain('quality:-1');
    expect(state().qualityAuto).toBe(true);

    engine.setAudioTrack(1);
    expect(calls).toContain('audio:1');
    expect(state().selectedAudioTrack).toBe(1);
  });

  it('releases the adapter on detach and when it is unregistered', async () => {
    const { adapter, calls } = fakeAdapter();
    const engine = new VideoPlayerEngine();
    const video = document.createElement('video');
    engine.attach(video);
    const unregister = engine.use(adapter);
    await engine.loadSource('a.m3u8');
    unregister();
    expect(calls).toContain('detach');
    expect(engine.store.getState().adaptiveQualities).toEqual([]);

    engine.use(adapter);
    await engine.loadSource('a.m3u8');
    engine.detach();
    expect(calls.filter((c) => c === 'detach')).toHaveLength(2);
  });

  it('setAdapters keeps a still-registered adapter attached', async () => {
    const { adapter, calls } = fakeAdapter();
    const { engine } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');
    engine.setAdapters([adapter]);
    expect(calls).not.toContain('detach');
    engine.setAdapters([]);
    expect(calls).toContain('detach');
  });

  it('keeps adapter-published audio tracks when the element reports none', async () => {
    const { adapter } = fakeAdapter({ getAudioTracks: undefined });
    const { engine, video, state } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');
    expect(state().adaptiveAudioTracks).toHaveLength(2);
    emit(video, 'loadedmetadata', { duration: 60 });
    expect(state().adaptiveAudioTracks).toHaveLength(2);
  });

  it('surfaces an adapter failure as a player error', async () => {
    const { adapter } = fakeAdapter({ attach: async () => { throw new Error('boom'); } });
    const { engine, state } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');
    expect(state().error?.name).toBe('ADAPTER_ATTACH_FAILED');
    expect(state().loading).toBe(false);
  });

  it('retry re-attaches the adapter rather than reloading the element', async () => {
    const { adapter, calls } = fakeAdapter();
    const { engine, video } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');
    engine.retry();
    await Promise.resolve();
    expect(calls.filter((c) => c.startsWith('attach'))).toHaveLength(2);
    expect(loadCount(video)).toBe(0);
  });

  it('an adapter can report a fatal stream error', async () => {
    const { adapter } = fakeAdapter({
      attach: async (_v, _src, host) => {
        host.reportError({ code: 2, name: 'HLS_X', message: 'gone', recoverable: true });
      },
    });
    const { engine, state } = setup({ adapters: [adapter] });
    await engine.loadSource('a.m3u8');
    expect(state().error).toMatchObject({ name: 'HLS_X', message: 'gone' });
  });
});

describe('native audio tracks', () => {
  it('discovers the element list and flips the enabled flag', () => {
    const video = document.createElement('video');
    const tracks = [
      { label: 'English', language: 'en', enabled: true },
      { label: 'Türkçe', language: 'tr', enabled: false },
    ];
    Object.defineProperty(video, 'audioTracks', {
      configurable: true,
      value: Object.assign(tracks, { length: 2, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });

    const engine = new VideoPlayerEngine();
    engine.attach(video);
    emit(video, 'loadedmetadata', { duration: 60 });

    expect(engine.store.getState().adaptiveAudioTracks).toEqual([
      { label: 'English', language: 'en' },
      { label: 'Türkçe', language: 'tr' },
    ]);

    engine.setAudioTrack(1);
    expect(tracks[0]!.enabled).toBe(false);
    expect(tracks[1]!.enabled).toBe(true);
  });

  it('ignores a single-track list — one option is not a choice', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'audioTracks', {
      configurable: true,
      value: Object.assign([{ label: 'English', enabled: true }], { length: 1 }),
    });
    const engine = new VideoPlayerEngine();
    engine.attach(video);
    emit(video, 'loadedmetadata', { duration: 60 });
    expect(engine.store.getState().adaptiveAudioTracks).toEqual([]);
  });
});

describe('state mirroring', () => {
  it('follows the element through a full load cycle', () => {
    const { video, state } = setup();
    emit(video, 'loadstart');
    expect(state().loading).toBe(true);

    video.duration = 120;
    emit(video, 'loadedmetadata', { duration: 120 });
    expect(state().duration).toBe(120);

    emit(video, 'canplay', { readyState: 4 });
    expect(state().loading).toBe(false);

    video.currentTime = 30;
    expect(state().currentTime).toBe(30);

    emit(video, 'seeking', { readyState: 1 });
    expect(state().seeking).toBe(true);
    expect(state().loading).toBe(true);
    emit(video, 'seeked', { readyState: 4, currentTime: 30 });
    expect(state().seeking).toBe(false);
    expect(state().loading).toBe(false);

    emit(video, 'ended', { paused: true, ended: true });
    expect(state().playing).toBe(false);

    emit(video, 'emptied');
    expect(state().duration).toBe(0);
    expect(state().currentTime).toBe(0);
  });

  it('treats a non-finite duration as unknown', () => {
    const { video, state } = setup();
    video.duration = Infinity;
    emit(video, 'durationchange', { duration: Infinity });
    expect(state().duration).toBe(0);
  });
});
