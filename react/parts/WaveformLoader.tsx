import { useEffect } from 'react';
import { computePeaks, parsePeaks } from '../../modules/videoplayer/videoplayer.waveform.js';

type Props = {
  /** A peaks array, a URL to a peaks JSON, or `'decode'` to compute them from the media itself. */
  waveform: string | number[];
  /** The media URL, for `'decode'`. */
  src: string;
  buckets: number;
  onPeaks: (peaks: number[] | null) => void;
};

/** Decoding fetches and holds the whole file in memory; past this it is not worth it. */
const MAX_DECODE_BYTES = 60 * 1024 * 1024;

type AudioContextCtor = new (...args: never[]) => {
  decodeAudioData(data: ArrayBuffer): Promise<{ numberOfChannels: number; getChannelData(i: number): Float32Array }>;
  close(): Promise<void>;
};

/**
 * Produces the waveform, in a chunk only players that ask for one download.
 * Anything that goes wrong ends in `null` — the seek bar then simply stays
 * a plain bar. No request is made beyond the media or the peaks file you named.
 */
export default function WaveformLoader({ waveform, src, buckets, onPeaks }: Props) {
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const done = (peaks: number[] | null) => { if (!cancelled) onPeaks(peaks); };

    // A new source starts without the previous source's wave.
    onPeaks(null);

    (async () => {
      if (Array.isArray(waveform)) return done(parsePeaks(waveform));
      if (waveform !== 'decode') {
        const response = await fetch(waveform, { signal: controller.signal });
        if (!response.ok) return done(null);
        return done(parsePeaks(await response.json()));
      }

      const response = await fetch(src, { signal: controller.signal });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (!response.ok || length > MAX_DECODE_BYTES) return done(null);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_DECODE_BYTES) return done(null);

      const Ctor = (globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext
        ?? (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return done(null);
      const context = new Ctor();
      try {
        const audio = await context.decodeAudioData(bytes);
        const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
        done(computePeaks(channels, buckets));
      } finally {
        void context.close();
      }
    })().catch(() => done(null));

    return () => { cancelled = true; controller.abort(); };
  }, [waveform, src, buckets, onPeaks]);

  return null;
}
