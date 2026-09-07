import {
  Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore,
  type ReactNode, type RefObject,
} from 'react';
import { cn } from '../libs/utils/cn.js';
import { formatTime } from '../modules/videoplayer/videoplayer.format.js';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from './hooks/useVideoPlayerStore.js';
import { ControlRow } from './parts/ControlRow.js';
import { ProgressBar } from './parts/ProgressBar.js';
import {
  ErrorOverlay, LoadingOverlay, CenterPlayOverlay, SubtitleOverlay,
} from './parts/Overlays.js';
import { AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters/adapter.types.js';
import { useSubtitleCues } from './hooks/useSubtitleCues.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useFocusTrap } from './hooks/useFocusTrap.js';
import { usePlayerAnnouncements } from './hooks/usePlayerAnnouncements.js';
import type { CastApi } from './parts/CastController.js';

// Split out of the main chunk: the settings menu and the About dialog are only
// reachable after a click, and the Cast SDK plumbing never loads at all unless
// `enableCast` is on.
const SettingsPanel = lazy(() => import('./parts/SettingsPanel.js').then((m) => ({ default: m.SettingsPanel })));
const AboutModal = lazy(() => import('./parts/AboutModal.js').then((m) => ({ default: m.AboutModal })));
const CastController = lazy(() => import('./parts/CastController.js'));
const GestureLayer = lazy(() => import('./parts/GestureLayer.js'));

/*
 * Touch gestures are pointless — and not worth downloading — without a coarse
 * pointer. Read as an external store so the server snapshot is a plain `false`
 * (identical markup everywhere) and a hybrid device that switches input mode is
 * picked up without a re-mount.
 */
const COARSE_POINTER = '(pointer: coarse)';
const coarseQuery = () =>
  (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(COARSE_POINTER) : null);

function subscribeCoarsePointer(onChange: () => void): () => void {
  const mq = coarseQuery();
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}
const hasCoarsePointer = () => coarseQuery()?.matches ?? false;
const hasCoarsePointerOnServer = () => false;
import type {
  AudioTrackOption, CastQueueItem, CastState, GestureOptions, QualityOption,
  SubtitleFontSize, SubtitleTrack, VideoSource,
} from '../modules/videoplayer/videoplayer.types.js';

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
  /** Cast a playlist rather than the current source. */
  castQueue?: CastQueueItem[];
  /** A custom receiver application id. */
  castReceiverAppId?: string;
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
  onQualityChange, onAudioTrackChange, enableCast = false, castQueue, castReceiverAppId,
  enablePictureInPicture = true,
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
  const seekHoverRatio    = useVideoPlayerStore(s => s.seekHoverRatio);
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
  // Everything else about a Cast session — the overlay, the queue, the error
  // banner — lives in the Cast chunk, which only loads when Cast is enabled.
  const setShowSettings   = useVideoPlayerStore(s => s.setShowSettings);
  const setSettingsView   = useVideoPlayerStore(s => s.setSettingsView);
  const setSelectedQuality   = useVideoPlayerStore(s => s.setSelectedQuality);
  const setSelectedSubtitle  = useVideoPlayerStore(s => s.setSelectedSubtitle);
  const setSubtitleFontSize  = useVideoPlayerStore(s => s.setSubtitleFontSize);
  const setSeekHoverRatio    = useVideoPlayerStore(s => s.setSeekHoverRatio);

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
  const announcement = usePlayerAnnouncements({ qualities, subtitles, audioTracks });
  const touchDevice = useSyncExternalStore(subscribeCoarsePointer, hasCoarsePointer, hasCoarsePointerOnServer);
  const suppressRef = useRef<() => boolean>(() => false);
  const suppressClick = useCallback(() => suppressRef.current(), []);

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

  // Keyboard focus stays inside an open menu or dialog, and returns to the
  // control that opened it when they close.
  useFocusTrap(settingsPanelRef, showSettings, closeSettings);

  /*
   * Which input device put focus where it is. This is the `:focus-visible`
   * heuristic, tracked ourselves so the behaviour is identical everywhere and
   * testable: keyboard focus pins the chrome open, a click or tap does not.
   */
  const modality = useRef<'keyboard' | 'pointer'>('keyboard');
  const notePointer = useCallback(() => { modality.current = 'pointer'; }, []);
  const noteKeyboard = useCallback(() => { modality.current = 'keyboard'; }, []);

  // A *control* holding keyboard focus must never fade out from under the
  // viewer. Focus on the container itself is only what a click or tap leaves
  // behind — pinning on that would disable auto-hide and tap-to-toggle.
  const handleFocusIn = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget) return;
    if (!target.closest('button, a, input, [role="slider"]')) return;
    // An open menu or dialog always pins, however it was opened.
    const inOverlay = target.closest('.kui-panel, .kui-modal') !== null;
    if (inOverlay || modality.current === 'keyboard') engine.setKeyboardFocus(true);
  }, [engine]);
  const handleFocusOut = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    engine.setKeyboardFocus(false);
  }, [engine]);

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

  /** Pointer x → 0–1 along the bar. Reading layout is fine in a handler. */
  const ratioAt = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    if (rect.width === 0) return null;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const seekToClientX = useCallback((clientX: number) => {
    const ratio = ratioAt(clientX);
    if (ratio !== null) engine.seekByRatio(ratio);
  }, [engine, ratioAt]);

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
    setSeekHoverRatio(ratioAt(e.clientX));
    seekToClientX(e.clientX);
  }, [ratioAt, seekToClientX, setSeekHoverRatio]);

  const handleScrubEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch') setSeekHoverRatio(null);
  }, [setSeekHoverRatio]);

  const handleSeekMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setSeekHoverRatio(ratioAt(e.clientX));
  }, [ratioAt, setSeekHoverRatio]);

  const handleFullscreen = useCallback(() => {
    if (onToggleFullscreen) { onToggleFullscreen(); return; }
    if (containerRef.current) engine.toggleFullscreen(containerRef.current);
  }, [onToggleFullscreen, engine]);

  const handleTogglePip = useCallback(() => { void engine.togglePictureInPicture(); }, [engine]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hoverTime = seekHoverRatio !== null ? formatTime(seekHoverRatio * duration) : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={title ? `Video: ${title}` : 'Video player'}
      className={cn('kui-player', skin ? 'kui-player--skin' : 'kui-player--embedded', className)}
      onMouseMove={() => engine.resetHideTimer()}
      onMouseLeave={() => engine.hideIfPlaying()}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onPointerDownCapture={notePointer}
      onKeyDownCapture={noteKeyboard}
      onClick={skin
        ? (e) => { if (e.target === e.currentTarget && !isCasting && !suppressClick()) engine.togglePlay(); }
        : undefined}
    >
      {children}

      <div className="kui-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {error && <ErrorOverlay error={error} retrying={retrying} onRetry={() => engine.retry()} />}
      {!error && loading && <LoadingOverlay />}
      {!error && !loading && <CenterPlayOverlay playing={playing} />}
      {touchDevice && gestures !== false && (
        <Suspense fallback={null}>
          <GestureLayer
            containerRef={containerRef}
            videoRef={videoRef}
            gestures={gestures}
            enabled={!isCasting}
            suppressRef={suppressRef}
          />
        </Suspense>
      )}
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
            subtitles={subtitles}
            queue={castQueue}
            receiverAppId={castReceiverAppId}
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
            seekHoverRatio={seekHoverRatio}
            hoverTime={hoverTime}
            onSeek={handleSeek}
            onSeekMouseMove={handleSeekMouseMove}
            onSeekLeave={() => setSeekHoverRatio(null)}
            onScrubStart={handleScrubStart}
            onScrubMove={handleScrubMove}
            onScrubEnd={handleScrubEnd}
            onSeekBy={(d) => engine.seekBy(d)}
            onSeekToRatio={(r) => engine.seekByRatio(r)}
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
