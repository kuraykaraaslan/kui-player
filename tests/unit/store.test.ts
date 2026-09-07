import { describe, expect, it } from 'vitest';
import { createVideoPlayerStore } from '../../modules/videoplayer/videoplayer.store';

describe('createVideoPlayerStore', () => {
  it('starts from a sane, non-playing state', () => {
    const s = createVideoPlayerStore().getState();
    expect(s).toMatchObject({
      playing: false, currentTime: 0, duration: 0, buffered: 0,
      volume: 1, muted: false, speed: 1, loading: true, seeking: false,
      error: null, retrying: false, isFullscreen: false, fakeFullscreen: false,
      isPip: false, pipSupported: false, showControls: true, seekHoverRatio: null,
      showSettings: false, settingsView: 'main', selectedQuality: '',
      selectedSubtitle: null, selectedAudioTrack: 0, subtitleFontSize: 'md',
      castState: 'unavailable', castDeviceName: null,
    });
    expect(s.adaptiveQualities).toEqual([]);
    expect(s.adaptiveAudioTracks).toEqual([]);
  });

  it('honours the init options', () => {
    const muted = createVideoPlayerStore({ startMuted: true, defaultQuality: '720' }).getState();
    expect(muted.muted).toBe(true);
    expect(muted.volume).toBe(0);
    expect(muted.selectedQuality).toBe('720');
  });

  it('exposes a setter for every piece of state', () => {
    const store = createVideoPlayerStore();
    const cases: [keyof ReturnType<typeof store.getState>, unknown][] = [
      ['playing', true], ['currentTime', 12.5], ['duration', 300], ['buffered', 42],
      ['volume', 0.4], ['muted', true], ['speed', 1.5], ['loading', false],
      ['seeking', true], ['error', { code: 2, name: 'X', message: 'y', recoverable: true }],
      ['retrying', true], ['isFullscreen', true], ['fakeFullscreen', true],
      ['isPip', true], ['pipSupported', true], ['showControls', false],
      ['seekHoverRatio', 0.42], ['showSettings', true], ['settingsView', 'quality'],
      ['selectedQuality', '1080'], ['adaptiveQualities', [{ label: 'a', value: '0' }]],
      ['qualityAuto', true], ['activeQualityLabel', '720p'],
      ['selectedSubtitle', 1], ['selectedAudioTrack', 2],
      ['adaptiveAudioTracks', [{ label: 'English' }]],
      ['subtitleFontSize', 'xl'], ['castState', 'connected'], ['castDeviceName', 'Living room'],
    ];

    for (const [key, value] of cases) {
      const setter = `set${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof ReturnType<typeof store.getState>;
      const fn = store.getState()[setter] as (v: unknown) => void;
      expect(fn, `missing ${String(setter)}`).toBeTypeOf('function');
      fn(value);
      expect(store.getState()[key]).toEqual(value);
    }
  });

  it('notifies subscribers', () => {
    const store = createVideoPlayerStore();
    const seen: number[] = [];
    const unsub = store.subscribe((s) => seen.push(s.currentTime));
    store.getState().setCurrentTime(5);
    store.getState().setCurrentTime(6);
    unsub();
    store.getState().setCurrentTime(7);
    expect(seen).toEqual([5, 6]);
  });
});
