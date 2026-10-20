import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useVideoPlayerEngine } from '@kuraykaraaslan/kui-player/react';
import { breakTime, dueBreaks, parseVmap, type AdBreakSpec } from '../../modules/ads/vmap.js';
import { pickMediaFile, resolveVast, type PlayableAd, type PlayableNonLinear } from '../../modules/ads/vast.js';
import { AdQuartiles, expandMacros, pingBeacon, skipCountdown } from '../../modules/ads/tracking.js';

export type AdsLabels = {
  advertisement: string;
  adOf: (index: number, total: number) => string;
  learnMore: string;
  skip: string;
  skipIn: (seconds: number) => string;
  pause: string;
  play: string;
  dismiss: string;
};

const ENGLISH: AdsLabels = {
  advertisement: 'Advertisement',
  adOf: (i, n) => `Ad ${i} of ${n}`,
  learnMore: 'Learn more',
  skip: 'Skip ad',
  skipIn: (s) => `Skip in ${s}s`,
  pause: 'Pause ad',
  play: 'Play ad',
  dismiss: 'Close ad',
};

export type AdEvent =
  | { type: 'break:start' | 'break:end'; breakId: string | null }
  | { type: 'ad:start' | 'ad:complete' | 'ad:skip' | 'ad:click'; adId: string | null }
  | { type: 'nonlinear:start' | 'nonlinear:click'; adId: string | null }
  | { type: 'nonlinear:end'; adId: string | null; reason: 'dismiss' | 'timeout' | 'replaced' }
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

type Banner = { ad: PlayableNonLinear; done: () => void };
type Resolved = { ads: PlayableAd[]; nonLinear: PlayableNonLinear[] };

const DEFAULT_NONLINEAR_SECONDS = 10;
/** A non-linear break the playhead is further past than this (a seek) is skipped, not shown late. */
const NONLINEAR_STALE_SECONDS = 5;

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
  const [banner, setBanner] = useState<Banner | null>(null);
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
    const cache = new Map<string, Promise<Resolved>>();
    let busy = false;
    let bannerOpen = false;
    let disposed = false;

    const keyOf = (spec: AdBreakSpec) => spec.id ?? `#${schedule.indexOf(spec)}`;

    const resolveBreak = (spec: AdBreakSpec): Promise<Resolved> => {
      const key = keyOf(spec);
      let pending = cache.get(key);
      if (!pending) {
        pending = withTimeout(resolveVast(spec.source ?? '', (u) => withTimeout(load(u)), { maxDepth: live.current.maxWrapperDepth }))
          .then((r) => ({ ads: r.ads, nonLinear: r.nonLinear }))
          .catch(() => ({ ads: [], nonLinear: [] }));
        cache.set(key, pending);
      }
      return pending;
    };

    // Non-linear breaks that came due but have not been shown yet (a banner is up, or a linear break runs).
    const queue: AdBreakSpec[] = [];
    let inflight: AdBreakSpec | null = null;
    let shown: { adId: string | null } | null = null;
    /** Bumped whenever a pending banner resolve must be abandoned (a linear break took over). */
    let gen = 0;

    const pump = async (): Promise<void> => {
      if (busy || bannerOpen || disposed) return;
      const spec = queue.shift();
      if (!spec) return;
      bannerOpen = true;
      inflight = spec;
      gen += 1;
      const mine = gen;
      const { nonLinear } = await resolveBreak(spec);
      if (disposed || mine !== gen) return;
      inflight = null;
      const ad = nonLinear[0];
      if (!ad) { bannerOpen = false; void pump(); return; }
      shown = { adId: ad.id };
      setBanner({
        ad,
        done: () => {
          if (mine !== gen) return;
          shown = null; bannerOpen = false; setBanner(null);
          void pump();
        },
      });
    };

    const runBreak = async (spec: AdBreakSpec, resume: boolean) => {
      busy = true;
      // A linear break takes over: abandon a banner that is still resolving (it goes back in the queue) or showing.
      gen += 1;
      if (inflight) { queue.unshift(inflight); inflight = null; }
      if (shown) { emit({ type: 'nonlinear:end', adId: shown.adId, reason: 'replaced' }); shown = null; }
      bannerOpen = false;
      setBanner(null);
      played.add(keyOf(spec));
      engine.pause();
      emit({ type: 'break:start', breakId: spec.id });
      const { ads } = await resolveBreak(spec);
      for (let i = 0; i < ads.length && !disposed; i += 1) {
        const ad = ads[i]!;
        await new Promise<void>((resolve) => {
          setRunning({ ad, index: i, total: ads.length, done: () => { setRunning(null); resolve(); } });
        });
      }
      emit({ type: 'break:end', breakId: spec.id });
      busy = false;
      if (resume && !disposed) engine.play();
      void pump();
    };

    /** Several breaks due at once (a seek past two): play the latest, mark the rest as seen. */
    const runDue = (position: number, duration: number, resume: boolean) => {
      if (busy) return;
      const due = dueBreaks(schedule, position, duration, played);
      if (due.length === 0) return;
      due.slice(0, -1).forEach((s) => played.add(keyOf(s)));
      void runBreak(due[due.length - 1]!, resume);
    };

    /** Overlay ads never pause the content: they only need the playhead to have reached them. */
    const runNonLinear = (position: number, duration: number) => {
      const due = dueBreaks(schedule, position, duration, played, 'nonlinear');
      if (due.length === 0) return;
      due.forEach((s) => played.add(keyOf(s)));
      const spec = due[due.length - 1]!;
      const at = breakTime(spec.offset, duration);
      // A seek far past the break: skip it rather than show it late.
      if (spec.offset.kind !== 'start' && at !== null && position - at > NONLINEAR_STALE_SECONDS) return;
      queue.push(spec);
      void pump();
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
        runNonLinear(currentTime, engine.store.getState().duration);
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
      runNonLinear(state.currentTime, state.duration);
      runDue(state.currentTime, state.duration, true);
    });

    return () => { disposed = true; offs.forEach((off) => off()); unsubscribe(); };
  }, [engine]);

  if (!running) {
    return banner ? (
      <NonLinearBanner
        key={`${banner.ad.id ?? ''}-${banner.ad.item.imageUrl}`}
        banner={banner}
        labels={labels}
        ping={props.ping ?? pingBeacon}
        emit={(event) => props.onEvent?.(event)}
      />
    ) : null;
  }
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

const bannerWrap: CSSProperties = { position: 'absolute', insetInline: 0, insetBlockEnd: '4rem', zIndex: 39, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 0.5rem' };
const bannerBox: CSSProperties = { position: 'relative', display: 'inline-block', maxWidth: '100%', pointerEvents: 'auto', lineHeight: 0 };
const bannerClose: CSSProperties = { position: 'absolute', insetBlockStart: 2, insetInlineEnd: 2, width: 22, height: 22, padding: 0, border: '1px solid rgba(255,255,255,.5)', borderRadius: '50%', background: 'rgba(0,0,0,.7)', color: '#fff', font: 'inherit', fontSize: 14, lineHeight: '20px', cursor: 'pointer' };

/**
 * A VAST non-linear overlay: an image over the lower part of the video. The content keeps
 * playing. It goes away after `minSuggestedDuration` (default 10 s) or when dismissed.
 */
function NonLinearBanner({ banner, labels, ping, emit }: Readonly<{
  banner: Banner; labels: AdsLabels; ping: (url: string) => void; emit: (event: AdEvent) => void;
}>) {
  const { ad, done } = banner;
  const { item } = ad;
  const live = useRef({ ping, emit, done });
  useEffect(() => { live.current = { ping, emit, done }; });
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      [...ad.impressions, ...(ad.tracking.creativeView ?? [])].forEach((u) => live.current.ping(expandMacros(u, { assetUri: item.imageUrl })));
      live.current.emit({ type: 'nonlinear:start', adId: ad.id });
    }
    const id = setTimeout(() => {
      live.current.emit({ type: 'nonlinear:end', adId: ad.id, reason: 'timeout' });
      live.current.done();
    }, (item.minSuggestedDuration ?? DEFAULT_NONLINEAR_SECONDS) * 1000);
    return () => clearTimeout(id);
  }, [ad, item]);

  const image = (
    <img
      src={item.imageUrl}
      alt={item.clickThrough ? labels.advertisement : ''}
      referrerPolicy="no-referrer"
      width={item.width || undefined}
      height={item.height || undefined}
      style={{ display: 'block', maxWidth: '100%', maxHeight: '25vh', height: 'auto', width: item.width ? `min(${item.width}px, 100%)` : undefined }}
    />
  );

  return (
    <aside
      style={bannerWrap}
      aria-label={labels.advertisement}
      onKeyDown={(e) => { if (e.key === 'Escape') { emit({ type: 'nonlinear:end', adId: ad.id, reason: 'dismiss' }); done(); } }}
    >
      <div style={bannerBox}>
        {item.clickThrough ? (
          <a
            href={item.clickThrough}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              item.clickTracking.forEach((u) => ping(expandMacros(u, { assetUri: item.imageUrl })));
              emit({ type: 'nonlinear:click', adId: ad.id });
            }}
          >
            {image}
          </a>
        ) : image}
        <button
          type="button"
          style={bannerClose}
          aria-label={labels.dismiss}
          onClick={() => { emit({ type: 'nonlinear:end', adId: ad.id, reason: 'dismiss' }); done(); }}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </aside>
  );
}
