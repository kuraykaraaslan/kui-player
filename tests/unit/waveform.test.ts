import { describe, expect, it } from 'vitest';
import { computePeaks, downsamplePeaks, normalise, parsePeaks } from '../../modules/videoplayer/videoplayer.waveform';

describe('computePeaks', () => {
  it('takes the loudest sample per bucket, scaled to the loudest', () => {
    const samples = [0, 0.2, -0.1, 0.1, 0, -0.4, 0.05, 0.4];
    expect(computePeaks([samples], 4)).toEqual([0.5, 0.25, 1, 1]);
  });
  it('looks across channels', () => {
    expect(computePeaks([[0, 0.5], [0.25, 0]], 2)).toEqual([0.5, 1]);
  });
  it('never invents bars: fewer samples than buckets gives fewer bars', () => {
    expect(computePeaks([[0.5, 1]], 10)).toEqual([0.5, 1]);
    expect(computePeaks([[]], 4)).toEqual([]);
    expect(computePeaks([[1]], 0)).toEqual([]);
  });
  it('shows silence as silence, not as full-scale noise', () => {
    expect(computePeaks([[0, 0, 0, 0]], 2)).toEqual([0, 0]);
  });
});

describe('normalise and downsample', () => {
  it('scales to 1', () => { expect(normalise([0.1, 0.2])).toEqual([0.5, 1]); });
  it('keeps the maximum of each group', () => {
    expect(downsamplePeaks([0.1, 0.9, 0.2, 0.3, 0.4, 0.1], 3)).toEqual([0.9, 0.3, 0.4]);
    expect(downsamplePeaks([0.5], 10)).toEqual([0.5]);
  });
});

describe('parsePeaks', () => {
  it('reads a plain array, ignoring the sign', () => {
    expect(parsePeaks([-0.5, 0.25, 1])).toEqual([0.5, 0.25, 1]);
  });
  it('reads wavesurfer-style peaks, flat or per channel', () => {
    expect(parsePeaks({ peaks: [0.5, 1] })).toEqual([0.5, 1]);
    expect(parsePeaks({ peaks: [[0.2, 0.4], [0.9, 0.9]] })).toEqual([0.5, 1]);
  });
  it('reads audiowaveform JSON (interleaved min/max integers)', () => {
    expect(parsePeaks({ bits: 8, data: [-64, 32, -128, 100, 0, 0] })).toEqual([0.5, 1, 0]);
  });
  it('rejects everything else quietly', () => {
    for (const bad of [null, undefined, 'x', 3, {}, [], { data: [1] }, { peaks: 'no' }, [1, 'a']]) {
      expect(parsePeaks(bad)).toBeNull();
    }
  });
});
