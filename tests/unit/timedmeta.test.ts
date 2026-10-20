import { describe, expect, it, vi } from 'vitest';
import {
  MetadataBreaks, breaksFromCues, decodeId3, id3Marker, watchNativeMetadata, type MetaCue,
} from '../../modules/videoplayer/videoplayer.timedmeta';
import { createHlsAdapter } from '../../modules/videoplayer/adapters/hls.adapter';

const tick = () => new Promise<void>((r) => setTimeout(r, 20));
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const synchsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];

function frame(id: string, body: number[], v4 = true): number[] {
  const size = v4 ? synchsafe(body.length) : [(body.length >>> 24) & 255, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255];
  return [...ascii(id), ...size, 0, 0, ...body];
}
function tag(frames: number[][], v4 = true): Uint8Array {
  const body = frames.flat();
  return new Uint8Array([...ascii('ID3'), v4 ? 4 : 3, 0, 0, ...synchsafe(body.length), ...body]);
}
const txxx = (desc: string, value: string, v4 = true) => frame('TXXX', [3, ...ascii(desc), 0, ...ascii(value)], v4);
const priv = (owner: string, data: number[]) => frame('PRIV', [...ascii(owner), 0, ...data]);

describe('decodeId3', () => {
  it('reads TXXX, WXXX and PRIV frames (v2.4 and v2.3)', () => {
    const t = tag([txxx('adbreak', 'duration=30'), frame('WXXX', [0, ...ascii('d'), 0, ...ascii('https://x/y')]), priv('com.x', ascii('hello'))]);
    const f = decodeId3(t);
    expect(f.map((x) => x.id)).toEqual(['TXXX', 'WXXX', 'PRIV']);
    expect(f[0]).toMatchObject({ description: 'adbreak', text: 'duration=30' });
    expect(f[1]).toMatchObject({ description: 'd', text: 'https://x/y' });
    expect(f[2]).toMatchObject({ description: 'com.x', text: 'hello' });
    expect(decodeId3(tag([txxx('a', 'b', false)], false))[0]?.text).toBe('b');
  });

  it('decodes UTF-16 text with a BOM', () => {
    const utf16 = (s: string) => [0xff, 0xfe, ...Array.from(s).flatMap((c) => [c.charCodeAt(0), 0])];
    const body = [1, ...utf16('ad'), 0, 0, ...utf16('duration=5')];
    expect(decodeId3(tag([frame('TXXX', body)]))[0]).toMatchObject({ description: 'ad', text: 'duration=5' });
  });

  it('never throws on malformed data', () => {
    const good = tag([txxx('ad', 'duration=3')]);
    const inputs: unknown[] = [
      null, undefined, new Uint8Array(0), new Uint8Array([1, 2, 3]), good.subarray(0, 14),
      new Uint8Array([...ascii('ID3'), 4, 0, 0, 0x7f, 0x7f, 0x7f, 0x7f, ...ascii('TXXX'), 0x7f, 0x7f, 0x7f, 0x7f, 0, 0]),
      new Uint8Array([...ascii('ID3'), 2, 0, 0, 0, 0, 0, 10]), 'ID3', {},
    ];
    for (const i of inputs) expect(() => decodeId3(i as Uint8Array)).not.toThrow();
    expect(decodeId3(good.subarray(0, 14))).toEqual([]);
    expect(decodeId3(new Uint8Array([...ascii('ID3'), 2, 0, 0, 0, 0, 0, 10]))).toEqual([]);
  });
});

describe('id3Marker', () => {
  it('finds an ad-out with duration, an id, and an ad-in', () => {
    const out = id3Marker(decodeId3(tag([txxx('ad', 'id=brk1;duration=30')])), 12);
    expect(out).toEqual({ kind: 'out', time: 12, id: 'brk1', duration: 30, source: 'id3' });
    expect(id3Marker(decodeId3(tag([txxx('cue-in', '')])), 42)).toEqual({ kind: 'in', time: 42 });
  });

  it('ignores unrelated frames, WXXX and bad times', () => {
    expect(id3Marker(decodeId3(tag([txxx('title', 'My song')])), 1)).toBeNull();
    expect(id3Marker(decodeId3(tag([frame('WXXX', [0, ...ascii('ad'), 0, ...ascii('https://ad')])])), 1)).toBeNull();
    expect(id3Marker(decodeId3(tag([txxx('ad', 'duration=3')])), NaN)).toBeNull();
  });

  it('does not decode binary SCTE-35: no duration, no marker text, still open-ended', () => {
    const m = id3Marker(decodeId3(tag([priv('urn:scte:scte35:2013:bin', [0xfc, 0x30, 0x00, 0x80])])), 5);
    expect(m).toMatchObject({ kind: 'out', duration: null });
  });
});

describe('MetadataBreaks', () => {
  it('collapses duplicates and closes an open break on ad-in', () => {
    const m = new MetadataBreaks();
    const out = tag([txxx('ad', 'id=a;duration=20')]);
    expect(m.addId3(out, 10)).toBe(true);
    expect(m.addId3(out, 10)).toBe(false);
    expect(m.addId3(tag([txxx('ad', 'id=a;duration=20')]), 11)).toBe(false);   // same id repeated per segment
    expect(m.addId3(tag([txxx('title', 'x')]), 12)).toBe(false);
    expect(m.breaks).toEqual([{ id: 'a', start: 10, end: 30, duration: 20, source: 'id3' }]);

    const open = new MetadataBreaks();
    open.addId3(tag([txxx('cue-out', 'id=o')]), 50);
    expect(open.breaks[0]).toMatchObject({ id: 'o', end: null });
    open.addId3(tag([txxx('cue-in', '')]), 80);
    expect(open.breaks[0]).toMatchObject({ end: 80, duration: 30 });
    open.clear();
    expect(open.breaks).toEqual([]);
  });

  it('caps what it keeps', () => {
    const m = new MetadataBreaks(2);
    for (let i = 0; i < 5; i++) m.addId3(tag([txxx('ad', `id=b${i};duration=1`)]), i);
    expect(m.breaks).toHaveLength(2);
  });
});

describe('breaksFromCues (native)', () => {
  const id3Cue = (start: number, entries: unknown[]): MetaCue => ({ startTime: start, type: 'org.id3', value: entries });

  it('reads Safari-style id3 and daterange cues, dropping duplicates and junk', () => {
    const cues: MetaCue[] = [
      id3Cue(10, [{ key: 'TXXX', info: 'ad', data: 'id=n1;duration=15' }]),
      id3Cue(10, [{ key: 'TXXX', info: 'ad', data: 'id=n1;duration=15' }]),
      { id: 'dr1', startTime: 40, endTime: 55, type: 'com.apple.quicktime.HLS', value: [{ key: 'CLASS', data: 'com.x.ad' }] },
      { id: 'dr2', startTime: 60, endTime: Infinity, value: { 'SCTE35-OUT': '0xFC', 'PLANNED-DURATION': '30' } },
      { id: 'other', startTime: 70, value: [{ key: 'CLASS', data: 'chapter' }] },
      { startTime: NaN, value: [{ key: 'CLASS', data: 'ad' }] },
      { startTime: 5, value: 42 },
      { startTime: 6, value: [null, 'x', { key: 7 }] },
      null as unknown as MetaCue,
    ];
    expect(breaksFromCues(cues)).toEqual([
      { id: 'n1', start: 10, end: 25, duration: 15, source: 'id3' },
      { id: 'dr1', start: 40, end: 55, duration: 15, source: 'daterange' },
      { id: 'dr2', start: 60, end: 90, duration: 30, source: 'daterange' },
    ]);
    expect(breaksFromCues(null)).toEqual([]);
    expect(breaksFromCues({ length: 1, 0: { get startTime(): number { throw new Error('x'); } } as unknown as MetaCue })).toEqual([]);
  });

  it('decodes a PRIV payload given as an ArrayBuffer', () => {
    const data = new Uint8Array(ascii('duration=8')).buffer;
    const b = breaksFromCues([id3Cue(3, [{ key: 'PRIV', info: 'urn:scte:scte35:2013:bin', data }])]);
    expect(b[0]).toMatchObject({ start: 3, end: 11, source: 'id3' });
  });
});

describe('watchNativeMetadata', () => {
  function fakeVideo(tracks: unknown[]) {
    const listeners: Record<string, (e: unknown) => void> = {};
    const list = Object.assign([...tracks], {
      addEventListener: (t: string, cb: (e: unknown) => void) => { listeners[t] = cb; },
      removeEventListener: vi.fn(),
    });
    const video = Object.assign(document.createElement('video'), {});
    Object.defineProperty(video, 'textTracks', { value: list });
    return { video, list, listeners };
  }
  function fakeTrack(kind: string, cues: MetaCue[] | null) {
    const handlers: Record<string, () => void> = {};
    return {
      kind, mode: 'disabled', cues, handlers,
      addEventListener: (t: string, cb: () => void) => { handlers[t] = cb; },
      removeEventListener: vi.fn(),
    };
  }

  it('is a no-op where textTracks is missing', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'textTracks', { value: undefined });
    const cb = vi.fn();
    expect(() => watchNativeMetadata(video, cb)()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  it('publishes cues from metadata tracks only, once per change, and stops on dispose', () => {
    const meta = fakeTrack('metadata', [{ id: 'd', startTime: 5, endTime: 15, value: [{ key: 'CLASS', data: 'ad' }] }]);
    const captions = fakeTrack('subtitles', [{ id: 'd2', startTime: 1, endTime: 2, value: [{ key: 'CLASS', data: 'ad' }] }]);
    const { video, listeners } = fakeVideo([meta, captions]);
    const cb = vi.fn();
    const stop = watchNativeMetadata(video, cb);
    expect(meta.mode).toBe('hidden');
    expect(captions.mode).toBe('disabled');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toEqual([{ id: 'd', start: 5, end: 15, duration: 10, source: 'daterange' }]);

    meta.handlers.cuechange?.();            // nothing changed
    expect(cb).toHaveBeenCalledTimes(1);

    const late = fakeTrack('metadata', [{ id: 'e', startTime: 30, endTime: 40, value: [{ key: 'CLASS', data: 'ad' }] }]);
    listeners.addtrack?.({ track: late });  // a track that shows up after load
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1]![0]).toHaveLength(2);

    stop();
    expect(meta.removeEventListener).toHaveBeenCalled();
  });

  it('survives a track whose cues are not loaded or whose mode is read-only', () => {
    const t = fakeTrack('metadata', null);
    Object.defineProperty(t, 'mode', { get: () => 'disabled', set: () => { throw new Error('ro'); } });
    const { video } = fakeVideo([t]);
    expect(() => watchNativeMetadata(video, vi.fn())).not.toThrow();
  });
});

describe('hls adapter in-band metadata', () => {
  const EVENTS = {
    MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'level', AUDIO_TRACKS_UPDATED: 'audios',
    AUDIO_TRACK_SWITCHED: 'audio', ERROR: 'error', LEVEL_LOADED: 'loaded', FRAG_PARSING_METADATA: 'meta',
  };
  const setup = async () => {
    const handlers: Record<string, (e: string, d: unknown) => void> = {};
    class Fake {
      static isSupported() { return true; }
      static Events = EVENTS;
      levels = []; audioTracks = []; currentLevel = -1; autoLevelEnabled = true; audioTrack = 0;
      on(event: string, cb: (e: string, d: unknown) => void) { handlers[event] = cb; }
      attachMedia() {} loadSource() {} destroy() {}
    }
    const received: unknown[][] = [];
    const h = {
      updateQualities() {}, updateRendition() {}, updateAudioTracks() {}, reportError() {},
      updateAdBreaks: (b: unknown[]) => received.push(b),
    };
    const a = createHlsAdapter({ Hls: Fake as never });
    await a.attach(document.createElement('video'), 'https://x/live.m3u8', h);
    await tick();
    return { handlers, received, a };
  };

  it('surfaces ID3 ad markers, merges with playlist breaks and ignores bad samples', async () => {
    const { handlers, received, a } = await setup();
    const sample = { pts: 20, data: tag([txxx('ad', 'id=i1;duration=10')]) };
    handlers.meta?.('meta', { samples: [sample, { pts: 21, data: new Uint8Array([1, 2]) }, { data: sample.data }, null] });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([{ id: 'i1', start: 20, end: 30, duration: 10, source: 'id3' }]);

    handlers.meta?.('meta', { samples: [sample] });   // duplicate: no republish
    handlers.meta?.('meta', undefined);
    handlers.meta?.('meta', { samples: 'nope' });
    expect(received).toHaveLength(1);

    handlers.loaded?.('loaded', { details: { fragments: [{ start: 0 }, { start: 50, tagList: [['CUE-OUT', '10']] }] } });
    expect(received[1]).toEqual([
      { id: 'cue-50.000', start: 50, end: 60, duration: 10, source: 'cue-out' },
      { id: 'i1', start: 20, end: 30, duration: 10, source: 'id3' },
    ]);
    a.detach();
  });

  it('on native HLS reads metadata cues instead of using hls.js', async () => {
    const meta = {
      kind: 'metadata', mode: 'disabled',
      cues: [{ id: 'd', startTime: 5, endTime: 15, value: [{ key: 'CLASS', data: 'ad' }] }] as MetaCue[],
      addEventListener() {}, removeEventListener() {},
    };
    const video = document.createElement('video');
    Object.defineProperty(video, 'textTracks', { value: Object.assign([meta], { addEventListener() {}, removeEventListener() {} }) });
    video.canPlayType = () => 'maybe';
    video.load = () => {};
    const received: unknown[][] = [];
    const h = { updateQualities() {}, updateRendition() {}, updateAudioTracks() {}, reportError() {}, updateAdBreaks: (b: unknown[]) => received.push(b) };
    const a = createHlsAdapter({});
    await a.attach(video, 'https://x/live.m3u8', h);
    await tick();
    expect(received[0]).toEqual([{ id: 'd', start: 5, end: 15, duration: 10, source: 'daterange' }]);
    a.detach();
  });
});

describe('hardening', () => {
  it('id3Marker ignores ordinary text frames and words that merely contain "in"/"ad"', () => {
    const f = (id: string, text: string, description = '') => [{ id, description, text }];
    expect(id3Marker(f('TIT2', 'Ad break tonight'), 1)).toBeNull();
    expect(id3Marker(f('TPE1', 'Read in the morning'), 1)).toBeNull();
    // a real open break stays open: "Read in" must not close it
    expect(id3Marker(f('TXXX', 'Read in the morning', 'note'), 1)).toBeNull();
    expect(id3Marker(f('TXXX', 'road end', 'note'), 1)).toBeNull();
    expect(id3Marker(f('TXXX', 'cue-in', 'x'), 1)).toEqual({ kind: 'in', time: 1 });
  });

  it('collapses id-less cues repeated inside an open break', () => {
    const m = new MetadataBreaks();
    const cue = tag([txxx('adbreak', 'start')]);
    expect(m.addId3(cue, 10)).toBe(true);
    expect(m.addId3(cue, 16)).toBe(false);
    expect(m.addId3(cue, 22)).toBe(false);
    expect(m.breaks).toHaveLength(1);
    expect(m.addId3(tag([txxx('adbreak', 'cue-in')]), 30)).toBe(true);
    expect(m.breaks[0]).toMatchObject({ start: 10, end: 30 });
    expect(m.addId3(cue, 60)).toBe(true);
    expect(m.breaks).toHaveLength(2);
  });

  it('evicts the oldest markers instead of freezing, and always accepts an in marker', () => {
    const m = new MetadataBreaks(4);
    for (let i = 0; i < 10; i++) m.addId3(tag([txxx('ad', `id=b${i};duration=2`)]), i * 10);
    const ids = m.breaks.map((b) => b.id);
    expect(ids).toEqual(['b6', 'b7', 'b8', 'b9']);
    const open = new MetadataBreaks(2);
    open.addId3(tag([txxx('ad', 'id=a;duration=1')]), 0);
    open.addId3(tag([txxx('ad', 'id=o')]), 10);
    expect(open.addId3(tag([txxx('adbreak', 'cue-in')]), 20)).toBe(true);
    expect(open.breaks.find((b) => b.id === 'o')?.end).toBe(20);
  });

  it('reverses unsynchronisation and skips the data length indicator', () => {
    // v2.3, whole tag unsynchronised: a 0xFF in the text is stored as FF 00
    const raw = [...ascii('TXXX'), 0, 0, 0, 5, 0, 0, 0, ...ascii('d'), 0, 0xff, 0x00, 0x62];
    const t3 = new Uint8Array([...ascii('ID3'), 3, 0, 0x80, ...synchsafe(raw.length), ...raw]);
    const out3 = decodeId3(t3);
    expect(out3[0]?.description).toBe('d');
    expect(out3[0]?.text).toBe('\u00ffb');
    // v2.4 frame flags: data length indicator (0x01) and unsync (0x02)
    const inner = [3, ...ascii('ad'), 0, ...ascii('duration=5')];
    const f4 = [...ascii('TXXX'), ...synchsafe(inner.length + 4), 0, 0x03, 0, 0, 0, inner.length, ...inner];
    const t4 = new Uint8Array([...ascii('ID3'), 4, 0, 0, ...synchsafe(f4.length), ...f4]);
    expect(decodeId3(t4)[0]).toMatchObject({ description: 'ad', text: 'duration=5' });
    // compressed frames are skipped, not garbled
    const fc = [...ascii('TXXX'), ...synchsafe(3), 0, 0x08, 1, 2, 3];
    expect(decodeId3(new Uint8Array([...ascii('ID3'), 4, 0, 0, ...synchsafe(fc.length), ...fc]))).toEqual([]);
  });

  it('caps native cue scanning across tracks', () => {
    const cues = Array.from({ length: 5000 }, (_, i) => ({ id: `c${i}`, startTime: i, endTime: i + 1, value: [{ key: 'CLASS', data: 'ad' }] })) as MetaCue[];
    expect(breaksFromCues(cues, 10)).toHaveLength(10);
    expect(breaksFromCues(cues).length).toBeLessThanOrEqual(2048);
  });
});

describe('hls adapter attach races', () => {
  const EV = { MANIFEST_PARSED: 'mp', LEVEL_SWITCHED: 'ls', AUDIO_TRACKS_UPDATED: 'atu', AUDIO_TRACK_SWITCHED: 'ats', ERROR: 'err', FRAG_PARSING_METADATA: 'meta' };
  const host = { updateQualities() {}, updateRendition() {}, updateAudioTracks() {}, reportError: vi.fn(), updateAdBreaks() {} };

  it('a superseded DRM attach creates no hls instance', async () => {
    let made = 0;
    class Fake {
      static isSupported() { return true; }
      static Events = EV;
      levels = []; audioTracks = [];
      constructor() { made++; }
      on() {} attachMedia() {} loadSource() {} destroy() {}
    }
    const a = createHlsAdapter({ Hls: Fake as never, drm: { widevine: { licenseUrl: 'https://l' } } as never });
    const first = a.attach(document.createElement('video'), 'https://x/a.m3u8', host);
    a.detach();
    await first;
    expect(made).toBe(0);
  });

  it('publishes one break when a playlist tag and ID3 mark the same ad', async () => {
    const handlers: Record<string, (e: string, d: unknown) => void> = {};
    const received: unknown[][] = [];
    class Fake {
      static isSupported() { return true; }
      static Events = { ...EV, LEVEL_LOADED: 'loaded' };
      levels = []; audioTracks = [];
      on(e: string, cb: (e: string, d: unknown) => void) { handlers[e] = cb; }
      attachMedia() {} loadSource() {} destroy() {}
    }
    const a = createHlsAdapter({ Hls: Fake as never });
    await a.attach(document.createElement('video'), 'https://x/a.m3u8', { ...host, updateAdBreaks: (b: unknown[]) => received.push(b) });
    await tick();
    handlers.loaded?.('l', { details: { fragments: [{ start: 50, tagList: [['CUE-OUT', '10']] }] } });
    handlers.meta?.('m', { samples: [{ pts: 50.2, data: tag([txxx('ad', 'id=zz;duration=10')]) }] });
    expect(received.at(-1)).toHaveLength(1);
    a.detach();
  });
});
