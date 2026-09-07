import type { AudioTrackOption, QualityOption } from '../videoplayer.types';
import { AUTO_QUALITY, heightLabel, type MediaAdapter, type MediaAdapterHost } from './adapter.types';

// ─── the slice of the hls.js surface we actually touch ───────────────────────

type HlsLevel = { height?: number; width?: number; bitrate?: number; name?: string };
type HlsAudioTrack = { name?: string; lang?: string; language?: string };

type HlsInstance = {
  levels: HlsLevel[];
  currentLevel: number;
  autoLevelEnabled: boolean;
  audioTracks: HlsAudioTrack[];
  audioTrack: number;
  loadSource(src: string): void;
  attachMedia(video: HTMLMediaElement): void;
  destroy(): void;
  on(event: string, cb: (event: string, data: unknown) => void): void;
};

type HlsEvents = {
  MANIFEST_PARSED: string;
  LEVEL_SWITCHED: string;
  AUDIO_TRACKS_UPDATED: string;
  AUDIO_TRACK_SWITCHED: string;
  ERROR: string;
};

export type HlsConstructor = {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported(): boolean;
  Events: HlsEvents;
};

export type HlsAdapterOptions = {
  /**
   * The `hls.js` export. Omit it to pick up a global `window.Hls` — the shape a
   * `<script>` tag install leaves behind.
   */
  Hls?: HlsConstructor;
  /** Passed straight to the `Hls` constructor. */
  config?: Record<string, unknown>;
  /**
   * Prefer the browser's own HLS support when it has any (Safari / iOS), where
   * native playback gets hardware decoding and AirPlay for free. Default `true`.
   */
  preferNative?: boolean;
};

const HLS_PATTERN = /\.m3u8(\?|#|$)/i;
const NATIVE_HLS_MIME = 'application/vnd.apple.mpegurl';

function resolveCtor(explicit?: HlsConstructor): HlsConstructor | null {
  if (explicit) return explicit;
  const g = globalThis as { Hls?: HlsConstructor };
  return g.Hls ?? null;
}

function levelsToQualities(levels: HlsLevel[]): QualityOption[] {
  return levels.map((l, i) => ({ label: l.name ?? heightLabel(l.height, l.bitrate), value: String(i) }));
}

function hlsAudioLabel(t: HlsAudioTrack, i: number): AudioTrackOption {
  const language = t.lang ?? t.language;
  return { label: t.name ?? language ?? `Track ${i + 1}`, ...(language ? { language } : {}) };
}

/**
 * Plays HLS through `hls.js` on browsers that need MSE, and hands the source to
 * the element untouched where HLS is native (Safari, iOS).
 *
 * ```ts
 * import Hls from 'hls.js';
 * engine.use(createHlsAdapter({ Hls }));
 * ```
 */
export function createHlsAdapter(opts: HlsAdapterOptions = {}): MediaAdapter {
  const preferNative = opts.preferNative ?? true;
  let hls: HlsInstance | null = null;
  let qualities: QualityOption[] = [];
  let audioTracks: AudioTrackOption[] = [];

  return {
    name: 'hls',

    canPlay(src) {
      if (!HLS_PATTERN.test(src)) return false;
      // Native-capable browsers still route through the adapter — `attach()`
      // simply passes the URL to the element there.
      const ctor = resolveCtor(opts.Hls);
      return (ctor?.isSupported() ?? false) || preferNative;
    },

    async attach(video, src, host: MediaAdapterHost) {
      this.detach();

      const nativeOk = preferNative && video.canPlayType(NATIVE_HLS_MIME) !== '';
      const ctor = resolveCtor(opts.Hls);

      if (nativeOk || !ctor?.isSupported()) {
        // Safari / iOS: the element decodes the manifest itself. Renditions are
        // not exposed to JS, so the quality menu stays consumer-driven.
        video.src = src;
        video.load();
        return;
      }

      const instance = new ctor({ ...opts.config });
      hls = instance;

      instance.on(ctor.Events.MANIFEST_PARSED, () => {
        qualities = levelsToQualities(instance.levels);
        host.updateQualities(qualities, instance.currentLevel, instance.autoLevelEnabled);
      });
      instance.on(ctor.Events.LEVEL_SWITCHED, () => {
        if (qualities.length === 0) qualities = levelsToQualities(instance.levels);
        host.updateQualities(qualities, instance.currentLevel, instance.autoLevelEnabled);
      });
      instance.on(ctor.Events.AUDIO_TRACKS_UPDATED, () => {
        audioTracks = instance.audioTracks.map(hlsAudioLabel);
        host.updateAudioTracks(audioTracks, instance.audioTrack);
      });
      instance.on(ctor.Events.AUDIO_TRACK_SWITCHED, () => {
        host.updateAudioTracks(audioTracks, instance.audioTrack);
      });
      instance.on(ctor.Events.ERROR, (_e, data) => {
        const d = data as { fatal?: boolean; type?: string; details?: string } | undefined;
        if (!d?.fatal) return; // hls.js recovers from non-fatal errors on its own
        const network = d.type === 'networkError';
        host.reportError({
          code: network ? 2 : 3,
          name: d.details ? `HLS_${d.details}` : 'HLS_FATAL_ERROR',
          message: network
            ? 'A network error interrupted the stream.'
            : 'The stream could not be played.',
          recoverable: true,
        });
      });

      instance.attachMedia(video);
      instance.loadSource(src);
    },

    getQualities() { return qualities; },

    setQuality(index) {
      if (!hls) return;
      hls.currentLevel = index < 0 ? AUTO_QUALITY : index;
    },

    getAudioTracks() { return audioTracks; },

    setAudioTrack(index) {
      if (!hls || index < 0) return;
      hls.audioTrack = index;
    },

    detach() {
      qualities = [];
      audioTracks = [];
      if (!hls) return;
      try { hls.destroy(); } catch { /* already torn down */ }
      hls = null;
    },
  };
}
