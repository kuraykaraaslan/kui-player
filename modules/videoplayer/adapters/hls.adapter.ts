import type { AudioTrackOption, QualityOption } from '../videoplayer.types.js';
import type { DrmOptions } from './drm.js';
import { audioKind } from '../videoplayer.audiokind.js';
import { extractAdBreaks, mergeAdBreaks, type AdBreak, type TaggedFragment } from '../videoplayer.adbreaks.js';
import { AUTO_QUALITY, heightLabel, type MediaAdapter, type MediaAdapterHost } from './adapter.types.js';
import { resolveLive } from '../videoplayer.live.js';
import { LiveRecovery, readRefusal } from './hls.live.js';

// ─── the slice of the hls.js surface we actually touch ───────────────────────

type HlsLevel = { height?: number; width?: number; bitrate?: number; name?: string; videoCodec?: string };
type HlsAudioTrack = { name?: string; lang?: string; language?: string; characteristics?: string };

type HlsInstance = {
  levels: HlsLevel[];
  currentLevel: number;
  autoLevelEnabled: boolean;
  audioTracks: HlsAudioTrack[];
  audioTrack: number;
  bandwidthEstimate?: number;
  loadSource(src: string): void;
  attachMedia(video: HTMLMediaElement): void;
  destroy(): void;
  stopLoad?(): void;
  startLoad?(startPosition?: number): void;
  /** Where hls.js would start (or rejoin) a live stream, in media time. */
  liveSyncPosition?: number | null;
  /** The latency it aims for behind the live edge, seconds. */
  targetLatency?: number | null;
  on(event: string, cb: (event: string, data: unknown) => void): void;
};

type HlsLevelDetails = {
  live?: boolean;
  targetduration?: number;
  fragments?: HlsFragment[];
};
type HlsErrorData = {
  fatal?: boolean; type?: string; details?: string;
  response?: { code?: number };
  /** The `XMLHttpRequest` (or fetch `Response`) behind a failed load. */
  networkDetails?: unknown;
};

type HlsFragment = { start: number; duration?: number; programDateTime?: number | null; tagList?: string[][] };
const toTagged = (f: HlsFragment): TaggedFragment => ({
  start: f.start, duration: f.duration, programDateTime: f.programDateTime, tagList: f.tagList,
});

type HlsEvents = {
  MANIFEST_PARSED: string;
  LEVEL_SWITCHED: string;
  AUDIO_TRACKS_UPDATED: string;
  AUDIO_TRACK_SWITCHED: string;
  ERROR: string;
  LEVEL_LOADED?: string;
  LEVEL_UPDATED?: string;
  FRAG_LOADED?: string;
  FRAG_PARSING_METADATA?: string;
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
  /** Passed straight to the `Hls` constructor; wins over `lowLatency` where they overlap. */
  config?: Record<string, unknown>;
  /**
   * Low-latency HLS tuning for live streams (hls.js only — native Safari
   * playback manages its own latency). `true` uses the defaults below.
   * The source must publish partial segments (`EXT-X-PART`) to benefit.
   */
  lowLatency?: boolean | LowLatencyOptions;
  /**
   * Widevine / PlayReady license settings for protected (CMAF `cbcs`) streams.
   * Needs hls.js; Safari and iOS (FairPlay) are not supported and get a clear
   * error. The DRM code loads only when this is set.
   */
  drm?: DrmOptions;
  /**
   * Prefer the browser's own HLS support when it has any (Safari / iOS), where
   * native playback gets hardware decoding and AirPlay for free. Default `true`.
   */
  preferNative?: boolean;
};

export type LowLatencyOptions = {
  /** Target distance from the live edge, in seconds (default 3). */
  liveSyncDuration?: number;
  /** Beyond this the player catches up by speeding up, in seconds (default 6). */
  liveMaxLatencyDuration?: number;
  /**
   * Playback rate used while catching up (default 1.1, i.e. 10 % faster —
   * barely audible). `1` turns catch-up off.
   */
  catchUpRate?: number;
};

/** The hls.js settings a `lowLatency` option stands for; `{}` when it is off. */
export function lowLatencyConfig(option: boolean | LowLatencyOptions | undefined): Record<string, unknown> {
  if (!option) return {};
  const o = option === true ? {} : option;
  const liveSyncDuration = o.liveSyncDuration ?? 3;
  // hls.js requires the max latency to exceed the sync target; keep it sane.
  const liveMaxLatencyDuration = Math.max(o.liveMaxLatencyDuration ?? 6, liveSyncDuration + 1);
  return {
    lowLatencyMode: true,
    liveSyncDuration,
    liveMaxLatencyDuration,
    maxLiveSyncPlaybackRate: Math.max(1, Math.min(o.catchUpRate ?? 1.1, 2)),
  };
}

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
  const kind = audioKind({ characteristics: t.characteristics });
  return {
    label: t.name ?? language ?? `Track ${i + 1}`,
    ...(language ? { language } : {}),
    ...(kind !== 'main' ? { kind } : {}),
  };
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
  let stopNativeMeta: (() => void) | null = null;
  // Ad breaks come from two places on the hls.js path (playlist tags, in-band
  // ID3); both are republished together because the host takes one list.
  let playlistBreaks: AdBreak[] = [];
  let inBand: import('../videoplayer.timedmeta.js').MetadataBreaks | null = null;
  // Bumped by every attach and detach: an attach that resumes after an await
  // and finds a different value was superseded and must not touch anything.
  let generation = 0;
  // Live recovery and suspension (see hls.live.ts). `native` is the element when
  // the browser plays HLS itself, where there is no hls.js to stop.
  let recovery: LiveRecovery | null = null;
  let nativeVideo: HTMLVideoElement | null = null;
  let nativeSrc = '';
  let suspended = false;
  let reloadOnResume = false;
  let edgeSeekPending = false;
  /** Reopens the source right now; set while attached to an hls.js stream. */
  let reopenNow: (() => void) | null = null;

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
      const token = ++generation;
      const live = host.live ?? resolveLive(undefined);

      const ctor = resolveCtor(opts.Hls);
      let drmModule: typeof import('./drm.js') | null = null;

      if (opts.drm) {
        // The native path cannot do Widevine/PlayReady and would stall on
        // encrypted segments without a word — so protected content either goes
        // through hls.js's EME support or fails here, loudly.
        drmModule = await import('./drm.js');
        if (token !== generation) return;
        if (!ctor?.isSupported()) {
          host.reportError(drmModule.drmError(
            'DRM_UNSUPPORTED', 'This browser cannot play protected video here (no Media Source Extensions).', false));
          return;
        }
        const unsupported = await drmModule.probeKeySystems(opts.drm);
        if (token !== generation) return;
        if (unsupported) { host.reportError(unsupported); return; }
      }

      // In-band metadata parsing is optional and only needed once a stream is
      // playing, so it stays out of the core chunk and loads alongside the
      // source without delaying it. A failed load just means no in-band markers.
      const metaReady: Promise<typeof import('../videoplayer.timedmeta.js') | null> =
        import('../videoplayer.timedmeta.js').catch(() => null);
      const nativeOk = !opts.drm && preferNative && video.canPlayType(NATIVE_HLS_MIME) !== '';

      if (nativeOk || !ctor?.isSupported()) {
        // Safari / iOS: the element decodes the manifest itself. Renditions are
        // not exposed to JS, so the quality menu stays consumer-driven.
        // Ad markers still arrive as `metadata` text-track cues.
        nativeVideo = video;
        nativeSrc = src;
        video.src = src;
        video.load();
        void metaReady.then((timedMeta) => {
          if (!timedMeta || token !== generation) return;
          stopNativeMeta = timedMeta.watchNativeMetadata(video, (breaks) => host.updateAdBreaks(breaks));
        });
        return;
      }

      let bandBreaks: import('../videoplayer.timedmeta.js').MetadataBreaks | null = null;
      // Samples that arrive before the metadata chunk has loaded.
      let pending: { pts?: number; data?: Uint8Array }[] = [];
      // True once a playlist without an end has been seen: only then is a refused
      // or vanished source worth reopening rather than reporting.
      let sawLive = false;
      let refusal: Promise<string | undefined> = Promise.resolve(undefined);

      const publishBreaks = () => host.updateAdBreaks(mergeAdBreaks(playlistBreaks, bandBreaks?.breaks ?? []));
      const feed = (samples: { pts?: number; data?: Uint8Array }[]): boolean => {
        let changed = false;
        for (const sample of samples) {
          if (bandBreaks && typeof sample?.pts === 'number' && bandBreaks.addId3(sample.data, sample.pts)) changed = true;
        }
        return changed;
      };
      void metaReady.then((timedMeta) => {
        if (!timedMeta || token !== generation) { pending = []; return; }
        bandBreaks = new timedMeta.MetadataBreaks();
        inBand = bandBreaks;
        const queued = pending;
        pending = [];
        if (feed(queued)) publishBreaks();
      });

      const config = () => ({
        // Without this a live stream reports a finite, growing duration and
        // looks like a very long video to everything that reads the element.
        liveDurationInfinity: true,
        // A page that says the source is live gets small-tile defaults: stay on
        // the first variant and climb only as far as the player is large.
        ...(live.hinted ? { startLevel: 0, capLevelToPlayerSize: true } : {}),
        ...(live.credentials === 'include'
          ? { xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = true; } }
          : {}),
        ...lowLatencyConfig(opts.lowLatency),
        ...(opts.drm && drmModule ? drmModule.buildDrmConfig(opts.drm) : {}),
        ...opts.config,
      });

      const start = () => {
        const instance = new ctor(config());
        hls = instance;
        const E = ctor.Events;

        instance.on(E.MANIFEST_PARSED, () => {
          qualities = levelsToQualities(instance.levels);
          host.updateQualities(qualities, instance.currentLevel, instance.autoLevelEnabled);
        });
        instance.on(E.LEVEL_SWITCHED, (_e, data) => {
          const index = (data as { level?: number } | undefined)?.level ?? instance.currentLevel;
          const level = instance.levels[index];
          host.updateRendition(level
            ? { bitrate: level.bitrate, width: level.width, height: level.height, codec: level.videoCodec }
            : null);
          if (qualities.length === 0) qualities = levelsToQualities(instance.levels);
          host.updateQualities(qualities, instance.currentLevel, instance.autoLevelEnabled);
        });
        // Playlist (re)loads carry the SSAI markers (rescanning is cheap and
        // idempotent) and tell whether the stream has an end.
        const onLevel = (_e: string, data: unknown) => {
          const details = (data as { details?: HlsLevelDetails } | undefined)?.details;
          if (!details) return;
          if (details.fragments) {
            playlistBreaks = extractAdBreaks(details.fragments.map(toTagged));
            publishBreaks();
          }
          if (typeof details.live !== 'boolean') return;
          sawLive = details.live;
          // HLS plays a few segments behind the edge by design; that is "live".
          const tolerance = Math.max(10, (instance.targetLatency ?? 0) + (details.targetduration ?? 0));
          host.updateLive?.(details.live, details.live ? tolerance : undefined);
          if (edgeSeekPending && details.live) {
            edgeSeekPending = false;
            const edge = instance.liveSyncPosition;
            if (typeof edge === 'number' && Number.isFinite(edge)) video.currentTime = edge;
          }
        };
        // ID3 timed metadata (`PRIV`/`TXXX`) parsed out of segments. Malformed tags are ignored.
        if (E.FRAG_PARSING_METADATA) {
          instance.on(E.FRAG_PARSING_METADATA, (_e, data) => {
            try {
              const samples = (data as { samples?: { pts?: number; data?: Uint8Array }[] } | undefined)?.samples;
              if (!Array.isArray(samples)) return;
              if (!bandBreaks) {
                if (pending.length < 64) pending.push(...samples.slice(0, 64 - pending.length));
                return;
              }
              if (feed(samples)) publishBreaks();
            } catch { /* a bad sample must not stop playback */ }
          });
        }
        if (E.LEVEL_LOADED) instance.on(E.LEVEL_LOADED, onLevel);
        if (E.LEVEL_UPDATED) instance.on(E.LEVEL_UPDATED, onLevel);
        // A segment arriving means the (re)connection worked.
        if (E.FRAG_LOADED) {
          instance.on(E.FRAG_LOADED, () => {
            if (recovery?.recovered()) host.updateRecovery?.({ reconnecting: false });
          });
        }
        instance.on(E.AUDIO_TRACKS_UPDATED, () => {
          audioTracks = instance.audioTracks.map(hlsAudioLabel);
          host.updateAudioTracks(audioTracks, instance.audioTrack);
        });
        instance.on(E.AUDIO_TRACK_SWITCHED, () => {
          host.updateAudioTracks(audioTracks, instance.audioTrack);
        });
        instance.on(E.ERROR, (_e, data) => {
          const d = data as HlsErrorData | undefined;
          if (!d?.fatal) return; // hls.js recovers from non-fatal errors on its own
          const drmError = drmModule?.mapDrmError(d);
          if (drmError) { host.reportError(drmError); return; }
          const network = d.type === 'networkError';
          const code = d.response?.code;
          const refused = code === 401 || code === 403 || code === 404;

          // A live stream that was running and now is refused or unreachable:
          // open the original address again instead of showing an error.
          if (recovery && sawLive && (refused || network)) {
            if (refused) refusal = readRefusal(d.networkDetails);
            if (!recovery.recovering) {
              host.updateRecovery?.({ reconnecting: true, attempt: 1, reason: refused ? 'auth' : 'network' });
            }
            recovery.fail(refused ? 'auth' : 'network');
            return;
          }

          const report = (detail?: string) => {
            if (token !== generation) return;
            host.reportError({
              code: network ? 2 : 3,
              name: d.details ? `HLS_${d.details}` : 'HLS_FATAL_ERROR',
              message: network
                ? 'A network error interrupted the stream.'
                : 'The stream could not be played.',
              recoverable: true,
              ...(detail ? { detail } : {}),
            });
          };
          if (refused) void readRefusal(d.networkDetails).then(report); else report();
        });

        instance.attachMedia(video);
        instance.loadSource(src);
      };

      const destroyInstance = () => {
        if (!hls) return;
        try { hls.destroy(); } catch { /* already torn down */ }
        hls = null;
      };

      const reopen = (kind: 'auth' | 'network', attempt: number) => {
        host.updateRecovery?.({ reconnecting: true, attempt, reason: kind });
        destroyInstance();
        playlistBreaks = [];
        inBand?.clear();
        start();
      };
      reopenNow = () => reopen('network', 1);

      if (live.reauth) {
        recovery = new LiveRecovery(live.reauth, {
          reload: (kind, attempt) => {
            if (token !== generation) return;
            // Nothing is requested for a player nobody can see; reopen on return.
            if (suspended) { reloadOnResume = true; return; }
            reopen(kind, attempt);
          },
          giveUp: (kind) => {
            if (token !== generation) return;
            host.updateRecovery?.({ reconnecting: false });
            void refusal.then((detail) => {
              if (token !== generation) return;
              host.reportError({
                code: 2,
                name: kind === 'auth' ? 'LIVE_REFUSED' : 'LIVE_UNAVAILABLE',
                message: kind === 'auth'
                  ? 'The live stream refused the connection.'
                  : 'The live stream is not reachable right now.',
                recoverable: true,
                ...(detail ? { detail } : {}),
              });
            });
          },
        });
      }

      start();
    },

    getQualities() { return qualities; },

    getBandwidth() { return hls?.bandwidthEstimate; },

    setQuality(index) {
      if (!hls) return;
      hls.currentLevel = index < 0 ? AUTO_QUALITY : index;
    },

    getAudioTracks() { return audioTracks; },

    setAudioTrack(index) {
      if (!hls || index < 0) return;
      hls.audioTrack = index;
    },

    suspend() {
      suspended = true;
      if (nativeVideo) {
        // The element owns the pipeline: dropping the source is the only way to
        // make it stop requesting.
        nativeVideo.removeAttribute('src');
        nativeVideo.load();
        return;
      }
      hls?.stopLoad?.();
    },

    resume() {
      if (!suspended) return;
      suspended = false;
      if (nativeVideo) {
        nativeVideo.src = nativeSrc;
        nativeVideo.load();
        return;
      }
      if (reloadOnResume) {
        reloadOnResume = false;
        reopenNow?.();
        return;
      }
      edgeSeekPending = true;
      hls?.startLoad?.(-1);
    },

    getLiveEdge() {
      const edge = hls?.liveSyncPosition;
      return typeof edge === 'number' && Number.isFinite(edge) ? edge : null;
    },

    detach() {
      generation++;
      recovery?.dispose();
      recovery = null;
      reopenNow = null;
      suspended = false;
      reloadOnResume = false;
      edgeSeekPending = false;
      nativeVideo = null;
      nativeSrc = '';
      stopNativeMeta?.();
      stopNativeMeta = null;
      playlistBreaks = [];
      inBand?.clear();
      inBand = null;
      qualities = [];
      audioTracks = [];
      if (!hls) return;
      try { hls.destroy(); } catch { /* already torn down */ }
      hls = null;
    },
  };
}
