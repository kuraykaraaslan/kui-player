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
