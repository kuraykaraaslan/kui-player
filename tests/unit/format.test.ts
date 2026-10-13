import { describe, expect, it } from 'vitest';
import { formatTime } from '../../modules/videoplayer/videoplayer.format';

describe('formatTime', () => {
  it('formats sub-hour durations as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(599)).toBe('9:59');
  });

  it('adds an hours field past 3600s, zero-padding minutes', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3661)).toBe('1:01:01');
    expect(formatTime(36000)).toBe('10:00:00');
  });

  it('truncates rather than rounds, so the clock never runs ahead', () => {
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(119.99)).toBe('1:59');
  });

  it('degrades to 0:00 for the values a media element really produces', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });
});

describe('PLAYER_META', () => {
  it('carries the version that was actually built', async () => {
    const { PLAYER_META } = await import('../../modules/videoplayer/videoplayer.meta');
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version: string };
    // Injected at build time, so the About dialog cannot drift from the release.
    expect(PLAYER_META.version).toBe(pkg.version);
  });
});

import { clampSubtitleOffset, formatSubtitleOffset, isLocalTrack } from '../../modules/videoplayer/videoplayer.subtitles';

describe('subtitle offset helpers', () => {
  it('rounds to a tenth and clamps', () => {
    expect(clampSubtitleOffset(0.1 + 0.2)).toBe(0.3);
    expect(clampSubtitleOffset(500)).toBe(120);
    expect(clampSubtitleOffset(-500)).toBe(-120);
  });
  it('formats with a sign', () => {
    expect(formatSubtitleOffset(0.3)).toBe('+0.3 s');
    expect(formatSubtitleOffset(-1.5)).toBe('-1.5 s');
    expect(formatSubtitleOffset(0)).toBe('0 s');
    expect(formatSubtitleOffset(12)).toBe('+12 s');
  });
  it('knows which tracks the player must time itself', () => {
    expect(isLocalTrack({ src: '/a.vtt' })).toBe(false);
    expect(isLocalTrack({ src: '/a.srt' })).toBe(true);
    expect(isLocalTrack({ src: 'blob:abc', local: true })).toBe(true);
  });
});
