import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '../libs/utils/cn';
import { formatTime } from '../modules/videoplayer/videoplayer.format';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine';
import { useVideoPlayerStore } from './hooks/useVideoPlayerStore';
import { ControlRow } from './parts/ControlRow';
import { ProgressBar } from './parts/ProgressBar';
import { SettingsPanel } from './parts/SettingsPanel';
import { AboutModal } from './parts/AboutModal';
import { CastOverlay, LoadingOverlay, CenterPlayOverlay, SubtitleOverlay } from './parts/Overlays';
import { useSubtitleCues } from './hooks/useSubtitleCues';
import { useGoogleCast } from './hooks/useGoogleCast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type {
  AudioTrackOption, CastState, QualityOption, SubtitleFontSize, SubtitleTrack, VideoSource,
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
  onCastStateChange?: (state: CastState) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
  className?: string;
}

export function VideoPlayerChrome({
  videoRef, children, skin = false, onToggleFullscreen,
  src = '', poster, title, qualities, subtitles, audioTracks,
  onQualityChange, onAudioTrackChange, enableCast = true, onCastStateChange,
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
  const isFullscreen      = useVideoPlayerStore(s => s.isFullscreen);
  const showControls      = useVideoPlayerStore(s => s.showControls);
  const seekHoverX        = useVideoPlayerStore(s => s.seekHoverX);
  const showSettings      = useVideoPlayerStore(s => s.showSettings);
  const settingsView      = useVideoPlayerStore(s => s.settingsView);
  const selectedQuality   = useVideoPlayerStore(s => s.selectedQuality);
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

  const { toggleCast } = useGoogleCast({ enableCast, videoRef, src, title, poster, engine, onCastStateChange });
  const cueText = useSubtitleCues({ videoRef, selectedSubtitle, subtitles });
  useKeyboardShortcuts({ containerRef, engine });

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
  const applyQuality     = useCallback((v: string) => { setSelectedQuality(v); onQualityChange?.(v); closeSettings(); }, [setSelectedQuality, onQualityChange, closeSettings]);
  const applySubtitle    = useCallback((i: number | null) => { setSelectedSubtitle(i); closeSettings(); }, [setSelectedSubtitle, closeSettings]);
  const applyAudioTrack  = useCallback((i: number) => { setSelectedAudioTrack(i); onAudioTrackChange?.(i); closeSettings(); }, [setSelectedAudioTrack, onAudioTrackChange, closeSettings]);
  const applySubtitleSize= useCallback((sz: SubtitleFontSize) => { setSubtitleFontSize(sz); setSettingsView('main'); }, [setSubtitleFontSize, setSettingsView]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    engine.seekByRatio((e.clientX - rect.left) / rect.width);
  }, [engine]);

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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const seekHoverPct = seekHoverX !== null && progressRef.current
    ? (seekHoverX / progressRef.current.getBoundingClientRect().width) * 100 : null;
  const hoverTime = seekHoverPct !== null ? formatTime((seekHoverPct / 100) * duration) : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={title ? `Video: ${title}` : 'Video player'}
      className={cn(
        'relative overflow-hidden select-none outline-none',
        skin
          ? 'w-full h-full'
          : 'bg-black rounded-xl aspect-video min-h-[10rem] focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
      onMouseMove={() => engine.resetHideTimer()}
      onMouseLeave={() => engine.hideIfPlaying()}
      onClick={skin ? (e) => { if (e.target === e.currentTarget && !isCasting) engine.togglePlay(); } : undefined}
    >
      {children}

      {isCasting && <CastOverlay castDeviceName={castDeviceName} title={title} />}
      {loading && <LoadingOverlay />}
      {!loading && <CenterPlayOverlay playing={playing} />}
      {cueText && (
        <SubtitleOverlay cueText={cueText} effectiveControls={effectiveControls} subtitleFontSize={subtitleFontSize} />
      )}

      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-end transition-opacity duration-300 z-20',
          effectiveControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={(e) => { if (e.target === e.currentTarget && !isCasting) engine.togglePlay(); }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)' }}
        />
        {showSettings && (
          <SettingsPanel
            ref={settingsPanelRef}
            view={settingsView}
            onChangeView={setSettingsView}
            onAbout={() => { setShowAbout(true); closeSettings(); }}
            qualities={qualities}
            subtitles={subtitles}
            audioTracks={audioTracks}
            selectedQuality={selectedQuality}
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
        )}
        <div className="relative px-4 pb-3 pt-6 space-y-2.5">
          {title && <p className="text-white/90 text-sm font-medium truncate leading-tight">{title}</p>}
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

      <AboutModal open={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}
