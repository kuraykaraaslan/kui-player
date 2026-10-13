/**
 * Which subtitle format a file is.
 *
 * Kept apart from the parsers so this can be imported wherever it is needed —
 * including the render path — without pulling an SRT and ASS parser into every
 * player. See `videoplayer.subtitles.parse.ts` for those.
 */

export type SubtitleFormat = 'vtt' | 'srt' | 'ass';

/** Guess from the extension, falling back to sniffing the content. */
export function detectFormat(src: string, content?: string): SubtitleFormat {
  const path = src.split(/[?#]/)[0] ?? '';
  if (/\.srt$/i.test(path)) return 'srt';
  if (/\.(ass|ssa)$/i.test(path)) return 'ass';
  if (/\.vtt$/i.test(path)) return 'vtt';
  if (content) {
    if (/^\uFEFF?WEBVTT/.test(content)) return 'vtt';
    if (/^\s*\[Script Info\]/im.test(content)) return 'ass';
    if (/^\s*\d+\s*\n\s*\d{2}:\d{2}:\d{2},\d{3}\s*-->/m.test(content)) return 'srt';
  }
  return 'vtt';
}

/** Whether a track must be fetched and timed by the player rather than by the `<video>` element. */
export function isLocalTrack(track: { src: string; local?: boolean }): boolean {
  return track.local === true || detectFormat(track.src) !== 'vtt';
}

/** The delay range the viewer can dial in, seconds either way. */
export const MAX_SUBTITLE_OFFSET_S = 120;

export const clampSubtitleOffset = (seconds: number): number =>
  Math.round(Math.max(-MAX_SUBTITLE_OFFSET_S, Math.min(MAX_SUBTITLE_OFFSET_S, seconds)) * 10) / 10;

/** `+0.3 s`, `-1.5 s`, `0 s`. */
export const formatSubtitleOffset = (seconds: number): string =>
  `${seconds > 0 ? '+' : ''}${seconds.toFixed(Math.abs(seconds) < 10 ? 1 : 0).replace(/\.0$/, '')} s`;
