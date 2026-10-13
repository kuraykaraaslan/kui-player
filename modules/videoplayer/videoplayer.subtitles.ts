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

// ── writing subtitles back out (the editor) ──────────────────────────────────

export type EditableCue = { start: number; end: number; text: string };

const two = (n: number) => String(n).padStart(2, '0');

function clock(seconds: number, separator: '.' | ','): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${two(h)}:${two(m)}:${two(s)}${separator}${String(ms % 1000).padStart(3, '0')}`;
}

/** Cues in time order, ends never before starts, empty text dropped. */
export function tidyCues(cues: readonly EditableCue[]): EditableCue[] {
  return cues
    .map((c) => ({ start: Math.max(0, c.start), end: Math.max(c.start, c.end), text: c.text.replace(/\r\n?/g, '\n').trim() }))
    .filter((c) => c.text !== '')
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function serializeSrt(cues: readonly EditableCue[]): string {
  return tidyCues(cues)
    .map((c, i) => `${i + 1}\n${clock(c.start, ',')} --> ${clock(c.end, ',')}\n${c.text}\n`)
    .join('\n');
}

export function serializeVtt(cues: readonly EditableCue[]): string {
  // "-->" inside cue text would end the cue early for any VTT parser.
  const safe = (text: string) => text.replace(/-->/g, '→');
  return `WEBVTT\n\n${tidyCues(cues)
    .map((c) => `${clock(c.start, '.')} --> ${clock(c.end, '.')}\n${safe(c.text)}\n`)
    .join('\n')}`;
}

/** `1:02.5`, `00:01:02,500`, `62.5` → seconds; `null` when it is none of those. */
export function parseEditedTime(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
