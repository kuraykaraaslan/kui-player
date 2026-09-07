"use client";

import { useEffect, useMemo, useRef } from 'react';
import { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine';
import { VideoPlayerEngineContext } from './VideoPlayerEngineContext';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
import { VideoPlayerChrome } from './VideoPlayerChrome';
import { IconProvider, type IconOverrides } from './icons';
import { usePlayerStyles } from './styles';
import type { VideoPlayerProps } from '../modules/videoplayer/videoplayer.types';

export type VideoPlayerComponentProps = VideoPlayerProps & {
  /** Swap any built-in icon: `icons={{ play: <MyPlay /> }}`. */
  icons?: IconOverrides;
  /**
   * Inject the player stylesheet on first render (default `true`). Set `false`
   * when the app imports `@kuraykaraaslan/kui-player/styles.css` itself.
   */
  injectStyles?: boolean;
};

const NO_ICON_OVERRIDES: IconOverrides = {};

export function VideoPlayer(props: VideoPlayerComponentProps) {
  usePlayerStyles(props.injectStyles ?? true);
  const engineRef = useRef<VideoPlayerEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new VideoPlayerEngine({
      defaultQuality: props.defaultQuality ?? props.qualities?.[0]?.value,
      startMuted: props.startMuted,
      autoHideControls: props.autoHideControls ?? true,
      controlsVisible: props.controlsVisible,
      adapters: props.adapters,
      preferNativeIosFullscreen: props.preferNativeIosFullscreen,
    });
  }

  useEffect(() => {
    engineRef.current?.updateProps({
      controlsVisible: props.controlsVisible,
      autoHideControls: props.autoHideControls ?? true,
    });
  }, [props.controlsVisible, props.autoHideControls]);

  return (
    <VideoPlayerEngineContext.Provider value={engineRef.current}>
      <IconProvider value={props.icons ?? NO_ICON_OVERRIDES}>
        <VideoPlayerInner {...props} />
      </IconProvider>
    </VideoPlayerEngineContext.Provider>
  );
}

function VideoPlayerInner({
  src, poster, title, autoPlay = false, loop = false, startMuted = false,
  playsInline = true, qualities, subtitles, audioTracks, onQualityChange, onAudioTrackChange,
  adapters, enableCast = true, enablePictureInPicture = true, gestures = true,
  autoFullscreenOnLandscape = false, onCastStateChange, onControlsVisibilityChange, className,
}: VideoPlayerProps) {
  const engine = useVideoPlayerEngine();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attach video element to engine on mount
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    engine.attach(v);
    return () => engine.detach();
  }, [engine]);

  const sources = useMemo(() => (Array.isArray(src) ? src : [src]), [src]);
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
      src={src}
      poster={poster}
      title={title}
      qualities={qualities}
      subtitles={subtitles}
      audioTracks={audioTracks}
      onQualityChange={onQualityChange}
      onAudioTrackChange={onAudioTrackChange}
      enableCast={enableCast}
      enablePictureInPicture={enablePictureInPicture}
      gestures={gestures}
      autoFullscreenOnLandscape={autoFullscreenOnLandscape}
      onCastStateChange={onCastStateChange}
      onControlsVisibilityChange={onControlsVisibilityChange}
      className={className}
    >
      <video
        ref={videoRef}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={startMuted}
        playsInline={playsInline}
        // Older iOS builds (< 10) only honour the vendor-prefixed attribute.
        {...(playsInline ? { 'webkit-playsinline': 'true' } : {})}
        // Only force CORS when subtitle <track>s are present — text tracks are
        // CORS-restricted. Setting it unconditionally blocks playback of any
        // video host that doesn't send Access-Control-Allow-Origin.
        crossOrigin={subtitles && subtitles.length > 0 ? 'anonymous' : undefined}
        className="kui-video"
        onClick={() => engine.togglePlay()}
      >
        {!adapterManaged && sources.map((s, i) =>
          typeof s === 'string'
            ? <source key={i} src={s} />
            : <source key={i} src={s.src} type={s.type} />,
        )}
        {subtitles?.map((sub, i) => (
          <track key={i} kind="subtitles" label={sub.label} srcLang={sub.srclang} src={sub.src} />
        ))}
      </video>
    </VideoPlayerChrome>
  );
}
