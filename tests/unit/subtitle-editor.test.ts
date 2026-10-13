import { describe, expect, it } from 'vitest';
import { parseSubtitles } from '../../modules/videoplayer/videoplayer.subtitles.parse';
import { parseEditedTime, serializeSrt, serializeVtt, tidyCues } from '../../modules/videoplayer/videoplayer.subtitles';

const cues = [
  { start: 5, end: 8.5, text: 'Second line' },
  { start: 1, end: 3.25, text: 'First line\nwith two rows' },
];

describe('tidyCues', () => {
  it('sorts, fixes ends before starts, trims, and drops empty cues', () => {
    expect(tidyCues([
      { start: 9, end: 2, text: '  late  ' },
      { start: 1, end: 2, text: '   ' },
      { start: -3, end: 1, text: 'early' },
    ])).toEqual([{ start: 0, end: 1, text: 'early' }, { start: 9, end: 9, text: 'late' }]);
  });
});

describe('serializers round-trip through the parsers', () => {
  it('SRT', () => {
    const srt = serializeSrt(cues);
    expect(srt.startsWith('1\n00:00:01,000 --> 00:00:03,250\nFirst line\nwith two rows\n')).toBe(true);
    expect(parseSubtitles(srt, 'x.srt')).toMatchObject([
      { start: 1, end: 3.25, text: 'First line\nwith two rows' }, { start: 5, end: 8.5, text: 'Second line' },
    ]);
  });
  it('WebVTT', () => {
    const vtt = serializeVtt(cues);
    expect(vtt.startsWith('WEBVTT\n\n00:00:01.000 --> 00:00:03.250\n')).toBe(true);
    expect(parseSubtitles(vtt, 'x.vtt')).toMatchObject([{ start: 1, end: 3.25 }, { start: 5, end: 8.5 }]);
  });
  it('does not let cue text end a WebVTT cue early', () => {
    expect(serializeVtt([{ start: 0, end: 1, text: 'a --> b' }])).not.toMatch(/a -->/);
  });
  it('writes hours and milliseconds correctly', () => {
    expect(serializeSrt([{ start: 3661.007, end: 3662, text: 'x' }])).toContain('01:01:01,007 --> 01:01:02,000');
  });
});

describe('parseEditedTime', () => {
  it('accepts the forms a person types', () => {
    expect(parseEditedTime('62.5')).toBe(62.5);
    expect(parseEditedTime('1:02.5')).toBe(62.5);
    expect(parseEditedTime('00:01:02,500')).toBe(62.5);
    expect(parseEditedTime(' 7 ')).toBe(7);
  });
  it('rejects the rest', () => {
    for (const bad of ['', 'abc', '1:2:3:4', '-1', '1.2.3']) expect(parseEditedTime(bad)).toBeNull();
  });
});
