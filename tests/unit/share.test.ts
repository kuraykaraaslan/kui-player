import { describe, expect, it } from 'vitest';
import { parseTimeParam, readUrlTime, buildShareUrl } from '../../modules/videoplayer/videoplayer.share';

describe('parseTimeParam', () => {
  it('reads seconds, units and clock notation', () => {
    expect(parseTimeParam('90')).toBe(90);
    expect(parseTimeParam('1m30s')).toBe(90);
    expect(parseTimeParam('1h2m3s')).toBe(3723);
    expect(parseTimeParam('1:30')).toBe(90);
    expect(parseTimeParam('1:02:03')).toBe(3723);
    expect(parseTimeParam('45s')).toBe(45);
  });
  it('ignores garbage silently', () => {
    for (const bad of ['', '-5', 'abc', 'ms', '1x', null, undefined]) {
      expect(parseTimeParam(bad)).toBeNull();
    }
  });
});

describe('readUrlTime', () => {
  it('reads query and hash, query first', () => {
    expect(readUrlTime('https://x.test/v?t=90')).toBe(90);
    expect(readUrlTime('https://x.test/v#t=1m30s')).toBe(90);
    expect(readUrlTime('https://x.test/v?t=10#t=20')).toBe(10);
    expect(readUrlTime('https://x.test/v?start=7', 'start')).toBe(7);
    expect(readUrlTime('https://x.test/v?t=oops')).toBeNull();
  });
});

describe('buildShareUrl', () => {
  it('sets the time, keeps other params, drops a stale hash time', () => {
    expect(buildShareUrl('https://x.test/v?a=1', 90.7)).toBe('https://x.test/v?a=1&t=90');
    expect(buildShareUrl('https://x.test/v?t=5#t=9', 30)).toBe('https://x.test/v?t=30');
  });
});
