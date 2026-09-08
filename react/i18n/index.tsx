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
  playingNext: string;
  cancel: string;

  /** Error text, keyed by `PlayerError.name`. */
  'error.MEDIA_ERR_ABORTED': string;
  'error.MEDIA_ERR_NETWORK': string;
  'error.MEDIA_ERR_DECODE': string;
  'error.MEDIA_ERR_SRC_NOT_SUPPORTED': string;
  'error.MEDIA_ERR_UNKNOWN': string;

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
  playingNext: 'Next in {seconds}s: {title}',
  cancel: 'Cancel',

  'error.MEDIA_ERR_ABORTED': 'Playback was aborted before the video could load.',
  'error.MEDIA_ERR_NETWORK': 'A network error interrupted the video download.',
  'error.MEDIA_ERR_DECODE': 'The video could not be decoded — the file may be corrupt.',
  'error.MEDIA_ERR_SRC_NOT_SUPPORTED': 'This video is unavailable or its format is not supported.',
  'error.MEDIA_ERR_UNKNOWN': 'The video could not be played.',

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
