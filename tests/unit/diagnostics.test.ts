import { describe, expect, it } from 'vitest';
import { diagnosticRows, diagnosticsText, formatBitrate, type Diagnostics } from '../../modules/videoplayer/videoplayer.diagnostics';

const base: Diagnostics = {
  adapter: 'hls', videoWidth: 1920, videoHeight: 1080, bufferSeconds: 12.34, liveLatency: null,
  qoe: {
    playingMs: 1000, stallCount: 2, stallMs: 1500, stallRatio: 0.5, switches: 3,
    rendition: { bitrate: 4_500_000, codec: 'avc1.640028' }, avgBitrate: 3_200_000,
    droppedFrames: 4, totalFrames: 900, bandwidthBps: 9_000_000,
  },
};

describe('diagnostics', () => {
  it('formats bitrates', () => {
    expect(formatBitrate(4_500_000)).toBe('4.50 Mbps');
    expect(formatBitrate(800_000)).toBe('800 kbps');
    expect(formatBitrate(null)).toBe('—');
  });

  it('lists the rows, adding latency only for live', () => {
    const rows = Object.fromEntries(diagnosticRows(base).map((r) => [r.key, r.value]));
    expect(rows).toMatchObject({
      adapter: 'hls', resolution: '1920×1080', bitrate: '4.50 Mbps', buffer: '12.3 s',
      dropped: '4 / 900', stalls: '2 (1.5 s)', switches: '3', codec: 'avc1.640028',
    });
    expect(rows.latency).toBeUndefined();
    expect(diagnosticRows({ ...base, liveLatency: 3.21 }).at(-1)).toEqual({ key: 'latency', value: '3.2 s' });
  });

  it('shows dashes when the browser reports nothing', () => {
    const rows = diagnosticRows({
      ...base, videoWidth: 0, videoHeight: 0,
      qoe: { ...base.qoe, rendition: null, avgBitrate: null, droppedFrames: null, totalFrames: null, bandwidthBps: null },
    });
    expect(rows.find((r) => r.key === 'resolution')?.value).toBe('—');
    expect(rows.find((r) => r.key === 'dropped')?.value).toBe('—');
  });

  it('renders copyable text with a label function', () => {
    const text = diagnosticsText(base, (k) => k.toUpperCase());
    expect(text.split('\n')[0]).toBe('ADAPTER: hls');
  });
});
