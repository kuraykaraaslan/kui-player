import { describe, expect, it } from 'vitest';
import {
  parseVtt, parseChapters, parseStoryboard, parseTimestamp,
} from '../../modules/videoplayer/videoplayer.vtt';
import { findAt } from '../../modules/videoplayer/videoplayer.timeline';
import { parseSrt, parseAss, parseSubtitles } from '../../modules/videoplayer/videoplayer.subtitles.parse';
import { detectFormat } from '../../modules/videoplayer/videoplayer.subtitles';

describe('parseTimestamp', () => {
  it('reads every shape a cue timing takes', () => {
    expect(parseTimestamp('00:00:01.500')).toBe(1.5);
    expect(parseTimestamp('01:02.250')).toBe(62.25);
    expect(parseTimestamp('90')).toBe(90);
    expect(parseTimestamp('00:01:00,500')).toBe(60.5);   // SRT comma
    expect(parseTimestamp('01:02:03.000')).toBe(3723);
  });
});

describe('parseVtt', () => {
  const sample = `WEBVTT

NOTE this block is ignored

intro
00:00:00.000 --> 00:00:02.000 line:0
Hello <b>world</b>

00:00:02.000 --> 00:00:04.000
Second
cue`;

  it('reads cues, ids and multi-line text, and skips metadata blocks', () => {
    const cues = parseVtt(sample);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 0, end: 2, text: 'Hello world', id: 'intro' });
    expect(cues[1]!.text).toBe('Second\ncue');
  });

  it('survives malformed input rather than throwing', () => {
    expect(parseVtt('')).toEqual([]);
    expect(parseVtt('WEBVTT\n\nnot a cue\n')).toEqual([]);
    expect(parseVtt('WEBVTT\n\n00:00:01.000 --> nonsense\ntext')).toEqual([]);
  });

  it('handles CRLF files', () => {
    expect(parseVtt('WEBVTT\r\n\r\n00:00.000 --> 00:01.000\r\nHi')).toHaveLength(1);
  });
});

describe('parseChapters', () => {
  it('turns cues into sorted chapters', () => {
    const chapters = parseChapters(`WEBVTT

00:00:10.000 --> 00:00:20.000
Second part

00:00:00.000 --> 00:00:10.000
Opening`);
    expect(chapters.map((c) => c.title)).toEqual(['Opening', 'Second part']);
    expect(chapters[0]).toMatchObject({ start: 0, end: 10 });
  });
});

describe('parseStoryboard', () => {
  const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
sprite.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
sprite.jpg#xywh=160,0,160,90

00:00:10.000 --> 00:00:15.000
whole-frame.jpg`;

  it('resolves image URLs and sprite rectangles', () => {
    const tiles = parseStoryboard(vtt, 'https://cdn.example.com/media/board.vtt');
    expect(tiles).toHaveLength(3);
    expect(tiles[0]!.url).toBe('https://cdn.example.com/media/sprite.jpg');
    expect(tiles[1]!.rect).toEqual({ x: 160, y: 0, w: 160, h: 90 });
    expect(tiles[2]!.rect).toBeNull();
  });
});

describe('findAt', () => {
  const items = [
    { start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 },
  ];

  it('finds the entry covering a time', () => {
    expect(findAt(items, 0)).toBe(items[0]);
    expect(findAt(items, 9.9)).toBe(items[0]);
    expect(findAt(items, 10)).toBe(items[1]);
    expect(findAt(items, 25)).toBe(items[2]);
  });

  it('clamps past the end and returns null before the start', () => {
    expect(findAt(items, 999)).toBe(items[2]);
    expect(findAt([{ start: 5, end: 10 }], 1)).toBeNull();
    expect(findAt([], 5)).toBeNull();
  });
});

describe('subtitle formats', () => {
  it('detects the format from the extension, then the content', () => {
    expect(detectFormat('/a/b.srt')).toBe('srt');
    expect(detectFormat('/a/b.ass')).toBe('ass');
    expect(detectFormat('/a/b.ssa')).toBe('ass');
    expect(detectFormat('/a/b.vtt?token=1')).toBe('vtt');
    expect(detectFormat('/api/subs', 'WEBVTT\n\n00:00.000 --> 00:01.000\nhi')).toBe('vtt');
    expect(detectFormat('/api/subs', '[Script Info]\nTitle: x')).toBe('ass');
    expect(detectFormat('/api/subs', '1\n00:00:01,000 --> 00:00:02,000\nhi')).toBe('srt');
  });

  it('parses SubRip, including its comma timings and index lines', () => {
    const cues = parseSrt(`1
00:00:01,000 --> 00:00:03,500
First line
second line

2
00:00:04,000 --> 00:00:06,000
<i>Styled</i> text`);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: 'First line\nsecond line' });
    expect(cues[1]!.text).toBe('Styled text');
  });

  it('parses ASS dialogue, stripping override blocks', () => {
    const cues = parseAss(`[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\an8}Top line\\Nsecond
Dialogue: 0,0:00:04.00,0:00:05.00,Alt,,0,0,0,,Plain, with a comma
Comment: 0,0:00:06.00,0:00:07.00,Default,,0,0,0,,ignored`);

    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1, end: 3, text: 'Top line\nsecond', align: 8, style: 'Default' });
    // Text after the ninth comma is the payload, commas included.
    expect(cues[1]!.text).toBe('Plain, with a comma');
  });

  it('routes to the right parser', () => {
    expect(parseSubtitles('1\n00:00:01,000 --> 00:00:02,000\nhi', 'x.srt')[0]!.text).toBe('hi');
    expect(parseSubtitles('WEBVTT\n\n00:00.000 --> 00:01.000\nhi', 'x.vtt')[0]!.text).toBe('hi');
  });
});
