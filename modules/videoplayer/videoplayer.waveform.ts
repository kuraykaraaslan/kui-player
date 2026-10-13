/**
 * Waveform data: turning raw samples or a pre-made peaks file into a row of
 * bar heights (0–1). Pure, so it is testable without Web Audio.
 */

/** Bar heights from raw samples: the loudest sample in each bucket, scaled so the loudest bar is 1. */
export function computePeaks(channels: ArrayLike<number>[], buckets: number): number[] {
  const length = Math.max(0, ...channels.map((c) => c.length));
  if (length === 0 || buckets <= 0) return [];
  const count = Math.min(buckets, length);
  const size = length / count;
  const peaks = new Array<number>(count).fill(0);
  for (let b = 0; b < count; b += 1) {
    const from = Math.floor(b * size);
    const to = Math.max(from + 1, Math.floor((b + 1) * size));
    let max = 0;
    for (const channel of channels) {
      for (let i = from; i < Math.min(to, channel.length); i += 1) {
        const v = Math.abs(channel[i] ?? 0);
        if (v > max) max = v;
      }
    }
    peaks[b] = max;
  }
  return normalise(peaks);
}

/** Scale so the loudest bar is 1 — a quiet recording still gets a readable shape. */
export function normalise(peaks: number[]): number[] {
  const loudest = Math.max(0, ...peaks);
  return loudest > 0 ? peaks.map((p) => Math.min(1, p / loudest)) : peaks.map(() => 0);
}

/** Fewer, wider bars: the maximum of each group. */
export function downsamplePeaks(peaks: readonly number[], buckets: number): number[] {
  if (peaks.length <= buckets || buckets <= 0) return [...peaks];
  const size = peaks.length / buckets;
  return Array.from({ length: buckets }, (_, b) => {
    let max = 0;
    for (let i = Math.floor(b * size); i < Math.floor((b + 1) * size) && i < peaks.length; i += 1) {
      if ((peaks[i] ?? 0) > max) max = peaks[i]!;
    }
    return max;
  });
}

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/**
 * Peaks from a file the page supplies. Understood: a plain array of numbers
 * (0–1 or −1–1), wavesurfer-style `{ peaks: [...] }` (first channel), and the
 * BBC `audiowaveform` JSON `{ bits, data: [min, max, min, max, …] }`.
 * Anything else is `null`, never an exception.
 */
export function parsePeaks(input: unknown): number[] | null {
  if (isNumbers(input)) return input.length > 0 ? normalise(input.map(Math.abs)) : null;
  if (!input || typeof input !== 'object') return null;
  const o = input as { peaks?: unknown; data?: unknown; bits?: unknown };

  if (Array.isArray(o.peaks)) {
    const first = Array.isArray(o.peaks[0]) ? o.peaks[0] : o.peaks;
    return isNumbers(first) && first.length > 0 ? normalise(first.map(Math.abs)) : null;
  }
  if (isNumbers(o.data) && o.data.length >= 2) {
    // audiowaveform interleaves min and max per pixel as signed integers.
    const scale = 2 ** ((typeof o.bits === 'number' ? o.bits : 8) - 1);
    const bars: number[] = [];
    for (let i = 0; i + 1 < o.data.length; i += 2) {
      bars.push(Math.max(Math.abs(o.data[i]!), Math.abs(o.data[i + 1]!)) / scale);
    }
    return normalise(bars);
  }
  return null;
}
