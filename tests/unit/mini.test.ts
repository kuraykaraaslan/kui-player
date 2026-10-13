import { describe, expect, it } from 'vitest';
import { miniEnabled, shouldFloat, type MiniInputs } from '../../modules/videoplayer/videoplayer.mini';

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
