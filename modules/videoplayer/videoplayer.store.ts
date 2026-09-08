import { createStore, type StoreApi } from './store.js';
import type {
  AudioTrackOption, CastState, PlayerError, QualityOption, SettingsView,
  SubtitleEdge, SubtitleFont, SubtitleFontSize,
} from './videoplayer.types.js';

export type VideoPlayerState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  speed: number;
  loading: boolean;
  seeking: boolean;
  /** Last fatal media error, or `null` while playback is healthy. */
  error: PlayerError | null;
  /** True while an automatic (backed-off) retry is pending. */
  retrying: boolean;
  isFullscreen: boolean;
  /** True while fullscreen is emulated (iOS Safari has no element fullscreen). */
  fakeFullscreen: boolean;
  isPip: boolean;
  /** True while the source has no fixed duration. */
  isLive: boolean;
  /** Playing at (or within seconds of) the live edge. */
  atLiveEdge: boolean;
  /** Start of the seekable window, and its length — the DVR buffer. */
  dvrStart: number;
  dvrWindow: number;
  /** Whether the element can offer AirPlay at all, and whether a target exists. */
  airPlaySupported: boolean;
  airPlayAvailable: boolean;
  /** True while playback has been handed to an AirPlay target. */
  airPlaying: boolean;
  /** Whether the attached element can enter Picture-in-Picture at all. */
  pipSupported: boolean;
  showControls: boolean;
  /** Where the pointer is hovering the seek bar, as a 0–1 ratio of its width. */
  seekHoverRatio: number | null;
  showSettings: boolean;
  settingsView: SettingsView;
  selectedQuality: string;
  /** Renditions discovered by a media adapter — empty when playback is not adaptive. */
  adaptiveQualities: QualityOption[];
  /** True while the adapter's ABR logic is choosing the rendition. */
  qualityAuto: boolean;
  /** Label of the rendition actually playing, shown next to "Auto". */
  activeQualityLabel: string | null;
  selectedSubtitle: number | null;
  selectedAudioTrack: number;
  /** Audio renditions discovered from the element or an adapter. */
  adaptiveAudioTracks: AudioTrackOption[];
  subtitleFontSize: SubtitleFontSize;
  subtitleColor: string;
  /** Backdrop opacity behind the cue text, 0–1. */
  subtitleBackground: number;
  subtitleEdge: SubtitleEdge;
  subtitleFont: SubtitleFont;
  castState: CastState;
  castDeviceName: string | null;
  /** Human-readable reason the last Cast attempt failed. */
  castError: string | null;
  /** Position in the Cast queue, and its length; both `0` when not queued. */
  castQueueIndex: number;
  castQueueLength: number;
};

export type VideoPlayerActions = {
  setPlaying:            (v: boolean) => void;
  setCurrentTime:        (v: number) => void;
  setDuration:           (v: number) => void;
  setBuffered:           (v: number) => void;
  setVolume:             (v: number) => void;
  setMuted:              (v: boolean) => void;
  setSpeed:              (v: number) => void;
  setLoading:            (v: boolean) => void;
  setSeeking:            (v: boolean) => void;
  setError:              (v: PlayerError | null) => void;
  setRetrying:           (v: boolean) => void;
  setIsFullscreen:       (v: boolean) => void;
  setFakeFullscreen:     (v: boolean) => void;
  setIsPip:              (v: boolean) => void;
  setIsLive:             (v: boolean) => void;
  setAtLiveEdge:         (v: boolean) => void;
  setDvrWindow:          (start: number, window: number) => void;
  setAirPlaySupported:   (v: boolean) => void;
  setAirPlayAvailable:   (v: boolean) => void;
  setAirPlaying:         (v: boolean) => void;
  setPipSupported:       (v: boolean) => void;
  setShowControls:       (v: boolean) => void;
  setSeekHoverRatio:     (v: number | null) => void;
  setShowSettings:       (v: boolean) => void;
  setSettingsView:       (v: SettingsView) => void;
  setSelectedQuality:    (v: string) => void;
  setAdaptiveQualities:  (v: QualityOption[]) => void;
  setQualityAuto:        (v: boolean) => void;
  setActiveQualityLabel: (v: string | null) => void;
  setSelectedSubtitle:   (v: number | null) => void;
  setSelectedAudioTrack: (v: number) => void;
  setAdaptiveAudioTracks:(v: AudioTrackOption[]) => void;
  setSubtitleFontSize:   (v: SubtitleFontSize) => void;
  setSubtitleColor:      (v: string) => void;
  setSubtitleBackground: (v: number) => void;
  setSubtitleEdge:       (v: SubtitleEdge) => void;
  setSubtitleFont:       (v: SubtitleFont) => void;
  setCastState:          (v: CastState) => void;
  setCastDeviceName:     (v: string | null) => void;
  setCastError:          (v: string | null) => void;
  setCastQueue:          (index: number, length: number) => void;
};

export type VideoPlayerStore = VideoPlayerState & VideoPlayerActions;
export type VideoPlayerStoreApi = StoreApi<VideoPlayerStore>;

type InitOpts = {
  defaultQuality?: string;
  startMuted?: boolean;
};

export function createVideoPlayerStore(opts: InitOpts = {}): VideoPlayerStoreApi {
  return createStore<VideoPlayerStore>((set) => ({
    playing: false,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: opts.startMuted ? 0 : 1,
    muted: opts.startMuted ?? false,
    speed: 1,
    loading: true,
    seeking: false,
    error: null,
    retrying: false,
    isFullscreen: false,
    fakeFullscreen: false,
    isPip: false,
    isLive: false,
    atLiveEdge: false,
    dvrStart: 0,
    dvrWindow: 0,
    airPlaySupported: false,
    airPlayAvailable: false,
    airPlaying: false,
    pipSupported: false,
    showControls: true,
    seekHoverRatio: null,
    showSettings: false,
    settingsView: 'main',
    selectedQuality: opts.defaultQuality ?? '',
    adaptiveQualities: [],
    qualityAuto: false,
    activeQualityLabel: null,
    selectedSubtitle: null,
    selectedAudioTrack: 0,
    adaptiveAudioTracks: [],
    subtitleFontSize: 'md',
    subtitleColor: '#ffffff',
    subtitleBackground: 0.8,
    subtitleEdge: 'none',
    subtitleFont: 'sans',
    castState: 'unavailable',
    castDeviceName: null,
    castError: null,
    castQueueIndex: 0,
    castQueueLength: 0,

    setPlaying:            (v) => set({ playing: v }),
    setCurrentTime:        (v) => set({ currentTime: v }),
    setDuration:           (v) => set({ duration: v }),
    setBuffered:           (v) => set({ buffered: v }),
    setVolume:             (v) => set({ volume: v }),
    setMuted:              (v) => set({ muted: v }),
    setSpeed:              (v) => set({ speed: v }),
    setLoading:            (v) => set({ loading: v }),
    setSeeking:            (v) => set({ seeking: v }),
    setError:              (v) => set({ error: v }),
    setRetrying:           (v) => set({ retrying: v }),
    setIsFullscreen:       (v) => set({ isFullscreen: v }),
    setFakeFullscreen:     (v) => set({ fakeFullscreen: v }),
    setIsPip:              (v) => set({ isPip: v }),
    setIsLive:             (v) => set({ isLive: v }),
    setAtLiveEdge:         (v) => set({ atLiveEdge: v }),
    setDvrWindow:          (start, window) => set({ dvrStart: start, dvrWindow: window }),
    setAirPlaySupported:   (v) => set({ airPlaySupported: v }),
    setAirPlayAvailable:   (v) => set({ airPlayAvailable: v }),
    setAirPlaying:         (v) => set({ airPlaying: v }),
    setPipSupported:       (v) => set({ pipSupported: v }),
    setShowControls:       (v) => set({ showControls: v }),
    setSeekHoverRatio:     (v) => set({ seekHoverRatio: v }),
    setShowSettings:       (v) => set({ showSettings: v }),
    setSettingsView:       (v) => set({ settingsView: v }),
    setSelectedQuality:    (v) => set({ selectedQuality: v }),
    setAdaptiveQualities:  (v) => set({ adaptiveQualities: v }),
    setQualityAuto:        (v) => set({ qualityAuto: v }),
    setActiveQualityLabel: (v) => set({ activeQualityLabel: v }),
    setSelectedSubtitle:   (v) => set({ selectedSubtitle: v }),
    setSelectedAudioTrack: (v) => set({ selectedAudioTrack: v }),
    setAdaptiveAudioTracks:(v) => set({ adaptiveAudioTracks: v }),
    setSubtitleFontSize:   (v) => set({ subtitleFontSize: v }),
    setSubtitleColor:      (v) => set({ subtitleColor: v }),
    setSubtitleBackground: (v) => set({ subtitleBackground: v }),
    setSubtitleEdge:       (v) => set({ subtitleEdge: v }),
    setSubtitleFont:       (v) => set({ subtitleFont: v }),
    setCastState:          (v) => set({ castState: v }),
    setCastDeviceName:     (v) => set({ castDeviceName: v }),
    setCastError:          (v) => set({ castError: v }),
    setCastQueue:          (index, length) => set({ castQueueIndex: index, castQueueLength: length }),
  }));
}
