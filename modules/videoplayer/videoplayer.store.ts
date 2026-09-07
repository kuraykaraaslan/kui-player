import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
  AudioTrackOption, CastState, PlayerError, QualityOption, SettingsView, SubtitleFontSize,
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
  castState: CastState;
  castDeviceName: string | null;
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
  setCastState:          (v: CastState) => void;
  setCastDeviceName:     (v: string | null) => void;
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
    castState: 'unavailable',
    castDeviceName: null,

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
    setCastState:          (v) => set({ castState: v }),
    setCastDeviceName:     (v) => set({ castDeviceName: v }),
  }));
}
