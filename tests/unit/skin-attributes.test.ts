import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOff, parseFlag, parseLive, parsePresence, parseSources } from '../../embed/attributes';

describe('attribute values for the live-stream options', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads a flag', () => {
    expect(parseFlag(null)).toBe(false);
    expect(parseFlag(null, true)).toBe(true);
    expect(parseFlag('')).toBe(true);
    expect(parseFlag('true')).toBe(true);
    for (const off of ['false', 'off', '0', 'no', ' OFF ']) expect(parseFlag(off), off).toBe(false);
    expect(isOff(null)).toBe(false);
    expect(isOff('off')).toBe(true);
  });

  it('reads live: absent detects, a bare attribute hints, "off" turns it off, JSON gives options', () => {
    expect(parseLive(null)).toBeUndefined();
    expect(parseLive(undefined)).toBeUndefined();
    expect(parseLive('')).toBe(true);
    expect(parseLive('true')).toBe(true);
    expect(parseLive('false')).toBe(false);
    expect(parseLive('off')).toBe(false);
    expect(parseLive('{"dvr":true,"stopWhenHidden":false}')).toEqual({ dvr: true, stopWhenHidden: false });
  });

  it('warns about live JSON it cannot read, and ignores it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseLive('{dvr')).toBeUndefined();
    expect(parseLive('{"x":1}')).toEqual({ x: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reads presence from the pair of attributes, from JSON, or "off"', () => {
    expect(parsePresence(null)).toBeUndefined();
    expect(parsePresence('off')).toBe(false);
    expect(parsePresence('false')).toBe(false);
    expect(parsePresence(null, '600000', '30000')).toEqual({ everyMs: 600000, graceMs: 30000 });
    expect(parsePresence('{"everyMs":5000,"graceMs":2000}')).toEqual({ everyMs: 5000, graceMs: 2000 });
    // One half, or nonsense, is nothing to count with.
    expect(parsePresence(null, '600000', null)).toBeUndefined();
    expect(parsePresence(null, 'soon', '30000')).toBeUndefined();
    expect(parsePresence(null, '0', '30000')).toBeUndefined();
  });

  it('ignores presence JSON with the wrong numbers', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parsePresence('{"everyMs":"x","graceMs":1}')).toBeUndefined();
    expect(parsePresence('[1]')).toBeUndefined();
  });

  it('reads sources, dropping entries without a label and an address', () => {
    expect(parseSources(null)).toBeUndefined();
    expect(parseSources('[{"label":"Standard","src":"a.m3u8"},{"label":"High","src":"b.m3u8"}]'))
      .toEqual([{ label: 'Standard', src: 'a.m3u8' }, { label: 'High', src: 'b.m3u8' }]);
    expect(parseSources('[{"label":"x"},{"label":"y","src":"b"},7]')).toEqual([{ label: 'y', src: 'b' }]);
    expect(parseSources('[]')).toBeUndefined();
  });

  it('warns about sources it cannot read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseSources('nope')).toBeUndefined();
    expect(parseSources('{"a":1}')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
