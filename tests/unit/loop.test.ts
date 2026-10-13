import { describe, expect, it } from 'vitest';
import { markLoop, RangeSpeeds, stepLoop } from '../../modules/videoplayer/videoplayer.loop';

describe('markLoop', () => {
  it('sets A, then B, then clears', () => {
    const a = markLoop(null, 10);
    expect(a).toEqual({ a: 10, b: null });
    const ab = markLoop(a, 20);
    expect(ab).toEqual({ a: 10, b: 20 });
    expect(markLoop(ab, 30)).toBeNull();
  });
  it('reads a B before A as the same range reversed', () => {
    expect(markLoop({ a: 20, b: null }, 5)).toEqual({ a: 5, b: 20 });
  });
});

describe('stepLoop', () => {
  const range = { a: 10, b: 20 };
  it('does nothing before B or without a complete range', () => {
    expect(stepLoop(range, 19.9, 0, 0)).toBeNull();
    expect(stepLoop({ a: 10, b: null }, 50, 0, 0)).toBeNull();
    expect(stepLoop(null, 5, 0, 0)).toBeNull();
  });
  it('jumps back to A at B, forever when repeat is 0', () => {
    expect(stepLoop(range, 20, 0, 0)).toEqual({ seekTo: 10 });
    expect(stepLoop(range, 20.1, 999, 0)).toEqual({ seekTo: 10 });
  });
  it('counts passes and lets playback continue after the last', () => {
    expect(stepLoop(range, 20, 0, 3)).toEqual({ seekTo: 10 });
    expect(stepLoop(range, 20, 1, 3)).toEqual({ seekTo: 10 });
    expect(stepLoop(range, 20, 2, 3)).toEqual({ finished: true });
    expect(stepLoop(range, 20, 0, 1)).toEqual({ finished: true });
  });
  it('ignores a playhead the viewer moved well past B', () => {
    expect(stepLoop(range, 45, 0, 0)).toBeNull();
  });
});

describe('RangeSpeeds', () => {
  it('remembers a speed per range', () => {
    const speeds = new RangeSpeeds();
    speeds.set({ a: 10, b: 20 }, 0.5);
    expect(speeds.get({ a: 10, b: 20 })).toBe(0.5);
    expect(speeds.get({ a: 10, b: 21 })).toBeUndefined();
  });
});
