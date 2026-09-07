import { describe, expect, it, vi } from 'vitest';
import { createHlsAdapter } from '../../modules/videoplayer/adapters/hls.adapter';
import { createDashAdapter } from '../../modules/videoplayer/adapters/dash.adapter';
import { bitrateLabel, heightLabel } from '../../modules/videoplayer/adapters/adapter.types';

const host = () => ({
  qualities: [] as unknown[], audio: [] as unknown[], errors: [] as unknown[],
  updateQualities(q: unknown[], active: number, auto: boolean) { this.qualities = [q, active, auto]; },
  updateAudioTracks(t: unknown[], active: number) { this.audio = [t, active]; },
  reportError(e: unknown) { this.errors.push(e); },
});

describe('rendition labels', () => {
  it('prefers height, falls back to bitrate', () => {
    expect(heightLabel(1080)).toBe('1080p');
    expect(heightLabel(undefined, 2_400_000)).toBe('2.4 Mbps');
    expect(heightLabel(undefined, 800_000)).toBe('800 kbps');
    expect(bitrateLabel(undefined)).toBe('Unknown');
  });
});

describe('hls adapter', () => {
  const EVENTS = {
    MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'level',
    AUDIO_TRACKS_UPDATED: 'audios', AUDIO_TRACK_SWITCHED: 'audio', ERROR: 'error',
  };

  const created: FakeHls[] = [];
  const last = () => created[created.length - 1]!;

  class FakeHls {
    static isSupported() { return true; }
    static Events = EVENTS;
    levels = [{ height: 1080, bitrate: 5e6 }, { height: 720, bitrate: 2e6 }];
    audioTracks = [{ name: 'English', lang: 'en' }, { lang: 'tr' }];
    currentLevel = -1;
    autoLevelEnabled = true;
    audioTrack = 0;
    destroyed = false;
    media?: HTMLMediaElement;
    source?: string;
    handlers: Record<string, (e: string, d: unknown) => void> = {};
    constructor() { created.push(this); }
    on(event: string, cb: (e: string, d: unknown) => void) { this.handlers[event] = cb; }
    attachMedia(v: HTMLMediaElement) { this.media = v; }
    loadSource(src: string) { this.source = src; }
    destroy() { this.destroyed = true; }
  }

  it('claims .m3u8 with a query string, and nothing else', () => {
    const a = createHlsAdapter({ Hls: FakeHls });
    expect(a.canPlay('https://x/y.m3u8')).toBe(true);
    expect(a.canPlay('https://x/y.m3u8?token=abc')).toBe(true);
    expect(a.canPlay('https://x/y.m3u8#t=1')).toBe(true);
    expect(a.canPlay('https://x/y.mp4')).toBe(false);
    expect(a.canPlay('https://x/m3u8-notes.txt')).toBe(false);
  });

  it('picks up a global Hls when none is passed', () => {
    (globalThis as { Hls?: unknown }).Hls = FakeHls;
    expect(createHlsAdapter().canPlay('a.m3u8')).toBe(true);
    delete (globalThis as { Hls?: unknown }).Hls;
    expect(createHlsAdapter({ preferNative: false }).canPlay('a.m3u8')).toBe(false);
  });

  it('drives hls.js and publishes levels and audio tracks', async () => {
    const a = createHlsAdapter({ Hls: FakeHls });
    const h = host();
    await a.attach(document.createElement('video'), 'https://x/y.m3u8', h);

    const hls = last();
    expect(hls.media).toBeInstanceOf(HTMLVideoElement);
    expect(hls.source).toBe('https://x/y.m3u8');

    hls.handlers.manifest?.('manifest', {});
    expect(h.qualities[0]).toEqual([{ label: '1080p', value: '0' }, { label: '720p', value: '1' }]);
    expect(h.qualities[2]).toBe(true);
    expect(a.getQualities()).toHaveLength(2);

    hls.handlers.audios?.('audios', {});
    expect(h.audio[0]).toEqual([
      { label: 'English', language: 'en' },
      { label: 'tr', language: 'tr' },
    ]);

    a.setQuality(1);
    expect(hls.currentLevel).toBe(1);
    a.setQuality(-1);
    expect(hls.currentLevel).toBe(-1);
    a.setAudioTrack(1);
    expect(hls.audioTrack).toBe(1);

    hls.handlers.error?.('error', { fatal: false, type: 'networkError' });
    expect(h.errors).toHaveLength(0);   // hls.js recovers from these itself
    hls.handlers.error?.('error', { fatal: true, type: 'networkError', details: 'manifestLoadError' });
    expect(h.errors[0]).toMatchObject({ code: 2, name: 'HLS_manifestLoadError' });

    a.detach();
    expect(hls.destroyed).toBe(true);
    expect(a.getQualities()).toEqual([]);
  });

  it('hands the URL to the element where HLS is native', async () => {
    const a = createHlsAdapter({ Hls: FakeHls });
    const video = document.createElement('video');
    vi.spyOn(video, 'canPlayType').mockReturnValue('maybe');
    const before = created.length;
    await a.attach(video, 'https://x/native.m3u8', host());
    expect(video.src).toContain('native.m3u8');
    expect(created.length).toBe(before);   // no hls.js instance created
  });
});

describe('dash adapter', () => {
  it('is inert until dash.js is available', () => {
    expect(createDashAdapter().canPlay('a.mpd')).toBe(false);
  });

  it('initializes dash.js and exposes representations', async () => {
    const player = {
      initialize: vi.fn(),
      destroy: vi.fn(),
      updateSettings: vi.fn(),
      on: vi.fn(),
      getTracksFor: vi.fn(() => [{ lang: 'en', labels: [{ text: 'English' }] }, { lang: 'tr' }]),
      setCurrentTrack: vi.fn(),
      getRepresentationsByType: vi.fn(() => [{ index: 0, height: 1080 }, { index: 1, height: 720 }]),
      getCurrentRepresentationForType: vi.fn(() => ({ index: 1 })),
      setRepresentationForTypeByIndex: vi.fn(),
    };
    const events = { STREAM_INITIALIZED: 'si', QUALITY_CHANGE_RENDERED: 'qc', ERROR: 'err' };
    const dashjs = { MediaPlayer: Object.assign(() => ({ create: () => player }), { events }) };

    const a = createDashAdapter({ dashjs, settings: { debug: {} } });
    expect(a.canPlay('https://x/y.mpd')).toBe(true);
    expect(a.canPlay('https://x/y.m3u8')).toBe(false);

    const h = host();
    await a.attach(document.createElement('video'), 'https://x/y.mpd', h);
    expect(player.initialize).toHaveBeenCalled();
    expect(player.updateSettings).toHaveBeenCalledWith({ debug: {} });

    const onStreamInit = player.on.mock.calls.find((c) => c[0] === 'si')?.[1] as () => void;
    onStreamInit();
    expect(h.qualities[0]).toEqual([{ label: '1080p', value: '0' }, { label: '720p', value: '1' }]);
    expect(h.audio[0]).toEqual([
      { label: 'English', language: 'en' },
      { label: 'tr', language: 'tr' },
    ]);

    a.setQuality(1);
    expect(player.setRepresentationForTypeByIndex).toHaveBeenCalledWith('video', 1, true);
    a.setQuality(-1);
    expect(player.updateSettings).toHaveBeenCalledWith({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });

    a.setAudioTrack(1);
    expect(player.setCurrentTrack).toHaveBeenCalledWith({ lang: 'tr' });

    const onError = player.on.mock.calls.find((c) => c[0] === 'err')?.[1] as (e: unknown) => void;
    onError({ error: { message: 'manifest gone' } });
    expect(h.errors[0]).toMatchObject({ name: 'DASH_FATAL_ERROR', message: 'manifest gone' });

    a.detach();
    expect(player.destroy).toHaveBeenCalled();
  });

  it('falls back to the dash.js v4 bitrate API', async () => {
    const player = {
      initialize: vi.fn(), destroy: vi.fn(), updateSettings: vi.fn(), on: vi.fn(),
      getTracksFor: vi.fn(() => []), setCurrentTrack: vi.fn(),
      getBitrateInfoListFor: vi.fn(() => [{ qualityIndex: 0, height: 480, bitrate: 900_000 }]),
      getQualityFor: vi.fn(() => 0),
      setQualityFor: vi.fn(),
    };
    const dashjs = { MediaPlayer: Object.assign(() => ({ create: () => player }), { events: { STREAM_INITIALIZED: 'si' } }) };
    const a = createDashAdapter({ dashjs });
    const h = host();
    await a.attach(document.createElement('video'), 'a.mpd', h);
    (player.on.mock.calls.find((c) => c[0] === 'si')?.[1] as () => void)();
    expect(h.qualities[0]).toEqual([{ label: '480p', value: '0' }]);
    a.setQuality(0);
    expect(player.setQualityFor).toHaveBeenCalledWith('video', 0);
  });
});
