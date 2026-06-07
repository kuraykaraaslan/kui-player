import { createStore, type StoreApi } from 'zustand/vanilla';
import type { CastState, SettingsView, SubtitleFontSize } from './videoplayer.types';

export type VideoPlayerState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  speed: number;
  loading: boolean;
  isFullscreen: boolean;
  showControls: boolean;
  seekHoverX: number | null;
  showSettings: boolean;
  settingsView: SettingsView;
  selectedQuality: string;
  selectedSubtitle: number | null;
  selectedAudioTrack: number;
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
  setIsFullscreen:       (v: boolean) => void;
  setShowControls:       (v: boolean) => void;
  setSeekHoverX:         (v: number | null) => void;
  setShowSettings:       (v: boolean) => void;
  setSettingsView:       (v: SettingsView) => void;
  setSelectedQuality:    (v: string) => void;
  setSelectedSubtitle:   (v: number | null) => void;
  setSelectedAudioTrack: (v: number) => void;
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
    isFullscreen: false,
    showControls: true,
    seekHoverX: null,
    showSettings: false,
    settingsView: 'main',
    selectedQuality: opts.defaultQuality ?? '',
    selectedSubtitle: null,
    selectedAudioTrack: 0,
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
    setIsFullscreen:       (v) => set({ isFullscreen: v }),
    setShowControls:       (v) => set({ showControls: v }),
    setSeekHoverX:         (v) => set({ seekHoverX: v }),
    setShowSettings:       (v) => set({ showSettings: v }),
    setSettingsView:       (v) => set({ settingsView: v }),
    setSelectedQuality:    (v) => set({ selectedQuality: v }),
    setSelectedSubtitle:   (v) => set({ selectedSubtitle: v }),
    setSelectedAudioTrack: (v) => set({ selectedAudioTrack: v }),
    setSubtitleFontSize:   (v) => set({ subtitleFontSize: v }),
    setCastState:          (v) => set({ castState: v }),
    setCastDeviceName:     (v) => set({ castDeviceName: v }),
  }));
}
