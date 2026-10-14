import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useVideoPlayerEngine } from '@kuraykaraaslan/kui-player/react';
import { dueBreaks, parseVmap, type AdBreakSpec } from '../../modules/ads/vmap.js';
import { pickMediaFile, resolveVast, type PlayableAd } from '../../modules/ads/vast.js';
import { AdQuartiles, expandMacros, pingBeacon, skipCountdown } from '../../modules/ads/tracking.js';

export type AdsLabels = {
  advertisement: string;
  adOf: (index: number, total: number) => string;
  learnMore: string;
  skip: string;
  skipIn: (seconds: number) => string;
  pause: string;
  play: string;
};

const ENGLISH: AdsLabels = {
  advertisement: 'Advertisement',
  adOf: (i, n) => `Ad ${i} of ${n}`,
  learnMore: 'Learn more',
  skip: 'Skip ad',
  skipIn: (s) => `Skip in ${s}s`,
  pause: 'Pause ad',
  play: 'Play ad',
};

export type AdEvent =
  | { type: 'break:start' | 'break:end'; breakId: string | null }
  | { type: 'ad:start' | 'ad:complete' | 'ad:skip' | 'ad:click'; adId: string | null }
  | { type: 'ad:error'; adId: string | null; code: number; message: string };

export type AdsOverlayProps = {
  /** A VAST tag URL, or inline VAST XML: one pre-roll. */
  tag?: string;
  /** A VMAP URL or inline VMAP XML: the full schedule. Wins over `tag`. */
  vmap?: string;
  /** How to fetch an ad document. Default: `fetch` with no cookies. */
  load?: (url: string) => Promise<string>;
  /** Send cookies with ad requests (many ad servers want them; off by default). */
  credentials?: RequestCredentials;
  /** How long to wait for an ad tag before carrying on with the content (default 8000 ms). */
  timeoutMs?: number;
  maxWrapperDepth?: number;
  /** Replace the English texts (translate them, or reword them). */
  labels?: Partial<AdsLabels>;
  onEvent?: (event: AdEvent) => void;
  /** Where beacons go (default: an image request). Replace it to route or inspect them. */
  ping?: (url: string) => void;
};

type Running = { ad: PlayableAd; index: number; total: number; done: (result: 'complete' | 'skip' | 'error') => void };

const overlay: CSSProperties = { position: 'absolute', inset: 0, zIndex: 40, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const bar: CSSProperties = { position: 'absolute', insetInline: 0, insetBlockStart: 0, display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'linear-gradient(rgba(0,0,0,.7), transparent)', color: '#fff', fontSize: '0.8125rem' };
const button: CSSProperties = { padding: '0.3rem 0.7rem', border: '1px solid rgba(255,255,255,.35)', borderRadius: 6, background: 'rgba(0,0,0,.6)', color: '#fff', font: 'inherit', cursor: 'pointer' };

const WATCHDOG_MS = 8000;

/**
 * Ad breaks for `<VideoPlayer>`, from a VAST tag or a VMAP schedule — no ad SDK,
 * no telemetry of its own. Put it in a slot:
 *
 * ```tsx
 * <VideoPlayer src={src} slots={{ top: <AdsOverlay vmap="https://ads.example.com/vmap.xml" /> }} />
 * ```
 *
 * The only network requests it makes are to the URLs your ad tag leads to.
 * It lives in its own entry point, so players without ads never load a byte of it.
 */
export function AdsOverlay(props: AdsOverlayProps) {
  const engine = useVideoPlayerEngine();
  const [running, setRunning] = useState<Running | null>(null);
  const labels = useMemo<AdsLabels>(() => ({ ...ENGLISH, ...props.labels }), [props.labels]);
  const live = useRef(props);
  useEffect(() => { live.current = props; });

  useEffect(() => {
    const load = (url: string) => live.current.load?.(url)
      ?? fetch(url, { credentials: live.current.credentials ?? 'omit' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))));
    const withTimeout = <T,>(p: Promise<T>) => new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('ad request timed out')), live.current.timeoutMs ?? 8000);
      p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
    });
    const emit = (event: AdEvent) => live.current.onEvent?.(event);

    let schedule: AdBreakSpec[] = [];
    const played = new Set<string>();
    const cache = new Map<string, Promise<PlayableAd[]>>();
    let busy = false;
    let disposed = false;

    const keyOf = (spec: AdBreakSpec) => spec.id ?? `#${schedule.indexOf(spec)}`;

    const resolveBreak = (spec: AdBreakSpec): Promise<PlayableAd[]> => {
      const key = keyOf(spec);
      let pending = cache.get(key);
      if (!pending) {
        pending = withTimeout(resolveVast(spec.source ?? '', (u) => withTimeout(load(u)), { maxDepth: live.current.maxWrapperDepth }))
          .then((r) => r.ads)
          .catch(() => []);
        cache.set(key, pending);
      }
      return pending;
    };

    const runBreak = async (spec: AdBreakSpec, resume: boolean) => {
      busy = true;
      played.add(keyOf(spec));
      engine.pause();
      emit({ type: 'break:start', breakId: spec.id });
      const ads = await resolveBreak(spec);
      for (let i = 0; i < ads.length && !disposed; i += 1) {
        const ad = ads[i]!;
        await new Promise<void>((resolve) => {
          setRunning({ ad, index: i, total: ads.length, done: () => { setRunning(null); resolve(); } });
        });
      }
      emit({ type: 'break:end', breakId: spec.id });
      busy = false;
      if (resume && !disposed) engine.play();
    };

    /** Several breaks due at once (a seek past two): play the latest, mark the rest as seen. */
    const runDue = (position: number, duration: number, resume: boolean) => {
      if (busy) return;
      const due = dueBreaks(schedule, position, duration, played);
      if (due.length === 0) return;
      due.slice(0, -1).forEach((s) => played.add(keyOf(s)));
      void runBreak(due[due.length - 1]!, resume);
    };

    const start = async () => {
      const source = live.current.vmap ?? null;
      if (source) {
        try { schedule = parseVmap(source.trimStart().startsWith('<') ? source : await withTimeout(load(source))); } catch { schedule = []; }
      } else if (live.current.tag) {
        schedule = [{ id: 'tag', type: 'linear', offset: { kind: 'start' }, source: live.current.tag }];
      }
      // Warm the pre-roll so the first play does not wait on the ad server.
      const pre = schedule.find((s) => s.offset.kind === 'start');
      if (pre) void resolveBreak(pre);
    };
    void start();

    const offs = [
      // The viewer's first play is when a pre-roll goes; hold the content until it is done.
      engine.on('play', ({ currentTime }) => {
        if (busy) { engine.pause(); return; }
        runDue(currentTime, engine.store.getState().duration, true);
      }),
      engine.on('complete', () => {
        const { duration } = engine.store.getState();
        const end = schedule.filter((s) => s.offset.kind === 'end' && !played.has(keyOf(s)));
        if (end[0] && !busy) void runBreak(end[0], false);
        void duration;
      }),
    ];
    const unsubscribe = engine.store.subscribe((state, previous) => {
      if (state.currentTime === previous.currentTime || !state.playing || state.seeking) return;
      runDue(state.currentTime, state.duration, true);
    });

    return () => { disposed = true; offs.forEach((off) => off()); unsubscribe(); };
  }, [engine]);

  if (!running) return null;
  return (
    <AdPlayer
      key={`${running.ad.id ?? ''}-${running.index}`}
      running={running}
      labels={labels}
      ping={props.ping ?? pingBeacon}
      emit={(event) => props.onEvent?.(event)}
    />
  );
}

function AdPlayer({ running, labels, ping, emit }: Readonly<{
  running: Running; labels: AdsLabels; ping: (url: string) => void; emit: (event: AdEvent) => void;
}>) {
  const { ad, index, total, done } = running;
  const videoRef = useRef<HTMLVideoElement>(null);
  const quartiles = useRef(new AdQuartiles());
  const impressed = useRef(false);
  const finished = useRef(false);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const file = useMemo(() => {
    const probe = typeof document === 'undefined' ? null : document.createElement('video');
    return pickMediaFile(ad.creative.mediaFiles, (mime) => (probe ? probe.canPlayType(mime) !== '' : false));
  }, [ad]);

  const fire = (urls: readonly string[] | undefined, extra: { errorCode?: number } = {}) => {
    const video = videoRef.current;
    urls?.forEach((u) => ping(expandMacros(u, { ...extra, playhead: video?.currentTime ?? 0, assetUri: file?.url })));
  };
  const track = (event: string) => fire(ad.creative.tracking[event]);

  const finish = (result: 'complete' | 'skip' | 'error', code = 0, message = '') => {
    if (finished.current) return;
    finished.current = true;
    if (result === 'complete') { track('complete'); emit({ type: 'ad:complete', adId: ad.id }); }
    if (result === 'skip') { track('skip'); emit({ type: 'ad:skip', adId: ad.id }); }
    if (result === 'error') {
      fire(ad.errors, { errorCode: code });
      emit({ type: 'ad:error', adId: ad.id, code, message });
    }
    done(result);
  };
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });

  useEffect(() => {
    const video = videoRef.current;
    if (!file || !video) { finishRef.current('error', 403, 'no playable media file'); return; }
    // If it never starts (blocked, stalled, bad file) the viewer must not be left staring at black.
    const watchdog = setTimeout(() => { if (!impressed.current) finishRef.current('error', 402, 'the ad did not start in time'); }, WATCHDOG_MS);
    video.src = file.url;
    void video.play().catch(() => {
      // Autoplay with sound refused: try again muted before giving up.
      video.muted = true;
      void video.play().catch(() => finishRef.current('error', 400, 'the ad could not play'));
    });
    return () => clearTimeout(watchdog);
  }, [file]);

  const skipIn = skipCountdown(ad.creative.skipOffset, time);

  return (
    <div style={overlay} role="region" aria-label={labels.advertisement}>
      <video
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onPlaying={() => {
          setPaused(false);
          if (!impressed.current) {
            impressed.current = true;
            fire(ad.impressions);
            emit({ type: 'ad:start', adId: ad.id });
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          quartiles.current.update(v.currentTime, v.duration || ad.creative.duration).forEach(track);
        }}
        onPause={() => { if (!finished.current) { setPaused(true); track('pause'); } }}
        onEnded={() => finish('complete')}
        onError={() => finish('error', 405, 'the ad file failed to load')}
        onVolumeChange={(e) => track(e.currentTarget.muted ? 'mute' : 'unmute')}
      />
      <div style={bar}>
        <span role="status">{labels.adOf(index + 1, total)}{ad.creative.duration > 0 ? ` · ${Math.max(0, Math.ceil(ad.creative.duration - time))}s` : ''}</span>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={button}
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) { void v.play(); track('resume'); } else v.pause();
          }}
        >
          {paused ? labels.play : labels.pause}
        </button>
        {ad.creative.clickThrough && (
          <button
            type="button"
            style={button}
            onClick={() => {
              fire(ad.creative.tracking.clickTracking);
              emit({ type: 'ad:click', adId: ad.id });
              videoRef.current?.pause();
              window.open(ad.creative.clickThrough!, '_blank', 'noopener,noreferrer');
            }}
          >
            {labels.learnMore}
          </button>
        )}
        {skipIn !== null && (
          skipIn === 0
            ? <button type="button" style={button} onClick={() => finish('skip')}>{labels.skip}</button>
            : <span aria-live="off" style={{ opacity: 0.8 }}>{labels.skipIn(skipIn)}</span>
        )}
      </div>
    </div>
  );
}
