"use client";

import {
  Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine.js';
import { VideoPlayerEngineContext } from './VideoPlayerEngineContext.js';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine.js';
import { VideoPlayerChrome } from './VideoPlayerChrome.js';
import { IconProvider, type IconOverrides } from './icons/index.js';
import { I18nProvider, resolveDictionary, type PartialDictionary } from './i18n/index.js';
import { detectFormat } from '../modules/videoplayer/videoplayer.subtitles.js';
import type { LearningOptions } from './parts/LearningPanel.js';
import type { OfflineOptions } from './parts/OfflineController.js';
import type { FrameToolsOptions } from './parts/FrameTools.js';
import type { SignLanguageOptions } from './parts/SignLanguageVideo.js';
import type { MiniOptions } from '../modules/videoplayer/videoplayer.mini.js';
import type { SkipOptions } from './parts/SkipController.js';
import type { WatermarkOptions } from '../modules/videoplayer/videoplayer.watermark.js';
import type { ShortcutOverrides } from '../modules/videoplayer/videoplayer.shortcuts.js';
import { readUrlTime } from '../modules/videoplayer/videoplayer.share.js';
import type { ShareOptions } from './parts/ShareController.js';
import type { PersistOptions } from '../modules/videoplayer/videoplayer.persist.js';
import type { PlayerSlots } from '../modules/videoplayer/videoplayer.types.js';
import { usePresenceGroup } from './PresenceGroupContext.js';
import { isPresenceGroup, type PresenceGroup } from '../modules/videoplayer/videoplayer.presence.js';

// Optional behaviour, each in its own chunk: a player that does not use them
// never downloads them.
const MediaSessionController = lazy(() => import('./parts/MediaSessionController.js'));
const LearningPanel = lazy(() => import('./parts/LearningPanel.js'));
const OfflineController = lazy(() => import('./parts/OfflineController.js'));
const FrameTools = lazy(() => import('./parts/FrameTools.js'));
const SignLanguageVideo = lazy(() => import('./parts/SignLanguageVideo.js'));
const Watermark = lazy(() => import('./parts/Watermark.js'));
const ShareController = lazy(() => import('./parts/ShareController.js'));
const PersistenceController = lazy(() => import('./parts/PersistenceController.js'));
const PlaylistController = lazy(() => import('./parts/PlaylistController.js'));
import { usePlayerStyles } from './styles/index.js';
import type { VideoPlayerProps } from '../modules/videoplayer/videoplayer.types.js';

export type VideoPlayerComponentProps = VideoPlayerProps & {
  /** Swap any built-in icon: `icons={{ play: <MyPlay /> }}`. */
  icons?: IconOverrides;
  /**
   * A dictionary to use instead of English. Import one from
   * `@kuraykaraaslan/kui-player/locales`, or pass your own partial — anything
   * it leaves out falls back to English. `dir: 'rtl'` also mirrors the layout.
   */
  locale?: PartialDictionary;
  /**
   * Inject the player stylesheet on first render (default `true`). Set `false`
   * when the app imports `@kuraykaraaslan/kui-player/styles.css` itself.
   */
  injectStyles?: boolean;
  /**
   * Publish metadata and controls to the OS (lock screen, media keys).
   * Default `true`; it costs one small chunk and no network at all.
   */
  mediaSession?: boolean;
  /**
   * Remember position and preferences. **Off by default** — writing to a
   * viewer's storage uninvited is not a default this player takes.
   */
  persist?: boolean | PersistOptions;
  /**
   * Timestamped links: start at `?t=90` / `#t=1m30s` and show a "Share from
   * here" button. Off by default; pass `true` or `{ param, onShare }`.
   */
  share?: boolean | ShareOptions;
  /**
   * A visible, moving text mark (user id, e-mail) that stays on in fullscreen.
   * Deters leaks; it cannot stop screen recording.
   */
  watermark?: WatermarkOptions;
  /**
   * Ignore seeking while the playhead is inside an ad break the stream marks
   * (SSAI cue). Off by default; ad breaks are always marked on the seek bar and
   * reported as `adbreak:start` / `adbreak:end`.
   */
  seekLockInAds?: boolean;
  /** Start with audio description on, when the stream offers a description track. */
  audioDescription?: boolean;
  /**
   * A second video (an interpreter) docked in a corner and kept in step with the
   * main one. Both must share a timeline; drift beyond `maxDrift` is corrected.
   */
  signLanguage?: SignLanguageOptions;
  /**
   * Picture-in-picture with the controls too (Chromium's Document PiP). Falls back
   * to the plain video PiP where the API is missing. Off by default.
   */
  documentPictureInPicture?: boolean;
  /**
   * Offer on-device translation of the chosen subtitle track into these
   * languages (BCP-47, e.g. `['tr', 'ar']`), shown as the second line. Only where
   * the browser has the `Translator` API (Chromium desktop); otherwise nothing is offered.
   */
  translation?: { targets: string[] };
  /**
   * Review tools: SMPTE timecode, go-to-frame, copy timecode and an A-B loop
   * (press `a` to mark A, B, then clear). Off by default; loaded on demand.
   */
  frameTools?: boolean | FrameToolsOptions;
  /**
   * Study mode: timestamped notes (export as Markdown or JSON) and a map of what was
   * actually watched, with an `onProgress` hook for your own LMS. Notes and progress
   * are kept across visits only with `persist`. Off by default.
   */
  learning?: boolean | LearningOptions;
  /**
   * Let the viewer save the current file on their device (Cache Storage) and play
   * the saved copy from then on. Whole progressive files only — not HLS/DASH, not
   * DRM-protected content. Off by default.
   */
  offline?: boolean | OfflineOptions;
  /**
   * A podcast / audio layout: big artwork (`poster`), always-visible controls, an
   * optional waveform and a transcript button. The `<video>` element still plays
   * the audio; it is just not drawn.
   */
  audioOnly?: boolean;
  /**
   * Draw a waveform on the seek bar: a peaks array, a URL to a peaks JSON
   * (wavesurfer or BBC `audiowaveform`), or `'decode'` to compute it from the
   * audio in the browser (downloads and decodes the whole file; small files only).
   */
  waveform?: string | number[];
  /** Float the player into a corner while it plays and is scrolled out of view. Off by default. */
  miniPlayer?: boolean | MiniOptions;
  /** Skip-intro / skip-recap button for chapters of that kind (default on). */
  skipSegments?: boolean | SkipOptions;
  /** Remap or disable keyboard shortcuts; `?` opens the key list. */
  shortcuts?: ShortcutOverrides | false;
  /** Your own nodes in named positions of the chrome. */
  slots?: PlayerSlots<ReactNode>;
};

const NO_ICON_OVERRIDES: IconOverrides = {};
const EMPTY_PERSIST: PersistOptions = {};
const EMPTY_SHARE: ShareOptions = {};
const NO_FRAME_OPTIONS: FrameToolsOptions = {};
const NO_OFFLINE_OPTIONS: OfflineOptions = {};
const NO_LEARNING_OPTIONS: LearningOptions = {};

export function VideoPlayer(props: VideoPlayerComponentProps) {
  usePlayerStyles(props.injectStyles ?? true);
  // One engine per player, created on first render and never replaced.
  const [engine] = useState(() => new VideoPlayerEngine({
    defaultQuality: props.defaultQuality ?? props.qualities?.[0]?.value,
    startMuted: props.startMuted,
    autoHideControls: props.autoHideControls ?? true,
    controlsVisible: props.controlsVisible,
    adapters: props.adapters,
    preferNativeIosFullscreen: props.preferNativeIosFullscreen,
    seekLockInAds: props.seekLockInAds,
    // Known before the first source is attached, which happens in a child effect.
    live: props.live,
    // Autoplay is a play intent already: it loads at once.
    loadOnPlay: !!props.loadOnPlay && !props.autoPlay,
  }));
  const loadOnPlay = !!props.loadOnPlay && !props.autoPlay;
  useEffect(() => { engine.setLoadOnPlay(loadOnPlay); }, [engine, loadOnPlay]);

  // Live options after the first render.
  const liveKey = JSON.stringify(props.live ?? null);
  useEffect(() => { engine.setLive(props.live); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [engine, liveKey]);

  // Presence: a group from the nearest <PresenceGroupProvider> (or the prop)
  // wins over this player's own options, so a wall of players asks once.
  const contextGroup = usePresenceGroup();
  const presenceProp = props.presence;
  const ownEveryMs = presenceProp && !isPresenceGroup(presenceProp) ? presenceProp.everyMs : undefined;
  const ownGraceMs = presenceProp && !isPresenceGroup(presenceProp) ? presenceProp.graceMs : undefined;
  const presenceTarget = useMemo<PresenceGroup | { everyMs: number; graceMs: number } | undefined>(() => {
    if (presenceProp === false) return undefined;
    if (isPresenceGroup(presenceProp)) return presenceProp;
    if (contextGroup) return contextGroup;
    return ownEveryMs !== undefined && ownGraceMs !== undefined
      ? { everyMs: ownEveryMs, graceMs: ownGraceMs }
      : undefined;
  }, [presenceProp, contextGroup, ownEveryMs, ownGraceMs]);
  useEffect(() => {
    engine.setPresence(presenceTarget);
    return () => engine.setPresence(undefined);
  }, [engine, presenceTarget]);

  useEffect(() => {
    engine.updateProps({
      controlsVisible: props.controlsVisible,
      autoHideControls: props.autoHideControls ?? true,
      seekLockInAds: props.seekLockInAds,
    });
  }, [engine, props.controlsVisible, props.autoHideControls, props.seekLockInAds]);

  const dictionary = useMemo(() => resolveDictionary(props.locale), [props.locale]);

  return (
    <VideoPlayerEngineContext.Provider value={engine}>
      <I18nProvider value={dictionary}>
        <IconProvider value={props.icons ?? NO_ICON_OVERRIDES}>
          <VideoPlayerInner {...props} />
        </IconProvider>
      </I18nProvider>
    </VideoPlayerEngineContext.Provider>
  );
}

function VideoPlayerInner({
  src, poster, title, autoPlay = false, loop = false, startMuted = false,
  playsInline = true, qualities, subtitles, audioTracks, chapters, thumbnails,
  onQualityChange, onAudioTrackChange,
  adapters, sources: alternateSources, preferAlternateInFullscreen = false, onSourceChange,
  enableCast = false, castQueue, castReceiverAppId,
  enablePictureInPicture = true, gestures = true,
  playlist, playlistIndex, onPlaylistIndexChange, playlistCountdown,
  mediaSession = true, persist = false, share = false, shortcuts, skipSegments, miniPlayer, documentPictureInPicture, translation, frameTools, audioOnly, waveform, offline, learning, audioDescription, signLanguage, watermark, theme, slots,
  autoFullscreenOnLandscape = false, onCastStateChange, onControlsVisibilityChange, className,
}: VideoPlayerComponentProps) {
  const engine = useVideoPlayerEngine();
  const videoRef = useRef<HTMLVideoElement>(null);

  // A playlist supplies the source and its metadata; the plain props are the
  // fallback for everything the item leaves out.
  const [ownIndex, setOwnIndex] = useState(playlistIndex ?? 0);
  const index = playlistIndex ?? ownIndex;
  const item = playlist?.[index];
  const selectIndex = useCallback((next: number) => {
    setOwnIndex(next);
    onPlaylistIndexChange?.(next);
  }, [onPlaylistIndexChange]);

  // Alternate addresses ("Standard" / "High"): the viewer picks one from the quality
  // menu, or the fullscreen rule does; the first is the default.
  const alternates = alternateSources && alternateSources.length > 0 ? alternateSources : null;
  const [sourceIndex, setSourceIndex] = useState(0);
  const activeIndex = alternates ? Math.min(sourceIndex, alternates.length - 1) : 0;
  const alternateSrc = alternates?.[activeIndex]?.src;

  const effectiveSrc = item?.src ?? alternateSrc ?? src ?? '';
  const effectiveTitle = item?.title ?? title;
  const effectivePoster = item?.poster ?? poster;
  const effectiveSubtitles = item?.subtitles ?? subtitles;
  const effectiveChapters = item?.chapters ?? chapters;
  const effectiveThumbnails = item?.thumbnails ?? thumbnails;
  const shareOptions = share === true ? EMPTY_SHARE : share === false ? null : share;
  const urlTime = shareOptions && typeof window !== 'undefined'
    ? readUrlTime(window.location.href, shareOptions.param) : null;
  const persistOptions = persist === true ? EMPTY_PERSIST : persist === false ? null : persist;

  const selectAlternate = useCallback((next: number) => {
    const list = alternates;
    if (!list || next === activeIndex || !list[next]) return;
    // Position and play state travel with the viewer (a live stream rejoins the edge).
    engine.captureRestorePoint();
    setSourceIndex(next);
    onSourceChange?.(next, list[next]);
  }, [alternates, activeIndex, engine, onSourceChange]);

  // Entering or leaving fullscreen moves between the first and second address.
  // Only the change does, so a viewer's own pick stays until the next toggle.
  const fullscreenRule = useRef({ preferAlternateInFullscreen, alternates, selectAlternate });
  useEffect(() => { fullscreenRule.current = { preferAlternateInFullscreen, alternates, selectAlternate }; });
  useEffect(() => engine.store.subscribe((now, before) => {
    if (now.isFullscreen === before.isFullscreen) return;
    const rule = fullscreenRule.current;
    if (rule.preferAlternateInFullscreen && rule.alternates && rule.alternates.length > 1) {
      rule.selectAlternate(now.isFullscreen ? 1 : 0);
    }
  }), [engine]);

  // Attach video element to engine on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    engine.attach(v);
    return () => engine.detach();
  }, [engine]);

  const pageSources = useMemo(
    () => (Array.isArray(effectiveSrc) ? effectiveSrc : [effectiveSrc]),
    [effectiveSrc],
  );
  // With `offline`, a copy saved on this device replaces the network source (a blob: URL).
  const [localCopy, setLocalCopy] = useState<string | null>(null);
  const sources = useMemo(() => (localCopy ? [localCopy] : pageSources), [localCopy, pageSources]);
  const pagePrimary = typeof pageSources[0] === 'string' ? pageSources[0] : pageSources[0]?.src ?? '';
  const srcKey = useMemo(
    () => sources.map((s) => (typeof s === 'string' ? s : s.src)).join('|'),
    [sources],
  );
  const primarySrc = useMemo(() => {
    const first = sources[0];
    return first === undefined ? '' : typeof first === 'string' ? first : first.src;
  }, [sources]);

  // Does a registered adapter claim this source? Decided from the props alone —
  // pure and DOM-free, so it holds on the server too. When it does, the element
  // gets no <source> children: the adapter owns the media pipeline.
  const adapterManaged = useMemo(
    () => (adapters ?? []).some((a) => a.canPlay(primarySrc)),
    [adapters, primarySrc],
  );

  useEffect(() => { engine.setAdapters(adapters ?? []); }, [engine, adapters]);

  useEffect(() => {
    if (!adapterManaged || !videoRef.current) return;
    void engine.loadSource(primarySrc);
  }, [engine, adapterManaged, primarySrc]);

  // Changing <source> children does not reload the element on its own. Re-run
  // load() so a consumer-driven source swap (the usual `onQualityChange` shape)
  // actually takes effect — the engine restores position/play state afterwards.
  const mountedSrcKey = useRef(srcKey);
  useEffect(() => {
    if (mountedSrcKey.current === srcKey) return;
    mountedSrcKey.current = srcKey;
    if (!adapterManaged) videoRef.current?.load();
  }, [srcKey, adapterManaged]);

  return (
    <VideoPlayerChrome
      videoRef={videoRef}
      theme={theme}
      slots={slots}
      shortcuts={shortcuts}
      skipSegments={skipSegments}
      miniPlayer={miniPlayer}
      audioOnly={audioOnly}
      waveform={waveform}
      translation={translation}
      documentPictureInPicture={documentPictureInPicture}
      audioDescription={audioDescription}
      src={effectiveSrc}
      poster={effectivePoster}
      title={effectiveTitle}
      qualities={qualities}
      alternateSources={alternates ?? undefined}
      alternateIndex={activeIndex}
      onAlternateSelect={selectAlternate}
      subtitles={effectiveSubtitles}
      audioTracks={audioTracks}
      chapters={effectiveChapters}
      thumbnails={effectiveThumbnails}
      onQualityChange={onQualityChange}
      onAudioTrackChange={onAudioTrackChange}
      enableCast={enableCast}
      castQueue={castQueue}
      castReceiverAppId={castReceiverAppId}
      enablePictureInPicture={enablePictureInPicture}
      gestures={gestures}
      autoFullscreenOnLandscape={autoFullscreenOnLandscape}
      onCastStateChange={onCastStateChange}
      onControlsVisibilityChange={onControlsVisibilityChange}
      className={className}
    >
      <video
        ref={videoRef}
        poster={effectivePoster}
        autoPlay={autoPlay}
        loop={loop}
        muted={startMuted}
        playsInline={playsInline}
        // Older iOS builds (< 10) only honour the vendor-prefixed attribute.
        {...(playsInline ? { 'webkit-playsinline': 'true' } : {})}
        // Only force CORS when subtitle <track>s are present — text tracks are
        // CORS-restricted. Setting it unconditionally blocks playback of any
        // video host that doesn't send Access-Control-Allow-Origin.
        crossOrigin={effectiveSubtitles && effectiveSubtitles.length > 0 ? 'anonymous' : undefined}
        className="kui-video"
        onClick={() => engine.togglePlay()}
      >
        {!adapterManaged && sources.map((s, i) =>
          typeof s === 'string'
            ? <source key={i} src={s} />
            : <source key={i} src={s.src} type={s.type} />,
        )}
        {effectiveSubtitles?.map((sub, i) => (
          // SRT and ASS are fetched and timed by the player instead: a <track>
          // pointing at them would only produce a load error.
          !sub.local && detectFormat(sub.src) === 'vtt'
            ? <track key={i} kind="subtitles" label={sub.label} srcLang={sub.srclang} src={sub.src} />
            : null
        ))}
      </video>

      {mediaSession && (
        <Suspense fallback={null}>
          <MediaSessionController
            title={effectiveTitle}
            poster={effectivePoster}
            onNext={playlist && index < playlist.length - 1 ? () => selectIndex(index + 1) : undefined}
            onPrevious={playlist && index > 0 ? () => selectIndex(index - 1) : undefined}
          />
        </Suspense>
      )}

      {persistOptions && (
        <Suspense fallback={null}>
          <PersistenceController
            options={persistOptions}
            src={srcKey}
            subtitles={effectiveSubtitles}
            skipResume={urlTime !== null}
          />
        </Suspense>
      )}

      {learning && (
        <Suspense fallback={null}>
          <LearningPanel
            options={learning === true ? NO_LEARNING_OPTIONS : learning}
            src={pagePrimary}
            title={effectiveTitle}
            persist={persistOptions}
          />
        </Suspense>
      )}

      {offline && (
        <Suspense fallback={null}>
          <OfflineController options={offline === true ? NO_OFFLINE_OPTIONS : offline} src={pagePrimary} onLocalSrc={setLocalCopy} />
        </Suspense>
      )}

      {frameTools && (
        <Suspense fallback={null}>
          <FrameTools options={frameTools === true ? NO_FRAME_OPTIONS : frameTools} />
        </Suspense>
      )}

      {signLanguage?.src && (
        <Suspense fallback={null}>
          <SignLanguageVideo options={signLanguage} />
        </Suspense>
      )}

      {watermark?.text && (
        <Suspense fallback={null}>
          <Watermark options={watermark} />
        </Suspense>
      )}

      {shareOptions && (
        <Suspense fallback={null}>
          <ShareController options={shareOptions} src={srcKey} />
        </Suspense>
      )}

      {playlist && playlist.length > 1 && (
        <Suspense fallback={null}>
          <PlaylistController
            playlist={playlist}
            index={index}
            onSelect={selectIndex}
            countdown={playlistCountdown}
          />
        </Suspense>
      )}
    </VideoPlayerChrome>
  );
}
