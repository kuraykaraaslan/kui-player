/**
 * A small WebVTT reader, for the two things the browser will not hand us:
 * chapter lists and seek-preview storyboards. Subtitle rendering still goes
 * through the element's own text tracks.
 *
 * Loaded on demand — see `videoplayer.timeline.ts` for the lookup helper that
 * the always-present preview needs.
 */

export type VttCue = {
  start: number;
  end: number;
  /** The cue payload, with tags stripped. */
  text: string;
  /** The cue identifier, when the file gives one. */
  id?: string;
};

export type Chapter = { start: number; end: number; title: string };

export type StoryboardTile = {
  start: number;
  end: number;
  /** Image the tile lives in, resolved against the VTT's own URL. */
  url: string;
  /** Sprite rectangle, or `null` when the cue points at a whole image. */
  rect: { x: number; y: number; w: number; h: number } | null;
};

/** `00:01:02.500` / `01:02.500` / `62.5` → seconds. */
export function parseTimestamp(value: string): number {
  const parts = value.trim().split(':');
  if (parts.length === 0) return NaN;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + Number.parseFloat(part.replace(',', '.'));
  return Number.isFinite(seconds) ? seconds : NaN;
}

const CUE_TIMING = /^(.+?)\s*-->\s*([^\s]+)/;

/** Parse a WebVTT document into cues. Unknown blocks are skipped, not thrown on. */
export function parseVtt(input: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = input.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim() !== '');
    if (lines.length === 0) continue;
    if (/^WEBVTT/.test(lines[0]!)) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0]!)) continue;

    let index = 0;
    let id: string | undefined;
    if (!lines[0]!.includes('-->')) { id = lines[0]!.trim(); index = 1; }

    const timing = lines[index];
    if (!timing) continue;
    const match = CUE_TIMING.exec(timing);
    if (!match) continue;

    const start = parseTimestamp(match[1]!);
    const end = parseTimestamp(match[2]!);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    const text = lines.slice(index + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    cues.push({ start, end, text, ...(id ? { id } : {}) });
  }

  return cues;
}

/** Chapter cues are ordinary cues whose text is the chapter title. */
export function parseChapters(input: string): Chapter[] {
  return parseVtt(input)
    .filter((cue) => cue.text !== '')
    .map((cue) => ({ start: cue.start, end: cue.end, title: cue.text }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Storyboard cues point at an image, optionally with a sprite rectangle in the
 * `#xywh=` media fragment — the convention every storyboard generator emits.
 */
export function parseStoryboard(input: string, baseUrl: string): StoryboardTile[] {
  return parseVtt(input)
    .map((cue) => {
      const [path, fragment] = cue.text.split('#xywh=');
      if (!path) return null;
      let url: string;
      try {
        url = new URL(path.trim(), baseUrl).href;
      } catch {
        url = path.trim();
      }
      if (!fragment) return { start: cue.start, end: cue.end, url, rect: null };
      const [x, y, w, h] = fragment.split(',').map((n) => Number.parseInt(n, 10));
      const rect = [x, y, w, h].every((n) => Number.isFinite(n))
        ? { x: x!, y: y!, w: w!, h: h! }
        : null;
      return { start: cue.start, end: cue.end, url, rect };
    })
    .filter((tile): tile is StoryboardTile => tile !== null)
    .sort((a, b) => a.start - b.start);
}
