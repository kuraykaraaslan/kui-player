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

// Optional behaviour, each in its own chunk: a player that does not use them
// never downloads them.
const MediaSessionController = lazy(() => import('./parts/MediaSessionController.js'));
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
  }));

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
  adapters, enableCast = false, castQueue, castReceiverAppId,
  enablePictureInPicture = true, gestures = true,
  playlist, playlistIndex, onPlaylistIndexChange, playlistCountdown,
  mediaSession = true, persist = false, share = false, shortcuts, skipSegments, miniPlayer, documentPictureInPicture, translation, frameTools, audioDescription, signLanguage, watermark, theme, slots,
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

  const effectiveSrc = item?.src ?? src ?? '';
  const effectiveTitle = item?.title ?? title;
  const effectivePoster = item?.poster ?? poster;
  const effectiveSubtitles = item?.subtitles ?? subtitles;
  const effectiveChapters = item?.chapters ?? chapters;
  const effectiveThumbnails = item?.thumbnails ?? thumbnails;
  const shareOptions = share === true ? EMPTY_SHARE : share === false ? null : share;
  const urlTime = shareOptions && typeof window !== 'undefined'
    ? readUrlTime(window.location.href, shareOptions.param) : null;
  const persistOptions = persist === true ? EMPTY_PERSIST : persist === false ? null : persist;

  // Attach video element to engine on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    engine.attach(v);
    return () => engine.detach();
  }, [engine]);

  const sources = useMemo(
    () => (Array.isArray(effectiveSrc) ? effectiveSrc : [effectiveSrc]),
    [effectiveSrc],
  );
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
      translation={translation}
      documentPictureInPicture={documentPictureInPicture}
      audioDescription={audioDescription}
      src={effectiveSrc}
      poster={effectivePoster}
      title={effectiveTitle}
      qualities={qualities}
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
          detectFormat(sub.src) === 'vtt'
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
