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
