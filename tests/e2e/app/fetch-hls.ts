import type { HlsConstructor } from '../../../modules/videoplayer/adapters/hls.adapter';

/*
 * A stand-in for hls.js that really talks to the network: it refreshes a live
 * playlist every half second, fetches the segment it lists (resolved against the
 * address the playlist finally came from, so redirects matter), and reports
 * what happened in hls.js's own event shapes — including the response code and
 * the `Response` of a refused request. The real adapter, engine and player sit
 * on top of it; only the media pipeline is replaced (the element plays a clip).
 */

const EVENTS = {
  MANIFEST_PARSED: 'hlsManifestParsed',
  LEVEL_SWITCHED: 'hlsLevelSwitched',
  LEVEL_LOADED: 'hlsLevelLoaded',
  LEVEL_UPDATED: 'hlsLevelUpdated',
  FRAG_LOADED: 'hlsFragLoaded',
  AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
  AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
  ERROR: 'hlsError',
};

type Handler = (event: string, data: unknown) => void;

class FetchHls {
  static isSupported() { return true; }
  static Events = EVENTS;

  levels: { height: number; bitrate: number }[] = [];
  audioTracks: never[] = [];
  currentLevel = -1;
  autoLevelEnabled = true;
  audioTrack = 0;
  liveSyncPosition: number | null = null;

  private handlers = new Map<string, Handler[]>();
  private media: HTMLMediaElement | null = null;
  private url = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private destroyed = false;

  constructor(public config?: Record<string, unknown>) {}

  on(event: string, cb: Handler) { this.handlers.set(event, [...(this.handlers.get(event) ?? []), cb]); }

  private fire(event: string, data?: unknown) {
    if (this.destroyed) return;
    for (const h of this.handlers.get(event) ?? []) h(event, data);
  }

  attachMedia(video: HTMLMediaElement) {
    this.media = video;
  }

  /** Media only starts flowing once the origin has answered, as with the real thing. */
  private fillMedia() {
    const video = this.media;
    if (!video || video.getAttribute('src')) return;
    video.src = '/media/clip.wav';
    video.loop = true;
    video.load();
  }

  loadSource(url: string) {
    this.url = url;
    void this.poll();
  }

  stopLoad() {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  startLoad() {
    if (!this.stopped) return;
    this.stopped = false;
    void this.poll();
  }

  destroy() {
    this.destroyed = true;
    this.stopLoad();
    // What hls.js does when it lets go of the element.
    this.media?.removeAttribute('src');
    this.media?.load();
  }

  private async poll() {
    if (this.destroyed || this.stopped) return;
    try {
      const response = await fetch(this.url, { credentials: 'same-origin' });
      if (this.destroyed || this.stopped) return;
      if (!response.ok) {
        this.fire(EVENTS.ERROR, {
          fatal: true, type: 'networkError', details: 'levelLoadError',
          response: { code: response.status }, networkDetails: response,
        });
        return;
      }
      const text = await response.text();
      this.fillMedia();
      this.fire(EVENTS.LEVEL_LOADED, {
        details: { live: !text.includes('#EXT-X-ENDLIST'), targetduration: 2, fragments: [] },
      });
      const segment = text.split('\n').find((line) => line.endsWith('.ts'));
      if (segment) {
        const part = await fetch(new URL(segment, response.url), { credentials: 'same-origin' });
        if (!part.ok) {
          this.fire(EVENTS.ERROR, {
            fatal: true, type: 'networkError', details: 'fragLoadError',
            response: { code: part.status }, networkDetails: part,
          });
          return;
        }
        await part.arrayBuffer();
        this.fire(EVENTS.FRAG_LOADED, {});
      }
      if (!this.destroyed && !this.stopped) this.timer = setTimeout(() => void this.poll(), 500);
    } catch {
      if (this.destroyed || this.stopped) return;
      this.fire(EVENTS.ERROR, { fatal: true, type: 'networkError', details: 'levelLoadError', response: { code: 0 } });
    }
  }
}

export const FetchHlsCtor = FetchHls as unknown as HlsConstructor;
