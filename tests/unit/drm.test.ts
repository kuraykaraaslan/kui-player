import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDrmConfig, configuredSystems, mapDrmError, probeKeySystems, type DrmOptions,
} from '../../modules/videoplayer/adapters/drm';
import { createHlsAdapter, type HlsConstructor } from '../../modules/videoplayer/adapters/hls.adapter';

const drm: DrmOptions = {
  widevine: { licenseUrl: 'https://lic.test/widevine', headers: vi.fn(async () => ({ Authorization: 'Bearer abc' })) },
  playready: { licenseUrl: 'https://lic.test/playready' },
};

describe('buildDrmConfig', () => {
  it('maps each configured system to its key-system id', () => {
    const config = buildDrmConfig(drm) as { emeEnabled: boolean; drmSystems: Record<string, { licenseUrl: string }> };
    expect(config.emeEnabled).toBe(true);
    expect(config.drmSystems).toEqual({
      'com.widevine.alpha': { licenseUrl: 'https://lic.test/widevine' },
      'com.microsoft.playready': { licenseUrl: 'https://lic.test/playready' },
    });
  });

  it('leaves out systems without a license URL', () => {
    expect(configuredSystems({ widevine: { licenseUrl: '' } })).toEqual([]);
    expect(Object.keys((buildDrmConfig({ playready: { licenseUrl: 'https://x/p' } }) as { drmSystems: object }).drmSystems))
      .toEqual(['com.microsoft.playready']);
  });

  it('asks for headers on every license request, opening the request first', async () => {
    const headers = vi.fn(async () => ({ Authorization: 'Bearer fresh' }));
    const setup = (buildDrmConfig({ widevine: { licenseUrl: 'https://lic.test/w', headers } }) as {
      licenseXhrSetup: (xhr: unknown, url: string) => Promise<void>;
    }).licenseXhrSetup;
    const calls: string[] = [];
    const xhr = {
      readyState: 0,
      open: vi.fn(() => { calls.push('open'); xhr.readyState = 1; }),
      setRequestHeader: vi.fn((n: string, v: string) => calls.push(`${n}:${v}`)),
    };
    await setup(xhr, 'https://lic.test/w');
    await setup({ ...xhr, readyState: 1, open: vi.fn(), setRequestHeader: vi.fn() }, 'https://lic.test/w');
    expect(headers).toHaveBeenCalledTimes(2);                       // not cached: tokens expire
    expect(headers).toHaveBeenCalledWith({ keySystem: 'widevine', url: 'https://lic.test/w' });
    expect(calls).toEqual(['open', 'Authorization:Bearer fresh']);   // opened before the header was set
  });
});

describe('mapDrmError', () => {
  it('ignores errors that are not about content protection', () => {
    expect(mapDrmError({ details: 'fragLoadError' })).toBeNull();
    expect(mapDrmError(undefined)).toBeNull();
  });
  it('tells unsupported, denied, network and output-restricted apart', () => {
    expect(mapDrmError({ details: 'keySystemNoAccess' })).toMatchObject({ name: 'DRM_UNSUPPORTED', recoverable: false });
    expect(mapDrmError({ details: 'keySystemLicenseRequestFailed', response: { code: 403 } }))
      .toMatchObject({ name: 'DRM_LICENSE_DENIED', recoverable: false });
    expect(mapDrmError({ details: 'keySystemLicenseRequestFailed', response: { code: 401 } }))
      .toMatchObject({ name: 'DRM_LICENSE_DENIED' });
    expect(mapDrmError({ details: 'keySystemLicenseRequestFailed', response: { code: 503 } }))
      .toMatchObject({ name: 'DRM_LICENSE_NETWORK', recoverable: true });
    expect(mapDrmError({ details: 'keySystemStatusOutputRestricted' })).toMatchObject({ name: 'DRM_OUTPUT_RESTRICTED' });
  });
});

describe('probeKeySystems', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'requestMediaKeySystemAccess');
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'requestMediaKeySystemAccess', original);
    else delete (navigator as { requestMediaKeySystemAccess?: unknown }).requestMediaKeySystemAccess;
  });
  const setEme = (impl: (() => Promise<unknown>) | undefined) =>
    Object.defineProperty(navigator, 'requestMediaKeySystemAccess', { value: impl, configurable: true });

  it('passes when any configured system is available', async () => {
    const ask = vi.fn(async (id: string) => { if (id !== 'com.microsoft.playready') throw new Error('no'); return {}; });
    setEme(ask as never);
    expect(await probeKeySystems(drm)).toBeNull();
    expect(ask).toHaveBeenCalledTimes(2);   // widevine failed, playready answered
  });
  it('fails closed with a clear error when none is', async () => {
    setEme((async () => { throw new Error('no'); }) as never);
    expect(await probeKeySystems(drm)).toMatchObject({ name: 'DRM_UNSUPPORTED', recoverable: false });
  });
  it('fails when the browser has no EME at all, or no license URL is configured', async () => {
    setEme(undefined);
    expect(await probeKeySystems(drm)).toMatchObject({ name: 'DRM_UNSUPPORTED' });
    expect(await probeKeySystems({})).toMatchObject({ name: 'DRM_UNSUPPORTED' });
  });
});

describe('hls adapter with drm', () => {
  const EVENTS = { MANIFEST_PARSED: 'm', LEVEL_SWITCHED: 'l', AUDIO_TRACKS_UPDATED: 'a', AUDIO_TRACK_SWITCHED: 's', ERROR: 'error' };
  const created: { config: Record<string, unknown>; handlers: Record<string, (e: string, d: unknown) => void> }[] = [];
  class Fake {
    static supported = true;
    static isSupported() { return Fake.supported; }
    static Events = EVENTS;
    levels = []; audioTracks = []; currentLevel = -1; autoLevelEnabled = true; audioTrack = 0;
    handlers: Record<string, (e: string, d: unknown) => void> = {};
    constructor(public config: Record<string, unknown>) { created.push(this); }
    on(event: string, cb: (e: string, d: unknown) => void) { this.handlers[event] = cb; }
    attachMedia() {} loadSource() {} destroy() {}
  }
  const host = () => ({
    errors: [] as { name: string }[],
    updateQualities() {}, updateRendition() {}, updateAdBreaks() {}, updateAudioTracks() {},
    reportError(e: { name: string }) { this.errors.push(e); },
  });
  const eme = (impl: unknown) => Object.defineProperty(navigator, 'requestMediaKeySystemAccess', { value: impl, configurable: true });
  afterEach(() => { Fake.supported = true; created.length = 0; });

  it('wires EME into hls.js, and reports a license denial as its own error', async () => {
    eme(async () => ({}));
    const h = host();
    const video = document.createElement('video');
    await createHlsAdapter({ Hls: Fake as unknown as HlsConstructor, drm }).attach(video, 'https://x/a.m3u8', h as never);
    const hls = created[0]!;
    expect(hls.config.emeEnabled).toBe(true);
    hls.handlers.error?.('error', { details: 'keySystemLicenseRequestFailed', fatal: true, response: { code: 403 } });
    expect(h.errors[0]).toMatchObject({ name: 'DRM_LICENSE_DENIED' });
  });

  it('does not touch hls.js config when drm is not used', async () => {
    await createHlsAdapter({ Hls: Fake as unknown as HlsConstructor }).attach(document.createElement('video'), 'https://x/a.m3u8', host() as never);
    expect(created[0]!.config.emeEnabled).toBeUndefined();
  });

  it('refuses to play protected content natively (Safari/iOS) instead of stalling', async () => {
    Fake.supported = false;     // no MSE, as on iOS
    const h = host();
    const video = document.createElement('video');
    video.canPlayType = () => 'maybe';    // …but HLS is native there
    await createHlsAdapter({ Hls: Fake as unknown as HlsConstructor, drm }).attach(video, 'https://x/a.m3u8', h as never);
    expect(h.errors[0]).toMatchObject({ name: 'DRM_UNSUPPORTED' });
    expect(video.getAttribute('src')).toBeNull();
    expect(created).toHaveLength(0);
  });

  it('stops before loading when no key system is available', async () => {
    eme(async () => { throw new Error('none'); });
    const h = host();
    await createHlsAdapter({ Hls: Fake as unknown as HlsConstructor, drm }).attach(document.createElement('video'), 'https://x/a.m3u8', h as never);
    expect(h.errors[0]).toMatchObject({ name: 'DRM_UNSUPPORTED' });
    expect(created).toHaveLength(0);
  });
});
