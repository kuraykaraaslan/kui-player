import { describe, expect, it } from 'vitest';
import {
  audioKind, hasDescription, pickDescriptionTrack, pickMainTrack,
} from '../../modules/videoplayer/videoplayer.audiokind';
import { createHlsAdapter } from '../../modules/videoplayer/adapters/hls.adapter';
import type { AudioTrackOption } from '../../modules/videoplayer/videoplayer.types';

describe('audioKind', () => {
  it('derives the kind from HLS characteristics, DASH roles and Safari kinds', () => {
    expect(audioKind({ characteristics: 'public.accessibility.describes-video' })).toBe('description');
    expect(audioKind({ roles: ['main'] })).toBe('main');
    expect(audioKind({ roles: ['description'] })).toBe('description');
    expect(audioKind({ roles: [{ value: 'description' }] })).toBe('description');   // dash.js v5 shape
    expect(audioKind({ roles: ['commentary'] })).toBe('commentary');
    expect(audioKind({ kind: 'descriptions' })).toBe('description');
    expect(audioKind({})).toBe('main');
    expect(audioKind({ roles: [null, undefined] })).toBe('main');
  });
});

const tracks: AudioTrackOption[] = [
  { label: 'English', language: 'en' },
  { label: 'Türkçe', language: 'tr' },
  { label: 'English (AD)', language: 'en-US', kind: 'description' },
  { label: 'Türkçe (AD)', language: 'tr', kind: 'description' },
];

describe('track selection', () => {
  it('picks the description in the language being played', () => {
    expect(pickDescriptionTrack(tracks, 0)).toBe(2);
    expect(pickDescriptionTrack(tracks, 1)).toBe(3);
    expect(pickDescriptionTrack(tracks.slice(0, 2), 0)).toBeNull();
  });
  it('falls back to the first description when the language has none', () => {
    expect(pickDescriptionTrack([{ label: 'Deutsch', language: 'de' }, tracks[2]!], 0)).toBe(1);
  });
  it('returns to the remembered main track, else the same language', () => {
    expect(pickMainTrack(tracks, 2, 1)).toBe(1);
    expect(pickMainTrack(tracks, 3, null)).toBe(1);
    expect(pickMainTrack(tracks, 2, 3)).toBe(0);   // a remembered description is not a main track
  });
  it('knows whether a stream offers any', () => {
    expect(hasDescription(tracks)).toBe(true);
    expect(hasDescription(tracks.slice(0, 2))).toBe(false);
    expect(hasDescription(undefined)).toBe(false);
  });
});

describe('hls adapter labels', () => {
  it('marks description renditions', async () => {
    const handlers: Record<string, (e: string, d: unknown) => void> = {};
    class Fake {
      static isSupported() { return true; }
      static Events = { MANIFEST_PARSED: 'm', LEVEL_SWITCHED: 'l', AUDIO_TRACKS_UPDATED: 'a', AUDIO_TRACK_SWITCHED: 's', ERROR: 'e' };
      levels = []; currentLevel = -1; autoLevelEnabled = true; audioTrack = 0;
      audioTracks = [
        { name: 'English', lang: 'en' },
        { name: 'English AD', lang: 'en', characteristics: 'public.accessibility.describes-video' },
      ];
      on(event: string, cb: (e: string, d: unknown) => void) { handlers[event] = cb; }
      attachMedia() {} loadSource() {} destroy() {}
    }
    let published: AudioTrackOption[] = [];
    const host = {
      updateQualities() {}, updateRendition() {}, updateAdBreaks() {}, reportError() {},
      updateAudioTracks(t: AudioTrackOption[]) { published = t; },
    };
    await createHlsAdapter({ Hls: Fake as never }).attach(document.createElement('video'), 'https://x/a.m3u8', host);
    handlers.a?.('a', {});
    expect(published).toEqual([
      { label: 'English', language: 'en' },
      { label: 'English AD', language: 'en', kind: 'description' },
    ]);
  });
});
