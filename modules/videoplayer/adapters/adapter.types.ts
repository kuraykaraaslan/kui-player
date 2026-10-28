import type { AudioTrackOption, PlayerError, QualityOption } from '../videoplayer.types.js';
import type { AdBreak } from '../videoplayer.adbreaks.js';
import type { Rendition } from '../videoplayer.qoe.js';
import type { ResolvedLive } from '../videoplayer.live.js';

/**
 * What an adapter may push back into the player while it is attached — level
 * lists, audio tracks and fatal errors all arrive asynchronously.
 */
export interface MediaAdapterHost {
  /**
   * Publish the current renditions. `activeIndex` is the level being played
   * (`-1` when unknown); `auto` reports whether ABR is picking it.
   */
  updateQualities(qualities: QualityOption[], activeIndex: number, auto: boolean): void;
  /** Publish the rendition now playing (bitrate, size, codec) for QoE accounting. */
  updateRendition(rendition: Rendition | null): void;
  /** Publish the ad breaks the stream marks (replaces the previous list). */
  updateAdBreaks(breaks: AdBreak[]): void;
  /** Publish the selectable audio renditions and which one is live. */
  updateAudioTracks(tracks: AudioTrackOption[], activeIndex: number): void;
  /** Surface a fatal streaming error through the player's normal error UI. */
  reportError(error: PlayerError): void;
  /**
   * The live options in force (the page's `live` prop, resolved). Adapters read
   * it for back-off, credentials and small-tile defaults.
   */
  readonly live?: ResolvedLive;
  /**
   * The stream has no end (`live`) or has one. `edgeToleranceS` is how far
   * behind the edge still counts as "live" for this stream — a few segments for
   * HLS, which plays that far behind on purpose.
   */
  updateLive?(live: boolean, edgeToleranceS?: number): void;
  /**
   * The adapter lost the stream and is opening it again (`reconnecting`), or
   * data is flowing once more. Not an error: the player shows its spinner.
   */
  updateRecovery?(state: { reconnecting: boolean; attempt?: number; reason?: 'auth' | 'network' }): void;
}

/**
 * Bridges a streaming engine (hls.js, dash.js, …) to a `<video>` element.
 *
 * Adapters are supplied by the consumer — nothing here imports a streaming
 * library, so an app that never uses one pays nothing in bundle size.
 */
export interface MediaAdapter {
  /** Stable identifier, e.g. `'hls'`. Used for diagnostics and de-duplication. */
  readonly name: string;
  /**
   * Whether this adapter should own the given source. Must be pure and free of
   * DOM access — it runs during render to decide who drives the element.
   */
  canPlay(src: string): boolean;
  /** Take over the element for `src`. Resolves once the stream is wired up. */
  attach(video: HTMLVideoElement, src: string, host: MediaAdapterHost): Promise<void>;
  /** Current renditions, best-effort; `[]` when the stream is not adaptive. */
  getQualities(): QualityOption[];
  /** Select a rendition by index — `-1` restores automatic (ABR) selection. */
  setQuality(index: number): void;
  /** Selectable audio renditions, when the format carries more than one. */
  getAudioTracks?(): AudioTrackOption[];
  /** Switch audio rendition by index. */
  setAudioTrack?(index: number): void;
  /** The streaming engine's own throughput estimate, bits/s, when it keeps one. */
  getBandwidth?(): number | undefined;
  /**
   * Stop loading media (no playlist or segment requests) without tearing the
   * session down. Used when a live player leaves the viewport or its viewer
   * stops answering the presence check.
   */
  suspend?(): void;
  /** Start loading again, at the live edge for a live stream. */
  resume?(): void;
  /** Where "live" is, in media time, when the engine keeps its own idea of it. */
  getLiveEdge?(): number | null;
  /** Release the streaming engine and any listeners. Must be idempotent. */
  detach(): void;
}

/** `-1` is the conventional "let ABR decide" index across streaming engines. */
export const AUTO_QUALITY = -1;

/** The value used for the "Auto" entry in the quality menu. */
export const AUTO_QUALITY_VALUE = 'auto';

/** Bitrate → a short human label, used when a rendition has no height. */
export function bitrateLabel(bitrate: number | undefined): string {
  if (!bitrate) return 'Unknown';
  return bitrate >= 1_000_000
    ? `${(bitrate / 1_000_000).toFixed(1)} Mbps`
    : `${Math.round(bitrate / 1000)} kbps`;
}

/** Height (+ optional framerate) → `1080p`, the label viewers expect. */
export function heightLabel(height: number | undefined, bitrate?: number): string {
  return height ? `${height}p` : bitrateLabel(bitrate);
}
