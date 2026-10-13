import type { QoeSummary } from './videoplayer.qoe.js';

/** Everything the technical-info panel shows; a plain snapshot, no DOM references. */
export type Diagnostics = {
  adapter: string;                 // 'hls' | 'dash' | 'native'
  videoWidth: number;
  videoHeight: number;
  /** Seconds of media buffered ahead of the playhead. */
  bufferSeconds: number;
  /** Seconds behind the live edge, `null` for on-demand media. */
  liveLatency: number | null;
  qoe: QoeSummary;
};

export function formatBitrate(bps: number | null | undefined): string {
  if (!bps) return '—';
  return bps >= 1_000_000 ? `${(bps / 1_000_000).toFixed(2)} Mbps` : `${Math.round(bps / 1000)} kbps`;
}

export type DiagnosticRow = { key: string; value: string };

/** Row order and formatting, shared by the panel and the copy-to-clipboard text. */
export function diagnosticRows(d: Diagnostics): DiagnosticRow[] {
  const r = d.qoe.rendition;
  const size = d.videoWidth && d.videoHeight ? `${d.videoWidth}×${d.videoHeight}` : '—';
  const rows: DiagnosticRow[] = [
    { key: 'adapter', value: d.adapter },
    { key: 'resolution', value: size },
    { key: 'bitrate', value: formatBitrate(r?.bitrate) },
    { key: 'avgBitrate', value: formatBitrate(d.qoe.avgBitrate) },
    { key: 'bandwidth', value: formatBitrate(d.qoe.bandwidthBps) },
    { key: 'codec', value: r?.codec ?? '—' },
    { key: 'buffer', value: `${d.bufferSeconds.toFixed(1)} s` },
    { key: 'dropped', value: d.qoe.droppedFrames === null ? '—' : `${d.qoe.droppedFrames} / ${d.qoe.totalFrames ?? 0}` },
    { key: 'stalls', value: `${d.qoe.stallCount} (${(d.qoe.stallMs / 1000).toFixed(1)} s)` },
    { key: 'switches', value: String(d.qoe.switches) },
  ];
  if (d.liveLatency !== null) rows.push({ key: 'latency', value: `${d.liveLatency.toFixed(1)} s` });
  return rows;
}

/** Plain text for a bug report: `label: value` lines. */
export function diagnosticsText(d: Diagnostics, label: (key: string) => string = (k) => k): string {
  return diagnosticRows(d).map((row) => `${label(row.key)}: ${row.value}`).join('\n');
}
