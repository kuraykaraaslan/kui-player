import { describe, expect, it } from 'vitest';
import { clampOffset, miniEnabled, nearestCorner, shouldFloat, stepCorner, type MiniInputs } from '../../modules/videoplayer/videoplayer.mini';

const base: MiniInputs = { enabled: true, playing: true, visible: false, dismissed: false, fullscreen: false, skin: false };

describe('shouldFloat', () => {
  it('floats only while playing and scrolled out of view', () => {
    expect(shouldFloat(base)).toBe(true);
    expect(shouldFloat({ ...base, playing: false })).toBe(false);
    expect(shouldFloat({ ...base, visible: true })).toBe(false);
  });
  it('respects dismissal, fullscreen, skin mode and the option', () => {
    expect(shouldFloat({ ...base, dismissed: true })).toBe(false);
    expect(shouldFloat({ ...base, fullscreen: true })).toBe(false);
    expect(shouldFloat({ ...base, skin: true })).toBe(false);
    expect(shouldFloat({ ...base, enabled: false })).toBe(false);
  });
});

describe('miniEnabled', () => {
  it('is off by default and on desktop when asked for', () => {
    expect(miniEnabled(undefined, false)).toBe(false);
    expect(miniEnabled(false, false)).toBe(false);
    expect(miniEnabled(true, false)).toBe(true);
  });
  it('stays off on touch devices unless that is opted into', () => {
    expect(miniEnabled(true, true)).toBe(false);
    expect(miniEnabled({ corner: 'top-left' }, true)).toBe(false);
    expect(miniEnabled({ touch: true }, true)).toBe(true);
  });
});

const vp = { width: 1000, height: 600 };
const box = { left: 780, top: 400, width: 200, height: 120 };

describe('clampOffset', () => {
  it('keeps the box inside the viewport on every side', () => {
    expect(clampOffset(box, vp, 500, 500)).toEqual({ x: 20, y: 80 });
    expect(clampOffset(box, vp, -5000, -5000)).toEqual({ x: -780, y: -400 });
    expect(clampOffset(box, vp, -10, 15)).toEqual({ x: -10, y: 15 });
  });
  it('does not throw when the box is larger than the viewport', () => {
    expect(clampOffset({ left: 0, top: 0, width: 2000, height: 900 }, vp, 50, 50)).toEqual({ x: 0, y: 0 });
  });
});

describe('nearestCorner', () => {
  it('picks the quadrant of the box centre', () => {
    expect(nearestCorner({ left: 10, top: 10, width: 100, height: 60 }, vp, false)).toBe('top-left');
    expect(nearestCorner(box, vp, false)).toBe('bottom-right');
    expect(nearestCorner({ left: 800, top: 10, width: 100, height: 60 }, vp, false)).toBe('top-right');
  });
  it('is logical: the physical left half is "right" (inline-end) in RTL', () => {
    expect(nearestCorner({ left: 10, top: 10, width: 100, height: 60 }, vp, true)).toBe('top-right');
    expect(nearestCorner(box, vp, true)).toBe('bottom-left');
  });
});

describe('stepCorner', () => {
  it('moves in the physical arrow direction and stops at the edge', () => {
    expect(stepCorner('bottom-right', 'ArrowLeft', false)).toBe('bottom-left');
    expect(stepCorner('bottom-right', 'ArrowUp', false)).toBe('top-right');
    expect(stepCorner('bottom-right', 'ArrowRight', false)).toBe('bottom-right');
    expect(stepCorner('top-left', 'ArrowDown', false)).toBe('bottom-left');
  });
  it('maps physical arrows onto logical corners in RTL', () => {
    // logical "right" is on the physical left in RTL
    expect(stepCorner('bottom-right', 'ArrowRight', true)).toBe('bottom-left');
    expect(stepCorner('bottom-left', 'ArrowLeft', true)).toBe('bottom-right');
    expect(stepCorner('bottom-right', 'ArrowLeft', true)).toBe('bottom-right');
  });
});
