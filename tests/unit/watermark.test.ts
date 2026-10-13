import { describe, expect, it } from 'vitest';
import { clampOpacity, isHiddenStyle, nextWatermarkSlot } from '../../modules/videoplayer/videoplayer.watermark';

describe('watermark', () => {
  it('always moves to a different slot', () => {
    let slot = nextWatermarkSlot(null, () => 0);
    for (let i = 0; i < 50; i++) {
      const next = nextWatermarkSlot(slot, () => Math.random());
      expect(next).not.toEqual(slot);
      slot = next;
    }
  });

  it('keeps slots inside the frame', () => {
    for (const r of [0, 0.5, 0.999]) {
      const s = nextWatermarkSlot(null, () => r);
      expect(s.top).toBeGreaterThanOrEqual(0);
      expect(s.top).toBeLessThanOrEqual(90);
      expect(s.left).toBeLessThanOrEqual(80);
    }
  });

  it('never allows an invisible mark', () => {
    expect(clampOpacity(0)).toBe(0.05);
    expect(clampOpacity(5)).toBe(1);
    expect(clampOpacity(undefined)).toBe(0.25);
  });

  it('detects hidden styles', () => {
    expect(isHiddenStyle({ display: 'none', visibility: 'visible', opacity: '1' })).toBe(true);
    expect(isHiddenStyle({ display: 'block', visibility: 'hidden', opacity: '1' })).toBe(true);
    expect(isHiddenStyle({ display: 'block', visibility: 'visible', opacity: '0' })).toBe(true);
    expect(isHiddenStyle({ display: 'block', visibility: 'visible', opacity: '0.25' })).toBe(false);
  });
});
