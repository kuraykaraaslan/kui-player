import { createContext, useContext, useMemo } from 'react';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';

/**
 * Every string the player can show, including the ones only a screen reader
 * hears. Anything hard-coded in a component is a bug: `aria-label`s carry as
 * much meaning as visible text, and in an RTL locale they carry more.
 */
export type Dictionary = {
  /** Writing direction for this locale; `rtl` also mirrors the control layout. */
  dir?: 'ltr' | 'rtl';
  /** BCP-47 tag, used for `Intl` time formatting. */
  locale?: string;

  videoPlayer: string;
  videoTitled: string;
  play: string;
  pause: string;
  rewind: string;
  forward: string;
  mute: string;
  unmute: string;
  volume: string;
  settings: string;
  pictureInPicture: string;
  exitPictureInPicture: string;
  enterFullscreen: string;
  exitFullscreen: string;
  castToDevice: string;
  stopCasting: string;
  castingTo: string;
  castingToDevice: string;
  airPlay: string;
  seek: string;
  live: string;
  goLive: string;
  behindLive: string;
  timeOf: string;

  quality: string;
  auto: string;
  currently: string;
  playbackSpeed: string;
  normal: string;
  subtitles: string;
  subtitleSize: string;
  subtitleStyle: string;
  audioLanguage: string;
  chapters: string;
  off: string;
  about: string;
  close: string;
  previous: string;
  next: string;

  tryAgain: string;
  retrying: string;
  resumeFrom: string;
  resume: string;
  dismiss: string;
  'shortcut.subtitleEarlier': string;
  'shortcut.subtitleLater': string;
  subtitleDelay: string;
  resetDelay: string;
  frameTools: string;
  goToFrame: string;
  frame: string;
  copyTimecode: string;
  loopA: string;
  loopB: string;
  loopClear: string;
  loopRepeat: string;
  loopForever: string;
  loopTimes: string;
  translateTo: string;
  autoTranslation: string;
  translationDownloading: string;
  translationDownload: string;
  pipPlaying: string;
  audioDescription: string;
  on: string;
  signLanguageVideo: string;
  secondSubtitle: string;
  miniReturn: string;
  miniClose: string;
  skipIntro: string;
  skipRecap: string;
  'shortcut.skip': string;
  'shortcut.prevChapter': string;
  'shortcut.nextChapter': string;
  stats: string;
  copy: string;
  copied: string;
  'stats.adapter': string;
  'stats.resolution': string;
  'stats.bitrate': string;
  'stats.avgBitrate': string;
  'stats.bandwidth': string;
  'stats.codec': string;
  'stats.buffer': string;
  'stats.dropped': string;
  'stats.stalls': string;
  'stats.switches': string;
  'stats.latency': string;
  'shortcut.stats': string;
  shortcuts: string;
  'shortcut.playPause': string;
  'shortcut.seekBack': string;
  'shortcut.seekForward': string;
  'shortcut.volumeUp': string;
  'shortcut.volumeDown': string;
  'shortcut.mute': string;
  'shortcut.fullscreen': string;
  'shortcut.pip': string;
  'shortcut.captions': string;
  'shortcut.percent': string;
  'shortcut.frameBack': string;
  'shortcut.frameForward': string;
  'shortcut.slower': string;
  'shortcut.faster': string;
  'shortcut.start': string;
  'shortcut.end': string;
  'shortcut.help': string;
  shareFromHere: string;
  linkCopied: string;
  linkCopyFailed: string;
  playingNext: string;
  cancel: string;

  /** Error text, keyed by `PlayerError.name`. */
  'error.MEDIA_ERR_ABORTED': string;
  'error.MEDIA_ERR_NETWORK': string;
  'error.MEDIA_ERR_DECODE': string;
  'error.MEDIA_ERR_SRC_NOT_SUPPORTED': string;
  'error.MEDIA_ERR_UNKNOWN': string;
  'error.DRM_UNSUPPORTED': string;
  'error.DRM_LICENSE_DENIED': string;
  'error.DRM_LICENSE_NETWORK': string;
  'error.DRM_OUTPUT_RESTRICTED': string;

  /** Announcements for the live region. */
  'state.playing': string;
  'state.paused': string;
  'state.muted': string;
  'state.unmuted': string;
  'state.fullscreen': string;
  'state.exitedFullscreen': string;
  'state.pip': string;
  'state.exitedPip': string;
  'state.speed': string;
  'state.normalSpeed': string;
  'state.volume': string;
  'state.quality': string;
  'state.subtitles': string;
  'state.audio': string;
  'state.error': string;
  'state.recovered': string;
  'state.duration': string;
};

export type PartialDictionary = Partial<Dictionary>;

/** The default locale. Any other dictionary is merged over this one. */
export const en: Dictionary = {
  dir: 'ltr',
  locale: 'en',

  videoPlayer: 'Video player',
  videoTitled: 'Video: {title}',
  play: 'Play',
  pause: 'Pause',
  rewind: 'Rewind {seconds} seconds',
  forward: 'Forward {seconds} seconds',
  mute: 'Mute',
  unmute: 'Unmute',
  volume: 'Volume',
  settings: 'Settings',
  pictureInPicture: 'Picture-in-Picture',
  exitPictureInPicture: 'Exit Picture-in-Picture',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  castToDevice: 'Cast to device',
  stopCasting: 'Stop casting',
  castingTo: 'Casting to {device}',
  castingToDevice: 'Casting to device',
  airPlay: 'AirPlay',
  seek: 'Seek',
  live: 'LIVE',
  goLive: 'Go to live edge',
  behindLive: '{time} behind live',
  timeOf: '{current} of {total}',

  quality: 'Quality',
  auto: 'Auto',
  currently: 'currently {label}',
  playbackSpeed: 'Playback Speed',
  normal: 'Normal',
  subtitles: 'Subtitles',
  subtitleSize: 'Subtitle Size',
  subtitleStyle: 'Subtitle Style',
  audioLanguage: 'Audio Language',
  chapters: 'Chapters',
  off: 'Off',
  about: 'About',
  close: 'Close',
  previous: 'Previous',
  next: 'Next',

  tryAgain: 'Try again',
  retrying: 'Retrying…',
  resumeFrom: 'Resume from {time}?',
  resume: 'Resume',
  dismiss: 'Dismiss',
  'shortcut.subtitleEarlier': "Subtitles earlier (−0.1 s)",
  'shortcut.subtitleLater': "Subtitles later (+0.1 s)",
  subtitleDelay: "Subtitle delay: {value}",
  resetDelay: "Reset subtitle delay ({value})",
  frameTools: "Frame tools",
  goToFrame: "Go to frame or timecode",
  frame: "Frame",
  copyTimecode: "Copy timecode",
  loopA: "Set loop start (A)",
  loopB: "Set loop end (B)",
  loopClear: "Clear loop",
  loopRepeat: "Repeat",
  loopForever: "Forever",
  loopTimes: "{n}×",
  translateTo: "Translate to {language}",
  autoTranslation: "Automatic translation",
  translationDownloading: "Downloading language model… {percent}%",
  translationDownload: "downloads a language model once",
  pipPlaying: "Playing in picture-in-picture",
  audioDescription: "Audio description",
  on: "On",
  signLanguageVideo: "Sign language video",
  secondSubtitle: "Second language",
  miniReturn: "Back to the video",
  miniClose: "Close mini player",
  skipIntro: "Skip intro",
  skipRecap: "Skip recap",
  'shortcut.skip': "Skip intro / recap",
  'shortcut.prevChapter': "Previous chapter",
  'shortcut.nextChapter': "Next chapter",
  stats: "Technical info",
  copy: "Copy",
  copied: "Copied",
  'stats.adapter': "Adapter",
  'stats.resolution': "Resolution",
  'stats.bitrate': "Bitrate",
  'stats.avgBitrate': "Average bitrate",
  'stats.bandwidth': "Bandwidth",
  'stats.codec': "Codec",
  'stats.buffer': "Buffer ahead",
  'stats.dropped': "Dropped frames",
  'stats.stalls': "Stalls",
  'stats.switches': "Quality switches",
  'stats.latency': "Latency behind live",
  'shortcut.stats': "Technical info",
  shortcuts: "Keyboard shortcuts",
  'shortcut.playPause': "Play / pause",
  'shortcut.seekBack': "Back 10 s",
  'shortcut.seekForward': "Forward 10 s",
  'shortcut.volumeUp': "Volume up",
  'shortcut.volumeDown': "Volume down",
  'shortcut.mute': "Mute",
  'shortcut.fullscreen': "Fullscreen",
  'shortcut.pip': "Picture-in-picture",
  'shortcut.captions': "Subtitles on / off",
  'shortcut.percent': "Jump to 0–90 %",
  'shortcut.frameBack': "Previous frame (paused)",
  'shortcut.frameForward': "Next frame (paused)",
  'shortcut.slower': "Slower",
  'shortcut.faster': "Faster",
  'shortcut.start': "Start",
  'shortcut.end': "End",
  'shortcut.help': "This list",
  shareFromHere: 'Share from here',
  linkCopied: 'Link copied',
  linkCopyFailed: 'Could not copy the link',
  playingNext: 'Next in {seconds}s: {title}',
  cancel: 'Cancel',

  'error.MEDIA_ERR_ABORTED': 'Playback was aborted before the video could load.',
  'error.MEDIA_ERR_NETWORK': 'A network error interrupted the video download.',
  'error.MEDIA_ERR_DECODE': 'The video could not be decoded — the file may be corrupt.',
  'error.MEDIA_ERR_SRC_NOT_SUPPORTED': 'This video is unavailable or its format is not supported.',
  'error.MEDIA_ERR_UNKNOWN': 'The video could not be played.',
  'error.DRM_UNSUPPORTED': "This browser can't play protected video. Try Chrome, Edge or Firefox on a computer or Android device.",
  'error.DRM_LICENSE_DENIED': "You don't have access to this video, or your access has expired.",
  'error.DRM_LICENSE_NETWORK': "The license for this video could not be fetched. Check your connection and try again.",
  'error.DRM_OUTPUT_RESTRICTED': "This video can't play on the connected display (output protection).",

  'state.playing': 'Playing',
  'state.paused': 'Paused',
  'state.muted': 'Muted',
  'state.unmuted': 'Unmuted',
  'state.fullscreen': 'Fullscreen',
  'state.exitedFullscreen': 'Exited fullscreen',
  'state.pip': 'Picture in picture',
  'state.exitedPip': 'Left picture in picture',
  'state.speed': 'Speed {rate} times',
  'state.normalSpeed': 'Normal speed',
  'state.volume': 'Volume {percent} percent',
  'state.quality': 'Quality {label}',
  'state.subtitles': 'Subtitles {label}',
  'state.audio': 'Audio {label}',
  'state.error': 'Error: {message}',
  'state.recovered': 'Playback recovered',
  'state.duration': 'Duration {time}',
};

export type TranslateFn = (key: keyof Dictionary, params?: Record<string, string | number>) => string;

const DictionaryContext = createContext<Dictionary>(en);

export function I18nProvider({ value, children }: { value: Dictionary; children: React.ReactNode }) {
  return <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;
}

/** Merge a partial dictionary over English, so a locale may translate a subset. */
export function resolveDictionary(locale?: PartialDictionary): Dictionary {
  if (!locale) return en;
  return { ...en, ...locale };
}

export function useDictionary(): Dictionary {
  return useContext(DictionaryContext);
}

export function useTranslate(): TranslateFn {
  const dictionary = useDictionary();
  return useMemo(
    () => (key, params) => {
      const template = dictionary[key];
      if (typeof template !== 'string') return String(key);
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        (name in params ? String(params[name]) : match));
    },
    [dictionary],
  );
}

/**
 * `formatTime` bound to the active locale, so durations use the locale's
 * numbering system rather than always Western digits.
 */
export function useFormatTime(): (seconds: number) => string {
  const { locale } = useDictionary();
  return useMemo(() => (seconds: number) => formatTime(seconds, locale), [locale]);
}
