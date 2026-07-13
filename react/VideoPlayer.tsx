import { useEffect, useRef } from 'react';
import { VideoPlayerEngine } from '../modules/videoplayer/videoplayer.engine';
import { VideoPlayerEngineContext } from './VideoPlayerEngineContext';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
import { VideoPlayerChrome } from './VideoPlayerChrome';
import type { VideoPlayerProps } from '../modules/videoplayer/videoplayer.types';

export function VideoPlayer(props: VideoPlayerProps) {
  const engineRef = useRef<VideoPlayerEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new VideoPlayerEngine({
      defaultQuality: props.defaultQuality ?? props.qualities?.[0]?.value,
      startMuted: props.startMuted,
      autoHideControls: props.autoHideControls ?? true,
      controlsVisible: props.controlsVisible,
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
      <VideoPlayerInner {...props} />
    </VideoPlayerEngineContext.Provider>
  );
}

function VideoPlayerInner({
  src, poster, title, autoPlay = false, loop = false, startMuted = false,
  qualities, subtitles, audioTracks, onQualityChange, onAudioTrackChange,
  enableCast = true, onCastStateChange, onControlsVisibilityChange, className,
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

  const sources = Array.isArray(src) ? src : [src];

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
        // Only force CORS when subtitle <track>s are present — text tracks are
        // CORS-restricted. Setting it unconditionally blocks playback of any
        // video host that doesn't send Access-Control-Allow-Origin.
        crossOrigin={subtitles && subtitles.length > 0 ? 'anonymous' : undefined}
        className="w-full h-full object-contain block"
        onClick={() => engine.togglePlay()}
        style={{ cursor: 'pointer' }}
      >
        {sources.map((s, i) =>
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
