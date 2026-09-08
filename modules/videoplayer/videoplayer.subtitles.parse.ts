import { parseVtt, parseTimestamp, type VttCue } from './videoplayer.vtt.js';
import { detectFormat } from './videoplayer.subtitles.js';

/**
 * SRT and ASS parsing. Imported on demand: WebVTT rides on the element's own
 * text tracks, so most players never need any of this.
 */

/**
 * SubRip. Structurally WebVTT with commas for decimal separators and an index
 * line, which `parseVtt` already tolerates once the timings are normalised.
 */
export function parseSrt(input: string): VttCue[] {
  const normalised = input
    .replace(/\r\n?/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return parseVtt(normalised)
    // SRT bold/italic markup is HTML-ish; `parseVtt` strips tags already.
    .map((cue) => ({ ...cue, text: cue.text.replace(/\{\\[^}]*\}/g, '').trim() }))
    .filter((cue) => cue.text !== '');
}

export type AssCue = VttCue & {
  /** Style name from the ASS file, for consumers that map their own styling. */
  style?: string;
  /** Alignment digit from `\an`, when the cue overrides it. */
  align?: number;
};

const ASS_TIME = /^Dialogue:\s*[^,]*,([^,]+),([^,]+),([^,]*),/;

/**
 * Advanced SubStation Alpha, at the level a controls layer should attempt:
 * timing, text and alignment. Karaoke, transforms and drawing commands are
 * stripped rather than half-rendered — for those, hand the file to `jassub`
 * through the subtitle adapter and let it own the canvas.
 */
export function parseAss(input: string): AssCue[] {
  const cues: AssCue[] = [];
  for (const line of input.replace(/\r\n?/g, '\n').split('\n')) {
    const match = ASS_TIME.exec(line);
    if (!match) continue;
    const start = parseTimestamp(match[1]!);
    const end = parseTimestamp(match[2]!);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    // Everything after the ninth comma is the text; the fields before it are
    // fixed by the format.
    const parts = line.split(',');
    const raw = parts.slice(9).join(',');
    const alignMatch = /\{[^}]*\\an(\d)[^}]*\}/.exec(raw);

    const text = raw
      .replace(/\{[^}]*\}/g, '')   // override blocks
      .replace(/\\N|\\n/g, '\n')   // ASS line breaks
      .replace(/\\h/g, ' ')
      .trim();
    if (text === '') continue;

    cues.push({
      start,
      end,
      text,
      style: match[3] || undefined,
      ...(alignMatch ? { align: Number.parseInt(alignMatch[1]!, 10) } : {}),
    });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Parse whichever of the three formats `content` turns out to be. */
export function parseSubtitles(content: string, src: string): VttCue[] {
  switch (detectFormat(src, content)) {
    case 'srt': return parseSrt(content);
    case 'ass': return parseAss(content);
    default: return parseVtt(content);
  }
}
