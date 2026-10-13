import { describe, expect, it } from 'vitest';
import {
  AdBreakTracker, extractAdBreaks, parseAttributes, parseCueOut, type TaggedFragment,
} from '../../modules/videoplayer/videoplayer.adbreaks';

describe('parsing', () => {
  it('reads quoted and bare attributes', () => {
    expect(parseAttributes('ID="ad-1",START-DATE="2026-10-13T10:00:00Z",DURATION=30.5,X-FOO="a, b"')).toEqual({
      ID: 'ad-1', 'START-DATE': '2026-10-13T10:00:00Z', DURATION: '30.5', 'X-FOO': 'a, b',
    });
  });
  it('reads CUE-OUT durations in both spellings', () => {
    expect(parseCueOut('30')).toBe(30);
    expect(parseCueOut('DURATION=15.5')).toBe(15.5);
    expect(parseCueOut('')).toBeNull();
    expect(parseCueOut('0')).toBeNull();
    expect(parseCueOut(undefined)).toBeNull();
  });
});

describe('extractAdBreaks', () => {
  it('pairs CUE-OUT with CUE-IN, and trusts an explicit duration first', () => {
    const fragments: TaggedFragment[] = [
      { start: 0 },
      { start: 10, tagList: [['CUE-OUT', 'DURATION=20']] },
      { start: 20 },
      { start: 30, tagList: [['CUE-IN', '']] },
    ];
    expect(extractAdBreaks(fragments)).toEqual([
      { id: 'cue-10.000', start: 10, end: 30, duration: 20, source: 'cue-out' },
    ]);
  });

  it('leaves an unterminated, duration-less CUE-OUT open', () => {
    const [b] = extractAdBreaks([{ start: 5, tagList: [['CUE-OUT', '']] }]);
    expect(b).toMatchObject({ start: 5, end: null, duration: null });
  });

  it('maps a DATERANGE ad onto media time through the program clock', () => {
    const t0 = Date.parse('2026-10-13T10:00:00Z');
    const fragments: TaggedFragment[] = [
      { start: 0, programDateTime: t0 },
      { start: 10, programDateTime: t0 + 10_000 },
      {
        start: 20, programDateTime: t0 + 20_000,
        tagList: [['DATERANGE', 'ID="splice-9",START-DATE="2026-10-13T10:00:25Z",DURATION=15,SCTE35-OUT=0xFC30']],
      },
    ];
    expect(extractAdBreaks(fragments)).toEqual([
      { id: 'splice-9', start: 25, end: 40, duration: 15, source: 'daterange' },
    ]);
  });

  it('ignores DATERANGEs that are not ads, and ones it cannot place in time', () => {
    const t0 = Date.parse('2026-10-13T10:00:00Z');
    expect(extractAdBreaks([
      { start: 0, programDateTime: t0, tagList: [['DATERANGE', 'ID="chapter",START-DATE="2026-10-13T10:00:00Z",CLASS="chapter"']] },
    ])).toEqual([]);
    expect(extractAdBreaks([
      { start: 0, tagList: [['DATERANGE', 'ID="x",START-DATE="2026-10-13T10:00:00Z",SCTE35-OUT=0xFC']] },
    ])).toEqual([]);
  });

  it('accepts interstitial classes', () => {
    const t0 = Date.parse('2026-10-13T10:00:00Z');
    const [b] = extractAdBreaks([{
      start: 0, programDateTime: t0,
      tagList: [['DATERANGE', 'ID="i1",CLASS="com.apple.hls.interstitial",START-DATE="2026-10-13T10:00:03Z",END-DATE="2026-10-13T10:00:13Z"']],
    }]);
    expect(b).toMatchObject({ id: 'i1', start: 3, end: 13, duration: 10 });
  });

  it('is idempotent across playlist refreshes', () => {
    const f: TaggedFragment[] = [{ start: 10, tagList: [['CUE-OUT', '20']] }, { start: 30, tagList: [['CUE-IN', '']] }];
    expect(extractAdBreaks(f)).toEqual(extractAdBreaks(f));
  });
});

describe('AdBreakTracker', () => {
  const breaks = [{ id: 'a', start: 10, end: 20, duration: 10, source: 'cue-out' as const }];

  it('fires start and end once each as the playhead passes through', () => {
    const t = new AdBreakTracker();
    expect(t.update(breaks, 5)).toEqual([]);
    expect(t.update(breaks, 10).map((e) => e.type)).toEqual(['start']);
    expect(t.update(breaks, 15)).toEqual([]);
    expect(t.update(breaks, 20).map((e) => e.type)).toEqual(['end']);
    expect(t.update(breaks, 25)).toEqual([]);
  });

  it('ends a break when the viewer seeks out of it, and reports an open-ended break until it closes', () => {
    const t = new AdBreakTracker();
    t.update(breaks, 12);
    expect(t.update(breaks, 2).map((e) => e.type)).toEqual(['end']);
    const open = [{ id: 'o', start: 50, end: null, duration: null, source: 'cue-out' as const }];
    expect(t.update(open, 60).map((e) => e.type)).toEqual(['start']);
    expect(t.update([{ ...open[0]!, end: 70 }], 71).map((e) => e.type)).toEqual(['end']);
  });
});
