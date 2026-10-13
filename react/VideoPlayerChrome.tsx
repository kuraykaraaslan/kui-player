import {
  Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type DragEvent, type ReactNode, type RefObject,
} from 'react';
import { cn } from '../libs/utils/cn.js';
import { useVideoPlayerEngine } from './hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from './hooks/useVideoPlayerStore.js';
import { ControlRow } from './parts/ControlRow.js';
import { ProgressBar } from './parts/ProgressBar.js';
import {
  ErrorOverlay, LoadingOverlay, CenterPlayOverlay, SubtitleOverlay,
} from './parts/Overlays.js';
import { AUTO_QUALITY_VALUE } from '../modules/videoplayer/adapters/adapter.types.js';
import { useDictionary, useFormatTime, useTranslate } from './i18n/index.js';
import type { Chapter, StoryboardTile } from '../modules/videoplayer/videoplayer.vtt.js';
import { useSubtitleCues } from './hooks/useSubtitleCues.js';
import { pickDescriptionTrack, pickMainTrack } from '../modules/videoplayer/videoplayer.audiokind.js';
import { createPortal } from 'react-dom';
import { useDocumentPip } from './hooks/useDocumentPip.js';
import { adSpans } from '../modules/videoplayer/videoplayer.adbreaks.js';
import { miniEnabled, type MiniOptions } from '../modules/videoplayer/videoplayer.mini.js';
import { useMiniPlayer } from './hooks/useMiniPlayer.js';
import type { SkipOptions } from './parts/SkipController.js';
import { buildKeymap, type ShortcutOverrides } from '../modules/videoplayer/videoplayer.shortcuts.js';
import { Icon } from './icons/index.js';
import { formatSubtitleOffset } from '../modules/videoplayer/videoplayer.subtitles.js';
import { useTranslatedCues, useTranslationTargets } from './hooks/useTranslatedCues.js';
import { useSecondaryCues } from './hooks/useSecondaryCues.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useFocusTrap } from './hooks/useFocusTrap.js';
import { usePlayerAnnouncements } from './hooks/usePlayerAnnouncements.js';
import type { CastApi } from './parts/CastController.js';

// Split out of the main chunk: the settings menu and the About dialog are only
// reachable after a click, and the Cast SDK plumbing never loads at all unless
// `enableCast` is on.
const SettingsPanel = lazy(() => import('./parts/SettingsPanel.js').then((m) => ({ default: m.SettingsPanel })));
const SkipController = lazy(() => import('./parts/SkipController.js'));
const WaveformLoader = lazy(() => import('./parts/WaveformLoader.js'));
const Transcript = lazy(() => import('./parts/Transcript.js'));
const SubtitleSearch = lazy(() => import('./parts/SubtitleSearch.js'));
const StatsPanel = lazy(() => import('./parts/StatsPanel.js'));
const ShortcutsHelp = lazy(() => import('./parts/ShortcutsHelp.js'));
const AboutModal = lazy(() => import('./parts/AboutModal.js').then((m) => ({ default: m.AboutModal })));
const CastController = lazy(() => import('./parts/CastController.js'));
const GestureLayer = lazy(() => import('./parts/GestureLayer.js'));
const VttLoader = lazy(() => import('./parts/VttLoader.js'));

/** Stable empties, so the fetch hook's identity checks hold. */
const WAVE_BARS = 160;
const MAX_DROPPED_SUBTITLE_BYTES = 5 * 1024 * 1024;
const NO_SKIP_OPTIONS: SkipOptions = {};
const NO_CHAPTERS: Chapter[] = [];
const NO_TILES: StoryboardTile[] = [];

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
  AudioTrackOption, CastQueueItem, CastState, GestureOptions, PlayerSlots, PlayerTheme,
  QualityOption, SubtitleFontSize, SubtitleTrack, VideoSource,
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
  /** A preset token set. Presets are overridable per player like anything else. */
  theme?: PlayerTheme;
  /** Custom nodes placed into named positions in the chrome. */
  slots?: PlayerSlots<ReactNode>;
  /** Overrides the fullscreen button/handler (skin mode supplies a video-aware toggle). */
  onToggleFullscreen?: () => void;

  src?: string | VideoSource | (string | VideoSource)[];
  poster?: string;
  title?: string;
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
  chapters?: string | Chapter[];
  thumbnails?: string;
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
  /** Start with audio description on, when the stream offers a description track. */
  audioDescription?: boolean;
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
  /**
   * Offer on-device translation of the chosen subtitle track into these
   * languages (BCP-47, e.g. `['tr', 'ar']`), shown as the second line. Only where
   * the browser has the `Translator` API (Chromium desktop); otherwise nothing is offered.
   */
  translation?: { targets: string[] };
  /**
   * Picture-in-picture with the controls too (Chromium's Document PiP). Falls back
   * to the plain video PiP where the API is missing. Off by default.
   */
  documentPictureInPicture?: boolean;
  /** Offer to skip intro/recap chapters (default on); `{ autoSkip: true }` skips them unasked. */
  skipSegments?: boolean | SkipOptions;
  /** Remap or disable keys: `{ seekForward: 'l' }`, `{ captions: false }`, or `false` for none. */
  shortcuts?: ShortcutOverrides | false;
  onCastStateChange?: (state: CastState) => void;
  onControlsVisibilityChange?: (visible: boolean) => void;
  className?: string;
}

export function VideoPlayerChrome({
  videoRef, children, skin = false, theme, slots, onToggleFullscreen,
  src = '', poster, title, qualities, subtitles: subtitleProp, audioTracks, chapters, thumbnails,
  onQualityChange, onAudioTrackChange, enableCast = false, castQueue, castReceiverAppId,
  enablePictureInPicture = true,
  gestures = true, autoFullscreenOnLandscape = false, shortcuts, skipSegments = true, miniPlayer = false, audioDescription: audioDescriptionDefault, documentPictureInPicture = false, translation, audioOnly = false, waveform, onCastStateChange,
  onControlsVisibilityChange, className,
}: VideoPlayerChromeProps) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const dictionary = useDictionary();
  const formatTime = useFormatTime();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const toggleStats = useCallback(() => setShowStats((v) => !v), []);
  const keymap = useMemo(() => buildKeymap(shortcuts), [shortcuts]);
  const toggleHelp = useCallback(() => setShowHelp((v) => !v), []);

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
  const isLive            = useVideoPlayerStore(s => s.isLive);
  const atLiveEdge        = useVideoPlayerStore(s => s.atLiveEdge);
  const dvrStart          = useVideoPlayerStore(s => s.dvrStart);
  const dvrWindow         = useVideoPlayerStore(s => s.dvrWindow);
  const airPlaySupported  = useVideoPlayerStore(s => s.airPlaySupported);
  const airPlayAvailable  = useVideoPlayerStore(s => s.airPlayAvailable);
  const airPlaying        = useVideoPlayerStore(s => s.airPlaying);
  const showControls      = useVideoPlayerStore(s => s.showControls);
  const seekHoverRatio    = useVideoPlayerStore(s => s.seekHoverRatio);
  const showSettings      = useVideoPlayerStore(s => s.showSettings);
  const settingsView      = useVideoPlayerStore(s => s.settingsView);
  const selectedQuality   = useVideoPlayerStore(s => s.selectedQuality);
  const adaptiveQualities = useVideoPlayerStore(s => s.adaptiveQualities);
  const activeQualityLabel= useVideoPlayerStore(s => s.activeQualityLabel);
  const adaptiveAudioTracks = useVideoPlayerStore(s => s.adaptiveAudioTracks);
  const selectedSubtitle  = useVideoPlayerStore(s => s.selectedSubtitle);
  const secondarySubtitle = useVideoPlayerStore(s => s.secondarySubtitle);
  const setSecondarySubtitle = useVideoPlayerStore(s => s.setSecondarySubtitle);
  const selectedAudioTrack= useVideoPlayerStore(s => s.selectedAudioTrack);
  const subtitleFontSize  = useVideoPlayerStore(s => s.subtitleFontSize);
  const subtitleColor     = useVideoPlayerStore(s => s.subtitleColor);
  const subtitleBackground= useVideoPlayerStore(s => s.subtitleBackground);
  const subtitleEdge      = useVideoPlayerStore(s => s.subtitleEdge);
  const subtitleFont      = useVideoPlayerStore(s => s.subtitleFont);
  const castState         = useVideoPlayerStore(s => s.castState);
  // Everything else about a Cast session — the overlay, the queue, the error
  // banner — lives in the Cast chunk, which only loads when Cast is enabled.
  const setShowSettings   = useVideoPlayerStore(s => s.setShowSettings);
  const setSettingsView   = useVideoPlayerStore(s => s.setSettingsView);
  const setSelectedQuality   = useVideoPlayerStore(s => s.setSelectedQuality);
  const setSelectedSubtitle  = useVideoPlayerStore(s => s.setSelectedSubtitle);
  const setSubtitleFontSize  = useVideoPlayerStore(s => s.setSubtitleFontSize);
  const setSubtitleColor     = useVideoPlayerStore(s => s.setSubtitleColor);
  const setSubtitleBackground= useVideoPlayerStore(s => s.setSubtitleBackground);
  const setSubtitleEdge      = useVideoPlayerStore(s => s.setSubtitleEdge);
  const setSubtitleFont      = useVideoPlayerStore(s => s.setSubtitleFont);
  const setSeekHoverRatio    = useVideoPlayerStore(s => s.setSeekHoverRatio);

  const isCasting = castState === 'connected';

  // Chapters may be handed over directly or fetched from a WebVTT sidecar; the
  // fetching and parsing live in a chunk that only loads for the latter.
  const chapterUrl = typeof chapters === 'string' ? chapters : undefined;
  const [fetchedChapters, setFetchedChapters] = useState<Chapter[]>(NO_CHAPTERS);
  const [tiles, setTiles] = useState<StoryboardTile[]>(NO_TILES);
  const chapterList = Array.isArray(chapters) ? chapters : fetchedChapters;

  useEffect(() => { engine.setChapters(chapterList); }, [engine, chapterList]);

  const effectiveControls = isCasting || audioOnly
    ? true
    : engine.controlsVisible !== undefined
      ? engine.controlsVisible
      : showControls;

  useEffect(() => { onControlsVisibilityChange?.(effectiveControls); }, [effectiveControls, onControlsVisibilityChange]);

  const castApi = useRef<CastApi | null>(null);
  const onCastApi = useCallback((api: CastApi | null) => { castApi.current = api; }, []);
  const toggleCast = useCallback(() => castApi.current?.toggleCast(), []);
  const subtitleOffset = useVideoPlayerStore(s => s.subtitleOffset);
  const setSubtitleOffset = useVideoPlayerStore(s => s.setSubtitleOffset);
  // A delay fixes one release's timing; a new source starts from zero. Done during
  // render so a remembered value (restored by the persistence controller's effect) lands after it.
  const [offsetSrc, setOffsetSrc] = useState(src);
  if (offsetSrc !== src) { setOffsetSrc(src); setSubtitleOffset(0); }
  const [offsetFlash, setOffsetFlash] = useState(false);
  const [seenOffset, setSeenOffset] = useState(subtitleOffset);
  if (seenOffset !== subtitleOffset) { setSeenOffset(subtitleOffset); setOffsetFlash(true); }
  useEffect(() => {
    if (!offsetFlash) return;
    const id = window.setTimeout(() => setOffsetFlash(false), 2000);
    return () => window.clearTimeout(id);
  }, [offsetFlash, subtitleOffset]);
  // The tracks the page supplied plus any subtitle file the viewer dropped on the player.
  const [dropped, setDropped] = useState<SubtitleTrack[]>([]);
  const droppedRef = useRef<SubtitleTrack[]>([]);
  useEffect(() => { droppedRef.current = dropped; }, [dropped]);
  useEffect(() => () => { droppedRef.current.forEach((track) => URL.revokeObjectURL(track.src)); }, []);
  const subtitles = useMemo(
    () => (dropped.length === 0 ? subtitleProp : [...(subtitleProp ?? []), ...dropped]),
    [subtitleProp, dropped],
  );
  const [showSearch, setShowSearch] = useState(false);
  const [dropping, setDropping] = useState(false);
  const offline = useVideoPlayerStore(s => s.offline);
  const requestOffline = useVideoPlayerStore(s => s.requestOffline);
  const handleOffline = useCallback(() => {
    const s = engine.store.getState().offline.state;
    requestOffline(s === 'downloading' ? 'cancel' : s === 'downloaded' ? 'remove' : 'download');
  }, [engine, requestOffline]);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptTrack = subtitles?.[selectedSubtitle ?? 0];
  const cueText = useSubtitleCues({ videoRef, selectedSubtitle, subtitles, offset: subtitleOffset });
  const secondaryTranslation = useVideoPlayerStore(s => s.secondaryTranslation);
  const setSecondaryTranslation = useVideoPlayerStore(s => s.setSecondaryTranslation);
  const primaryTrack = selectedSubtitle === null ? undefined : subtitles?.[selectedSubtitle];
  const translationTargets = useTranslationTargets(translation?.targets, primaryTrack);
  const translated = useTranslatedCues({ videoRef, source: primaryTrack, target: secondaryTranslation, offset: subtitleOffset });
  const fileSecondaryText = useSecondaryCues({ videoRef, selectedSecondary: secondarySubtitle, subtitles });
  const secondaryText = fileSecondaryText ?? translated.text
    ?? (translated.downloading !== null ? t('translationDownloading', { percent: Math.round(translated.downloading * 100) }) : null);
  const docPip = useDocumentPip({ enabled: documentPictureInPicture && !skin });
  const { toggle: toggleDocPip, setAnchor: setPipAnchor, host: pipHost } = docPip;
  const docPipSupported = docPip.supported;
  const handleTogglePip = useCallback(() => {
    if (docPipSupported) void toggleDocPip(); else void engine.togglePictureInPicture();
  }, [engine, docPipSupported, toggleDocPip]);
  useKeyboardShortcuts({ containerRef, engine, keymap, subtitleCount: subtitles?.length ?? 0, onToggleHelp: toggleHelp, onToggleStats: toggleStats, chapters: chapterList, ownerDocument: docPip.pipDocument ?? undefined, onTogglePip: handleTogglePip });
  const announcement = usePlayerAnnouncements({ qualities, subtitles, audioTracks });
  const touchDevice = useSyncExternalStore(subscribeCoarsePointer, hasCoarsePointer, hasCoarsePointerOnServer);
  // One floating mode at a time: the mini player stands down while the PiP window is open.
  const miniOn = miniEnabled(miniPlayer, touchDevice) && !docPip.active;
  const mini = useMiniPlayer({ enabled: miniOn, skin, playing, fullscreen: isFullscreen });
  const { setContainer: setMiniContainer, setPlaceholder: setMiniPlaceholder } = mini;
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDropping(true);
  }, []);
  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    const file = Array.from(e.dataTransfer.files).find((f) => /\.(srt|vtt|ass|ssa)$/i.test(f.name));
    setDropping(false);
    if (!file) return;   // not a subtitle file: leave it to the page
    e.preventDefault();
    if (file.size > MAX_DROPPED_SUBTITLE_BYTES) return;
    const text = await file.text();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const track: SubtitleTrack = { label: file.name, src: URL.createObjectURL(blob), local: true };
    const index = (subtitleProp?.length ?? 0) + droppedRef.current.length;
    setDropped((list) => [...list, track]);
    setSelectedSubtitle(index);
  }, [subtitleProp, setSelectedSubtitle]);
  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setMiniContainer(el);
  }, [setMiniContainer]);
  const miniCorner = typeof miniPlayer === 'object' ? miniPlayer.corner ?? 'bottom-right' : 'bottom-right';
  const suppressRef = useRef<() => boolean>(() => false);
  const suppressClick = useCallback(() => suppressRef.current(), []);

  // An adapter (hls.js / dash.js) publishes real renditions; when it does they
  // replace the consumer's static `qualities` list and gain an "Auto" entry.
  const adaptive = adaptiveQualities.length > 0;
  const qualityOptions = adaptive
    ? [{ label: t('auto'), value: AUTO_QUALITY_VALUE }, ...adaptiveQualities]
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
    const doc = docPip.pipDocument ?? document;
    doc.addEventListener('mousedown', handler);
    return () => doc.removeEventListener('mousedown', handler);
  }, [showSettings, setShowSettings, setSettingsView, docPip.pipDocument]);

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
  const applySecondary   = useCallback((i: number | null) => {
    setSecondarySubtitle(i);
    if (i === null) setSecondaryTranslation(null);   // "Off" switches the second line off, whichever kind it was
    closeSettings();
  }, [setSecondarySubtitle, setSecondaryTranslation, closeSettings]);
  const applyTranslation = useCallback((code: string | null) => { setSecondaryTranslation(code); closeSettings(); }, [setSecondaryTranslation, closeSettings]);
  const applySubtitle    = useCallback((i: number | null) => { setSelectedSubtitle(i); closeSettings(); }, [setSelectedSubtitle, closeSettings]);
  // Actually switches the rendition (adapter or the element's own track list)
  // instead of only telling the consumer about it.
  const audioDescription = useVideoPlayerStore(s => s.audioDescription);
  const setAudioDescription = useVideoPlayerStore(s => s.setAudioDescription);
  // A one-time default from the prop; the store owns the value afterwards.
  useEffect(() => { if (audioDescriptionDefault) setAudioDescription(true); }, [audioDescriptionDefault, setAudioDescription]);
  const mainTrackRef = useRef<number | null>(null);
  const audioTracksRef = useRef<AudioTrackOption[] | undefined>(undefined);
  const selectedAudioRef = useRef(0);
  useEffect(() => { audioTracksRef.current = effectiveAudioTracks; selectedAudioRef.current = selectedAudioTrack; });

  const applyAudioTrack  = useCallback((i: number) => {
    // Picking a track by hand settles the question the switch asks.
    const picked = audioTracksRef.current?.[i];
    if (picked) setAudioDescription(picked.kind === 'description');
    engine.setAudioTrack(i); onAudioTrackChange?.(i); closeSettings();
  }, [engine, onAudioTrackChange, closeSettings, setAudioDescription]);
  const toggleAudioDescription = useCallback(() => {
    const tracks = audioTracksRef.current ?? [];
    const current = selectedAudioRef.current;
    const to = audioDescription ? pickMainTrack(tracks, current, mainTrackRef.current) : pickDescriptionTrack(tracks, current);
    if (to === null) return;
    if (!audioDescription) mainTrackRef.current = current;
    setAudioDescription(!audioDescription);
    engine.setAudioTrack(to);
    onAudioTrackChange?.(to);
    closeSettings();
  }, [audioDescription, engine, onAudioTrackChange, closeSettings, setAudioDescription]);

  // A preference (prop or remembered) that arrives before the tracks do is
  // honoured as soon as a description track exists.
  useEffect(() => {
    const tracks = effectiveAudioTracks;
    if (!audioDescription || !tracks) return;
    const current = selectedAudioRef.current;
    if (tracks[current]?.kind === 'description') return;
    const to = pickDescriptionTrack(tracks, current);
    if (to === null) return;
    mainTrackRef.current = current;
    engine.setAudioTrack(to);
  // Only when the track list changes; later manual picks must not be fought.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAudioTracks]);
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



  // For a live stream the bar spans the DVR window, not 0…duration.
  const progress = isLive && dvrWindow > 0
    ? Math.max(0, Math.min(100, ((currentTime - dvrStart) / dvrWindow) * 100))
    : duration > 0 ? (currentTime / duration) * 100 : 0;
  const liveLatency = isLive && dvrWindow > 0
    ? Math.max(0, dvrWindow - (currentTime - dvrStart)) : null;
  const adBreaks = useVideoPlayerStore(s => s.adBreaks);
  const adSpanList = adSpans(adBreaks, isLive && dvrWindow > 0 ? dvrStart : 0, isLive && dvrWindow > 0 ? dvrWindow : duration);
  const loopRange = useVideoPlayerStore(s => s.loopRange);
  const loopSpan = loopRange && duration > 0
    ? adSpans([{ id: 'loop', start: loopRange.a, end: loopRange.b, duration: null, source: 'cue-out' }], 0, duration)[0] ?? null
    : null;
  const hoverTime = seekHoverRatio !== null ? formatTime(seekHoverRatio * duration) : null;

  const pipEnabled = documentPictureInPicture && !skin;
  const miniPlaceholder = mini.floating && (
    <div ref={setMiniPlaceholder} className="kui-mini-placeholder" style={{ height: mini.placeholderHeight }} aria-hidden="true" />
  );
  const playerTree = (
    <div
      ref={containerCallbackRef}
      tabIndex={0}
      aria-label={title ? t('videoTitled', { title }) : t('videoPlayer')}
      dir={dictionary.dir ?? 'ltr'}
      className={cn('kui-player', skin ? 'kui-player--skin' : 'kui-player--embedded', audioOnly && 'kui-player--audio', mini.floating && 'is-mini', dropping && 'is-dropping', className)}
      data-kui-mini={mini.floating ? miniCorner : undefined}
      data-kui-theme={theme}
      onMouseMove={() => engine.resetHideTimer()}
      onMouseLeave={() => engine.hideIfPlaying()}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={handleDrop}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onPointerDownCapture={notePointer}
      onKeyDownCapture={noteKeyboard}
      onClick={skin
        ? (e) => { if (e.target === e.currentTarget && !isCasting && !suppressClick()) engine.togglePlay(); }
        : undefined}
    >
      {children}

      {audioOnly && (
        <>
          {!showTranscript && poster && <img className="kui-artwork" src={poster} alt="" />}
          {showTranscript && transcriptTrack && (
            <Suspense fallback={null}>
              <Transcript src={transcriptTrack.src} offset={subtitleOffset} />
            </Suspense>
          )}
          {transcriptTrack && (
            <button
              type="button"
              className="kui-btn-outline kui-transcript-toggle"
              aria-pressed={showTranscript}
              onClick={() => setShowTranscript((v) => !v)}
            >
              {t('transcript')}
            </button>
          )}
        </>
      )}

      {waveform !== undefined && (
        <Suspense fallback={null}>
          <WaveformLoader waveform={waveform} src={typeof src === 'string' ? src : ''} buckets={WAVE_BARS} onPeaks={setPeaks} />
        </Suspense>
      )}

      {mini.floating && (
        <div className="kui-mini-bar">
          <button type="button" className="kui-mini-btn" onClick={() => engine.togglePlay()} aria-label={playing ? t('pause') : t('play')}>
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button type="button" className="kui-mini-btn" onClick={mini.giveBack} aria-label={t('miniReturn')}>
            <Icon name="expand" />
          </button>
          <button
            type="button"
            className="kui-mini-btn"
            onClick={() => { engine.pause(); mini.dismiss(); }}
            aria-label={t('miniClose')}
          >
            <Icon name="close" />
          </button>
        </div>
      )}

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
      {offsetFlash && selectedSubtitle !== null && (
        <div className="kui-sub-offset" role="status">{t('subtitleDelay', { value: formatSubtitleOffset(subtitleOffset) })}</div>
      )}

      {(cueText || secondaryText) && (
        <SubtitleOverlay
          cueText={cueText}
          secondaryText={secondaryText}
          effectiveControls={effectiveControls}
          subtitleFontSize={subtitleFontSize}
          color={subtitleColor}
          background={subtitleBackground}
          edge={subtitleEdge}
          font={subtitleFont}
        />
      )}

      {(chapterUrl || thumbnails) && (
        <Suspense fallback={null}>
          <VttLoader
            chaptersUrl={chapterUrl}
            thumbnailsUrl={thumbnails}
            onChapters={setFetchedChapters}
            onTiles={setTiles}
          />
        </Suspense>
      )}

      {enableCast && (
        <Suspense fallback={null}>
          <CastController
            videoRef={videoRef}
            src={src}
            title={title}
            poster={poster}
            subtitles={subtitleProp}
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
        {slots?.top && <div className="kui-slot kui-slot--top">{slots.top}</div>}
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsPanel
              ref={settingsPanelRef}
              view={settingsView}
              onChangeView={setSettingsView}
              onAbout={() => { setShowAbout(true); closeSettings(); }}
              qualities={qualityOptions}
              chapters={chapterList}
              onSeekTo={(time) => { engine.seek(time); closeSettings(); }}
              subtitles={subtitles}
              audioTracks={effectiveAudioTracks}
              selectedQuality={selectedQuality}
              activeQualityLabel={activeQualityLabel}
              selectedSubtitle={selectedSubtitle}
              secondarySubtitle={secondarySubtitle}
              secondaryTranslation={secondaryTranslation}
              translationTargets={translationTargets}
              applyTranslation={applyTranslation}
              selectedAudioTrack={selectedAudioTrack}
              speed={speed}
              subtitleFontSize={subtitleFontSize}
              subtitleColor={subtitleColor}
              subtitleBackground={subtitleBackground}
              subtitleEdge={subtitleEdge}
              subtitleFont={subtitleFont}
              applyQuality={applyQuality}
              applySpeed={applySpeed}
              applySubtitle={applySubtitle}
              offline={offline}
              onOffline={handleOffline}
              onSearchSubtitles={() => { setShowSearch(true); closeSettings(); }}
              subtitleOffset={subtitleOffset}
              resetSubtitleOffset={() => { setSubtitleOffset(0); closeSettings(); }}
              applySecondary={applySecondary}
              applySubtitleSize={applySubtitleSize}
              applyAudioTrack={applyAudioTrack}
              audioDescription={audioDescription}
              onToggleAudioDescription={toggleAudioDescription}
              applySubtitleColor={setSubtitleColor}
              applySubtitleBackground={setSubtitleBackground}
              applySubtitleEdge={setSubtitleEdge}
              applySubtitleFont={setSubtitleFont}
            />
          </Suspense>
        )}
        <div className="kui-controls">
          {slots?.aboveControls}
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
            duration={duration}
            hoverSeconds={seekHoverRatio === null
              ? null
              : (isLive && dvrWindow > 0 ? dvrStart + seekHoverRatio * dvrWindow : seekHoverRatio * duration)}
            chapters={chapterList}
            adSpans={adSpanList}
            peaks={peaks}
            loopSpan={loopSpan}
            tiles={tiles}
            valueText={isLive
              ? (atLiveEdge
                ? t('live')
                : t('behindLive', { time: formatTime(Math.max(0, dvrWindow - (currentTime - dvrStart))) }))
              : t('timeOf', { current: formatTime(currentTime), total: formatTime(duration) })}
          />
          <ControlRow
            slotStart={slots?.controlsStart}
            slotEnd={slots?.controlsEnd}
            playing={playing}
            muted={muted}
            volume={volume}
            currentTime={currentTime}
            duration={duration}
            isFullscreen={isFullscreen}
            showSettings={showSettings}
            enableCast={enableCast}
            castState={castState}
            showPip={enablePictureInPicture && (pipSupported || docPipSupported)}
            isPip={isPip || docPip.active}
            onTogglePip={handleTogglePip}
            showAirPlay={airPlaySupported && airPlayAvailable}
            isAirPlaying={airPlaying}
            onAirPlay={() => engine.showAirPlayPicker()}
            isLive={isLive}
            atLiveEdge={atLiveEdge}
            liveLatency={liveLatency}
            onGoLive={() => engine.seekToLive()}
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

      {skipSegments && chapterList.length > 0 && (
        <Suspense fallback={null}>
          <SkipController chapters={chapterList} options={skipSegments === true ? NO_SKIP_OPTIONS : skipSegments} />
        </Suspense>
      )}

      {showSearch && primaryTrack && (
        <Suspense fallback={null}>
          <SubtitleSearch
            src={primaryTrack.src}
            offset={subtitleOffset}
            onSeek={(time) => engine.seek(time)}
            onClose={() => setShowSearch(false)}
          />
        </Suspense>
      )}

      {showStats && (
        <Suspense fallback={null}>
          <StatsPanel onClose={() => setShowStats(false)} />
        </Suspense>
      )}

      {showHelp && (
        <Suspense fallback={null}>
          <ShortcutsHelp keymap={keymap} onClose={() => setShowHelp(false)} />
        </Suspense>
      )}

      {showAbout && (
        <Suspense fallback={null}>
          <AboutModal open onClose={() => setShowAbout(false)} />
        </Suspense>
      )}
    </div>
  );

  return (
    <>
      {docPip.active && (
        <div className="kui-pip-placeholder" style={{ height: docPip.placeholderHeight }} role="status">
          {t('pipPlaying')}
        </div>
      )}
      {miniPlaceholder}
      {pipEnabled
        ? (
          <>
            <div ref={setPipAnchor} style={{ display: 'contents' }} />
            {pipHost && createPortal(playerTree, pipHost)}
          </>
        )
        : playerTree}
    </>
  );
}
