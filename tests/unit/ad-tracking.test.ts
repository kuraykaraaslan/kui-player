import { describe, expect, it } from 'vitest';
import { AdQuartiles, expandMacros, skipCountdown } from '../../modules/ads/tracking';

describe('expandMacros', () => {
  const now = new Date('2026-10-13T12:00:00.000Z');
  it('fills the macros it knows', () => {
    expect(expandMacros('https://t.test/e?ts=[TIMESTAMP]&cb=[CACHEBUSTING]', {}, now, () => 0.5))
      .toBe('https://t.test/e?ts=2026-10-13T12:00:00.000Z&cb=50000000');
    expect(expandMacros('https://t.test/e?code=[ERRORCODE]&at=[CONTENTPLAYHEAD]', { errorCode: 405, playhead: 3725.5 }, now))
      .toBe('https://t.test/e?code=405&at=01:02:05.500');
    expect(expandMacros('https://t.test/e?u=[ASSETURI]', { assetUri: 'https://cdn.test/a b.mp4' }, now))
      .toBe('https://t.test/e?u=https%3A%2F%2Fcdn.test%2Fa%20b.mp4');
  });
  it('leaves what it cannot fill untouched', () => {
    expect(expandMacros('https://t.test/e?c=[ERRORCODE]&x=[SOMETHINGELSE]', {}, now)).toBe('https://t.test/e?c=[ERRORCODE]&x=[SOMETHINGELSE]');
  });
});

describe('AdQuartiles', () => {
  it('reports start and each quartile once, in order, even if time jumps', () => {
    const q = new AdQuartiles();
    expect(q.update(0, 20)).toEqual([]);
    expect(q.update(0.1, 20)).toEqual(['start']);
    expect(q.update(5, 20)).toEqual(['firstQuartile']);
    expect(q.update(5.5, 20)).toEqual([]);
    expect(q.update(16, 20)).toEqual(['midpoint', 'thirdQuartile']);
    q.reset();
    expect(q.update(1, 20)).toEqual(['start']);
  });
  it('skips the quartiles for an unknown duration', () => {
    expect(new AdQuartiles().update(3, 0)).toEqual(['start']);
  });
});

describe('skipCountdown', () => {
  it('counts down to the skip button', () => {
    expect(skipCountdown(5, 1.2)).toBe(4);
    expect(skipCountdown(5, 5)).toBe(0);
    expect(skipCountdown(5, 9)).toBe(0);
    expect(skipCountdown(null, 3)).toBeNull();
  });
});
