import type { AudioTrackOption, QualityOption } from '../videoplayer.types';
import { heightLabel, type MediaAdapter, type MediaAdapterHost } from './adapter.types';

// ─── the slice of the dash.js surface we actually touch ──────────────────────

type DashBitrateInfo = { qualityIndex?: number; bitrate?: number; height?: number; width?: number };
type DashRepresentation = { index?: number; bandwidth?: number; height?: number; width?: number };
type DashTrack = { lang?: string; index?: number; labels?: { text?: string }[] };

type DashPlayer = {
  initialize(video: HTMLVideoElement, src: string, autoPlay: boolean): void;
  destroy(): void;
  on(event: string, cb: (e: unknown) => void): void;
  updateSettings(settings: Record<string, unknown>): void;
  getTracksFor(type: string): DashTrack[];
  setCurrentTrack(track: DashTrack): void;
  /** dash.js v4 */
  getBitrateInfoListFor?(type: string): DashBitrateInfo[];
  setQualityFor?(type: string, index: number): void;
  getQualityFor?(type: string): number;
  /** dash.js v5 */
  getRepresentationsByType?(type: string): DashRepresentation[];
  setRepresentationForTypeByIndex?(type: string, index: number, forceReplace?: boolean): void;
  getCurrentRepresentationForType?(type: string): DashRepresentation | null;
};

export type DashJsNs = {
  MediaPlayer: (() => { create(): DashPlayer }) & { events: Record<string, string> };
};

export type DashAdapterOptions = {
  /** The `dashjs` namespace. Omit it to pick up a global `dashjs`. */
  dashjs?: DashJsNs;
  /** Merged into `player.updateSettings()` after creation. */
  settings?: Record<string, unknown>;
};

const DASH_PATTERN = /\.mpd(\?|#|$)/i;

function resolveNs(explicit?: DashJsNs): DashJsNs | null {
  if (explicit) return explicit;
  const g = globalThis as { dashjs?: DashJsNs };
  return g.dashjs ?? null;
}

/** ABR on/off lives in the same settings path across dash.js 4 and 5. */
function autoSwitchSettings(enabled: boolean): Record<string, unknown> {
  return { streaming: { abr: { autoSwitchBitrate: { video: enabled } } } };
}

/**
 * Plays MPEG-DASH through `dash.js`. No browser ships DASH natively, so this
 * adapter is the only way `.mpd` sources play at all.
 *
 * ```ts
 * import dashjs from 'dashjs';
 * engine.use(createDashAdapter({ dashjs }));
 * ```
 */
export function createDashAdapter(opts: DashAdapterOptions = {}): MediaAdapter {
  let player: DashPlayer | null = null;
  let qualities: QualityOption[] = [];
  let audioTracks: AudioTrackOption[] = [];
  let dashTracks: DashTrack[] = [];

  function readQualities(p: DashPlayer): { list: QualityOption[]; active: number } {
    if (p.getRepresentationsByType) {
      const reps = p.getRepresentationsByType('video') ?? [];
      const active = p.getCurrentRepresentationForType?.('video')?.index ?? -1;
      return {
        list: reps.map((r, i) => ({ label: heightLabel(r.height, r.bandwidth), value: String(r.index ?? i) })),
        active,
      };
    }
    if (p.getBitrateInfoListFor) {
      const infos = p.getBitrateInfoListFor('video') ?? [];
      return {
        list: infos.map((b, i) => ({ label: heightLabel(b.height, b.bitrate), value: String(b.qualityIndex ?? i) })),
        active: p.getQualityFor?.('video') ?? -1,
      };
    }
    return { list: [], active: -1 };
  }

  return {
    name: 'dash',

    canPlay(src) {
      return DASH_PATTERN.test(src) && resolveNs(opts.dashjs) !== null;
    },

    async attach(video, src, host: MediaAdapterHost) {
      this.detach();
      const ns = resolveNs(opts.dashjs);
      if (!ns) return;

      const p = ns.MediaPlayer().create();
      player = p;
      if (opts.settings) p.updateSettings(opts.settings);

      const events = ns.MediaPlayer.events;
      const publishQualities = () => {
        const { list, active } = readQualities(p);
        qualities = list;
        host.updateQualities(list, active, true);
      };
      const publishAudio = () => {
        dashTracks = p.getTracksFor('audio') ?? [];
        audioTracks = dashTracks.map((t, i) => ({
          label: t.labels?.[0]?.text ?? t.lang ?? `Track ${i + 1}`,
          ...(t.lang ? { language: t.lang } : {}),
        }));
        host.updateAudioTracks(audioTracks, audioTracks.length > 0 ? 0 : -1);
      };

      if (events.STREAM_INITIALIZED) {
        p.on(events.STREAM_INITIALIZED, () => { publishQualities(); publishAudio(); });
      }
      if (events.QUALITY_CHANGE_RENDERED) {
        p.on(events.QUALITY_CHANGE_RENDERED, () => publishQualities());
      }
      if (events.ERROR) {
        p.on(events.ERROR, (e) => {
          const err = e as { error?: { code?: number; message?: string } } | undefined;
          host.reportError({
            code: 3,
            name: 'DASH_FATAL_ERROR',
            message: err?.error?.message ?? 'The stream could not be played.',
            recoverable: true,
          });
        });
      }

      p.initialize(video, src, !video.paused);
    },

    getQualities() { return qualities; },

    setQuality(index) {
      const p = player;
      if (!p) return;
      if (index < 0) { p.updateSettings(autoSwitchSettings(true)); return; }
      p.updateSettings(autoSwitchSettings(false));
      if (p.setRepresentationForTypeByIndex) p.setRepresentationForTypeByIndex('video', index, true);
      else p.setQualityFor?.('video', index);
    },

    getAudioTracks() { return audioTracks; },

    setAudioTrack(index) {
      const track = dashTracks[index];
      if (!player || !track) return;
      player.setCurrentTrack(track);
    },

    detach() {
      qualities = [];
      audioTracks = [];
      dashTracks = [];
      if (!player) return;
      try { player.destroy(); } catch { /* already torn down */ }
      player = null;
    },
  };
}
