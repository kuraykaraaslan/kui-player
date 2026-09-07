import {
  Suspense, lazy, useCallback, useEffect, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import { cn } from '../libs/utils/cn';
import { formatTime } from '../modules/videoplayer/videoplayer.format';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
import { useVideoPlayerStore } from './hooks/useVideoPlayerStore';
import { ControlRow } from './parts/ControlRow';
import { ProgressBar } from './parts/ProgressBar';
import {
  CastOverlay, ErrorOverlay, GestureOverlay, LoadingOverlay, CenterPlayOverlay, SubtitleOverlay,
} from './parts/Overlays';
import { AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters/adapter.types';
import { useSubtitleCues } from './hooks/useSubtitleCues';
import { useTouchGestures } from './hooks/useTouchGestures';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type { CastApi } from './parts/CastController';

// Split out of the main chunk: the settings menu and the About dialog are only
// reachable after a click, and the Cast SDK plumbing never loads at all unless
// `enableCast` is on.
const SettingsPanel = lazy(() => import('./parts/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const AboutModal = lazy(() => import('./parts/AboutModal').then((m) => ({ default: m.AboutModal })));
const CastController = lazy(() => import('./parts/CastController'));
import type {
  AudioTrackOption, CastState, GestureOptions, QualityOption, SubtitleFontSize, SubtitleTrack, VideoSource,
} from '../modules/videoplayer/videoplayer.types';

/**
 * The controls chrome of the player — everything that renders around a `<video>`
 * (progress bar, control row, settings panel, overlays) — decoupled from the
 * element itself. Two consumers:
 *   • `<VideoPlayer>` (embedded mode) passes the `<video>` it owns as `children`.
 *   • `mountSkin()` (skin mode) adopts a page's existing `<video>` — it renders NO
 *     children and overlays this chrome on top of that element (`skin` = true).
 * The engine is read from context; the caller owns `engine.attach`/`detach`.
 */
export interface VideoPlayerChromeProps {
  /** The video element the engine is attached to (caller-owned). */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Rendered as the first child of the container — the `<video>` in embedded mode; nothing in skin mode. */
  children?: ReactNode;
  /** Skin mode: transparent container that fills its host and overlays a page video. */
  skin?: boolean;
  /** Overrides the fullscreen button/handler (skin mode supplies a video-aware toggle). */
  onToggleFullscreen?: () => void;

  src?: string | VideoSource | (string | VideoSource)[];
  poster?: string;
  title?: string;
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  onQualityChange?: (value: string) => void;
  onAudioTrackChange?: (index: number) => void;
  enableCast?: boolean;
  /** Show the Picture-in-Picture button where the browser supports it. Default `true`. */
  enablePictureInPicture?: boolean;
  /** Touch gestures; `false` turns them all off. Default `true`. */
  gestures?: boolean | GestureOptions;
  /** Enter fullscreen when a phone rotates to landscape while playing. Default `false`. */
  autoFullscreenOnLandscape?: boolean;
  onCastStateChange?: (state: CastState) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
  className?: string;
}

export function VideoPlayerChrome({
  videoRef, children, skin = false, onToggleFullscreen,
  src = '', poster, title, qualities, subtitles, audioTracks,
  onQualityChange, onAudioTrackChange, enableCast = true, enablePictureInPicture = true,
  gestures = true, autoFullscreenOnLandscape = false, onCastStateChange,
  onControlsVisibilityChange, className,
}: VideoPlayerChromeProps) {
  const engine = useVideoPlayerEngine();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const [showAbout, setShowAbout] = useState(false);

  // Reactive state
  const playing           = useVideoPlayerStore(s => s.playing);
  const currentTime       = useVideoPlayerStore(s => s.currentTime);
  const duration          = useVideoPlayerStore(s => s.duration);
  const buffered          = useVideoPlayerStore(s => s.buffered);
  const volume            = useVideoPlayerStore(s => s.volume);
  const muted             = useVideoPlayerStore(s => s.muted);
  const speed             = useVideoPlayerStore(s => s.speed);
  const loading           = useVideoPlayerStore(s => s.loading);
  const error             = useVideoPlayerStore(s => s.error);
  const retrying          = useVideoPlayerStore(s => s.retrying);
  const isFullscreen      = useVideoPlayerStore(s => s.isFullscreen);
  const isPip             = useVideoPlayerStore(s => s.isPip);
  const pipSupported      = useVideoPlayerStore(s => s.pipSupported);
  const showControls      = useVideoPlayerStore(s => s.showControls);
  const seekHoverX        = useVideoPlayerStore(s => s.seekHoverX);
  const showSettings      = useVideoPlayerStore(s => s.showSettings);
  const settingsView      = useVideoPlayerStore(s => s.settingsView);
  const selectedQuality   = useVideoPlayerStore(s => s.selectedQuality);
  const adaptiveQualities = useVideoPlayerStore(s => s.adaptiveQualities);
  const activeQualityLabel= useVideoPlayerStore(s => s.activeQualityLabel);
  const adaptiveAudioTracks = useVideoPlayerStore(s => s.adaptiveAudioTracks);
  const selectedSubtitle  = useVideoPlayerStore(s => s.selectedSubtitle);
  const selectedAudioTrack= useVideoPlayerStore(s => s.selectedAudioTrack);
  const subtitleFontSize  = useVideoPlayerStore(s => s.subtitleFontSize);
  const castState         = useVideoPlayerStore(s => s.castState);
  const castDeviceName    = useVideoPlayerStore(s => s.castDeviceName);
  const setShowSettings   = useVideoPlayerStore(s => s.setShowSettings);
  const setSettingsView   = useVideoPlayerStore(s => s.setSettingsView);
  const setSelectedQuality   = useVideoPlayerStore(s => s.setSelectedQuality);
  const setSelectedSubtitle  = useVideoPlayerStore(s => s.setSelectedSubtitle);
  const setSelectedAudioTrack= useVideoPlayerStore(s => s.setSelectedAudioTrack);
  const setSubtitleFontSize  = useVideoPlayerStore(s => s.setSubtitleFontSize);
  const setSeekHoverX        = useVideoPlayerStore(s => s.setSeekHoverX);

  const isCasting = castState === 'connected';

  const effectiveControls = isCasting
    ? true
    : engine.controlsVisible !== undefined
      ? engine.controlsVisible
      : showControls;

  useEffect(() => { onControlsVisibilityChange?.(effectiveControls); }, [effectiveControls, onControlsVisibilityChange]);

  const castApi = useRef<CastApi | null>(null);
  const onCastApi = useCallback((api: CastApi | null) => { castApi.current = api; }, []);
  const toggleCast = useCallback(() => castApi.current?.toggleCast(), []);
  const cueText = useSubtitleCues({ videoRef, selectedSubtitle, subtitles });
  useKeyboardShortcuts({ containerRef, engine });
  const { feedback, suppressClick, handlers: gestureHandlers } = useTouchGestures({
    containerRef, videoRef, engine, gestures, enabled: !isCasting,
  });

  // An adapter (hls.js / dash.js) publishes real renditions; when it does they
  // replace the consumer's static `qualities` list and gain an "Auto" entry.
  const adaptive = adaptiveQualities.length > 0;
  const qualityOptions = adaptive
    ? [{ label: 'Auto', value: AUTO_QUALITY_VALUE }, ...adaptiveQualities]
    : qualities;
  const effectiveAudioTracks = adaptiveAudioTracks.length > 1 ? adaptiveAudioTracks : audioTracks;

  // Rotating a phone into landscape is the clearest "make this big" signal there is.
  useEffect(() => {
    if (!autoFullscreenOnLandscape || typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const landscape = window.matchMedia('(orientation: landscape)');
    const onChange = () => {
      const c = containerRef.current;
      if (!c) return;
      if (landscape.matches) { if (engine.store.getState().playing) engine.enterFullscreen(c); }
      else engine.exitFullscreen(c);
    };
    landscape.addEventListener('change', onChange);
    return () => landscape.removeEventListener('change', onChange);
  }, [autoFullscreenOnLandscape, engine]);

  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (!settingsPanelRef.current?.contains(e.target as Node)) {
        setShowSettings(false); setSettingsView('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings, setShowSettings, setSettingsView]);

  const closeSettings = useCallback(() => { setShowSettings(false); setSettingsView('main'); }, [setShowSettings, setSettingsView]);

  const applySpeed       = useCallback((s: number) => { engine.setSpeed(s); closeSettings(); }, [engine, closeSettings]);
  // Snapshot position/play state *before* the consumer swaps the source, so the
  // engine can restore it on the next `loadedmetadata` — whichever way the swap
  // happens (our `switchSource`, or a `src` prop change driven by the callback).
  const applyQuality     = useCallback((v: string) => {
    if (adaptive) {
      // The adapter switches renditions in place — no source swap, no reload.
      engine.selectQuality(v);
      onQualityChange?.(v);
      closeSettings();
      return;
    }
    engine.captureRestorePoint();
    setSelectedQuality(v);
    onQualityChange?.(v);
    closeSettings();
  }, [adaptive, engine, setSelectedQuality, onQualityChange, closeSettings]);
  const applySubtitle    = useCallback((i: number | null) => { setSelectedSubtitle(i); closeSettings(); }, [setSelectedSubtitle, closeSettings]);
  // Actually switches the rendition (adapter or the element's own track list)
  // instead of only telling the consumer about it.
  const applyAudioTrack  = useCallback((i: number) => { engine.setAudioTrack(i); onAudioTrackChange?.(i); closeSettings(); }, [engine, onAudioTrackChange, closeSettings]);
  const applySubtitleSize= useCallback((sz: SubtitleFontSize) => { setSubtitleFontSize(sz); setSettingsView('main'); }, [setSubtitleFontSize, setSettingsView]);

  const seekToClientX = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    engine.seekByRatio((clientX - rect.left) / rect.width);
  }, [engine]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    seekToClientX(e.clientX);
  }, [seekToClientX]);

  // Dragging the bar scrubs live — the only way to seek precisely on a phone.
  const scrubbing = useRef(false);
  const handleScrubStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    scrubbing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekToClientX(e.clientX);
  }, [seekToClientX]);

  const handleScrubMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    e.preventDefault();
    const bar = progressRef.current;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      setSeekHoverX(Math.max(0, Math.min(rect.width, e.clientX - rect.left)));
    }
    seekToClientX(e.clientX);
  }, [seekToClientX, setSeekHoverX]);

  const handleScrubEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch') setSeekHoverX(null);
  }, [setSeekHoverX]);

  const handleSeekMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    setSeekHoverX(Math.max(0, Math.min(rect.width, e.clientX - rect.left)));
  }, [setSeekHoverX]);

  const handleFullscreen = useCallback(() => {
    if (onToggleFullscreen) { onToggleFullscreen(); return; }
    if (containerRef.current) engine.toggleFullscreen(containerRef.current);
  }, [onToggleFullscreen, engine]);

  const handleTogglePip = useCallback(() => { void engine.togglePictureInPicture(); }, [engine]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const seekHoverPct = seekHoverX !== null && progressRef.current
    ? (seekHoverX / progressRef.current.getBoundingClientRect().width) * 100 : null;
  const hoverTime = seekHoverPct !== null ? formatTime((seekHoverPct / 100) * duration) : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={title ? `Video: ${title}` : 'Video player'}
      className={cn('kui-player', skin ? 'kui-player--skin' : 'kui-player--embedded', className)}
      onMouseMove={() => engine.resetHideTimer()}
      onMouseLeave={() => engine.hideIfPlaying()}
      onClick={skin
        ? (e) => { if (e.target === e.currentTarget && !isCasting && !suppressClick()) engine.togglePlay(); }
        : undefined}
      {...gestureHandlers}
    >
      {children}

      {isCasting && <CastOverlay castDeviceName={castDeviceName} title={title} />}
      {error && <ErrorOverlay error={error} retrying={retrying} onRetry={() => engine.retry()} />}
      {!error && loading && <LoadingOverlay />}
      {!error && !loading && <CenterPlayOverlay playing={playing} />}
      <GestureOverlay feedback={feedback} />
      {cueText && (
        <SubtitleOverlay cueText={cueText} effectiveControls={effectiveControls} subtitleFontSize={subtitleFontSize} />
      )}

      {enableCast && (
        <Suspense fallback={null}>
          <CastController
            videoRef={videoRef}
            src={src}
            title={title}
            poster={poster}
            onCastStateChange={onCastStateChange}
            onApi={onCastApi}
          />
        </Suspense>
      )}

      <div
        className={cn('kui-chrome', !effectiveControls && 'is-hidden')}
        onClick={(e) => { if (e.target === e.currentTarget && !isCasting && !suppressClick()) engine.togglePlay(); }}
      >
        <div className="kui-scrim" />
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsPanel
              ref={settingsPanelRef}
              view={settingsView}
              onChangeView={setSettingsView}
              onAbout={() => { setShowAbout(true); closeSettings(); }}
              qualities={qualityOptions}
              subtitles={subtitles}
              audioTracks={effectiveAudioTracks}
              selectedQuality={selectedQuality}
              activeQualityLabel={activeQualityLabel}
              selectedSubtitle={selectedSubtitle}
              selectedAudioTrack={selectedAudioTrack}
              speed={speed}
              subtitleFontSize={subtitleFontSize}
              applyQuality={applyQuality}
              applySpeed={applySpeed}
              applySubtitle={applySubtitle}
              applySubtitleSize={applySubtitleSize}
              applyAudioTrack={applyAudioTrack}
            />
          </Suspense>
        )}
        <div className="kui-controls">
          {title && <p className="kui-title">{title}</p>}
          <ProgressBar
            ref={progressRef}
            progress={progress}
            buffered={buffered}
            seekHoverX={seekHoverX}
            seekHoverPct={seekHoverPct}
            hoverTime={hoverTime}
            onSeek={handleSeek}
            onSeekMouseMove={handleSeekMouseMove}
            onSeekLeave={() => setSeekHoverX(null)}
            onScrubStart={handleScrubStart}
            onScrubMove={handleScrubMove}
            onScrubEnd={handleScrubEnd}
            valueText={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
          <ControlRow
            playing={playing}
            muted={muted}
            volume={volume}
            currentTime={currentTime}
            duration={duration}
            isFullscreen={isFullscreen}
            showSettings={showSettings}
            enableCast={enableCast}
            castState={castState}
            showPip={enablePictureInPicture && pipSupported}
            isPip={isPip}
            onTogglePip={handleTogglePip}
            onPlay={() => engine.togglePlay()}
            onSeekBy={(d) => engine.seekBy(d)}
            onToggleMute={() => engine.toggleMute()}
            onVolumeChange={(v) => engine.setVolume(v)}
            onToggleSettings={() => { setShowSettings(!showSettings); setSettingsView('main'); }}
            onToggleCast={toggleCast}
            onToggleFullscreen={handleFullscreen}
          />
        </div>
      </div>

      {showAbout && (
        <Suspense fallback={null}>
          <AboutModal open onClose={() => setShowAbout(false)} />
        </Suspense>
      )}
    </div>
  );
}
