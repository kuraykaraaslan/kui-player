import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no type declarations
import { PeakAccumulator, buildPeaks } from '../../scripts/peaks.mjs';
import { parsePeaks } from '../../modules/videoplayer/videoplayer.waveform';

const pcm = (samples: number[]) => Buffer.from(Int16Array.from(samples).buffer);

describe('peaks generator', () => {
  it('folds samples into min/max pairs per pixel', () => {
    const doc = buildPeaks(pcm([0, 1000, -2000, 500, 256, -256, 0, 0]), { sampleRate: 8000, samplesPerPixel: 4, bits: 16 });
    expect(doc).toMatchObject({ version: 2, channels: 1, sample_rate: 8000, samples_per_pixel: 4, bits: 16, length: 2 });
    expect(doc.data).toEqual([-2000, 1000, -256, 256]);
  });

  it('scales to 8 bits and clamps', () => {
    const doc = buildPeaks(pcm([-32768, 32767]), { samplesPerPixel: 2, bits: 8 });
    expect(doc.data).toEqual([-128, 127]);
  });

  it('keeps a trailing partial pixel', () => {
    const doc = buildPeaks(pcm([100, 200, 300]), { samplesPerPixel: 2, bits: 16 });
    expect(doc.length).toBe(2);
    expect(doc.data).toEqual([100, 200, 300, 300]);
  });

  it('gives the same result however the stream is chunked, including odd byte splits', () => {
    const whole = pcm(Array.from({ length: 50 }, (_, i) => (i % 7) * 900 - 2000));
    const a = new PeakAccumulator({ samplesPerPixel: 5, bits: 16 });
    a.push(whole);
    const b = new PeakAccumulator({ samplesPerPixel: 5, bits: 16 });
    for (let i = 0; i < whole.length; i += 3) b.push(whole.subarray(i, i + 3));
    expect(b.finish(8000)).toEqual(a.finish(8000));
  });

  it('is empty for no audio and rejects bad options', () => {
    expect(buildPeaks(Buffer.alloc(0)).data).toEqual([]);
    expect(() => new PeakAccumulator({ samplesPerPixel: 0 })).toThrow(RangeError);
    expect(() => new PeakAccumulator({ bits: 12 })).toThrow(RangeError);
  });

  it('produces a document the player reads back as normalised bars', () => {
    const doc = buildPeaks(pcm([0, 1000, 0, 4000, 0, 2000]), { samplesPerPixel: 2, bits: 16 });
    const bars = parsePeaks(doc)!;
    expect(bars).toHaveLength(3);
    expect(Math.max(...bars)).toBe(1);
    expect(bars[0]).toBeCloseTo(0.25);
  });
});
