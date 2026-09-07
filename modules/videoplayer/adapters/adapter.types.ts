import type { AudioTrackOption, PlayerError, QualityOption } from '../videoplayer.types';

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
  /** Publish the selectable audio renditions and which one is live. */
  updateAudioTracks(tracks: AudioTrackOption[], activeIndex: number): void;
  /** Surface a fatal streaming error through the player's normal error UI. */
  reportError(error: PlayerError): void;
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
