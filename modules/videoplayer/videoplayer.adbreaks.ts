/**
 * Ad-break markers carried inside a stream (SSAI), reported as events.
 * This does not show ads — it only says where the stream says they are.
 */
export type AdBreak = {
  id: string;
  /** Media time the break starts, seconds. */
  start: number;
  /** Media time it ends; `null` while an open-ended `CUE-OUT` has no `CUE-IN` yet. */
  end: number | null;
  duration: number | null;
  source: 'cue-out' | 'daterange' | 'id3';
};

/** The slice of an hls.js fragment this needs; `tagList` holds `[name, value]` pairs. */
export type TaggedFragment = {
  start: number;
  duration?: number;
  /** Wall-clock time of the fragment's first sample, ms since epoch. */
  programDateTime?: number | null;
  tagList?: readonly (readonly string[])[];
};

/** `KEY=value,KEY2="quoted, value"` → map. Values keep no surrounding quotes. */
export function parseAttributes(list: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pattern = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  for (const match of list.matchAll(pattern)) out[match[1]!] = match[3] ?? match[2]!;
  return out;
}

/** `30`, `30.5` or `DURATION=30` → seconds. */
export function parseCueOut(value: string | undefined): number | null {
  if (!value) return null;
  const raw = /DURATION=([\d.]+)/i.exec(value)?.[1] ?? /^\s*([\d.]+)/.exec(value)?.[1];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const AD_CLASS = /(^|[.\-_])(ads?|interstitial)([.\-_]|$)/i;

export function isAdDateRange(attrs: Record<string, string>): boolean {
  return 'SCTE35-OUT' in attrs || AD_CLASS.test(attrs.CLASS ?? '');
}

/** Media time for a wall-clock instant, using the fragment whose clock covers it. */
function mediaTimeAt(fragments: readonly TaggedFragment[], instant: number): number | null {
  let best: TaggedFragment | null = null;
  for (const f of fragments) {
    if (typeof f.programDateTime === 'number' && f.programDateTime <= instant) best = f;
  }
  return best && typeof best.programDateTime === 'number'
    ? best.start + (instant - best.programDateTime) / 1000
    : null;
}

/**
 * Read `EXT-X-CUE-OUT` / `EXT-X-CUE-IN` / `EXT-X-DATERANGE` ad markers out of a
 * parsed playlist's fragments. Deterministic and idempotent, so a live playlist
 * can be rescanned on every refresh and the result simply replaces the last one.
 */
export function extractAdBreaks(fragments: readonly TaggedFragment[]): AdBreak[] {
  const breaks: AdBreak[] = [];
  let open: AdBreak | null = null;

  for (const fragment of fragments) {
    for (const tag of fragment.tagList ?? []) {
      const [name, value = ''] = tag;
      if (name === 'CUE-OUT') {
        const duration = parseCueOut(value);
        open = {
          id: `cue-${fragment.start.toFixed(3)}`,
          start: fragment.start,
          end: duration === null ? null : fragment.start + duration,
          duration,
          source: 'cue-out',
        };
        breaks.push(open);
      } else if (name === 'CUE-IN') {
        if (open) {
          open.end = fragment.start;
          open.duration = open.end - open.start;
          open = null;
        }
      } else if (name === 'DATERANGE') {
        const attrs = parseAttributes(value);
        if (!isAdDateRange(attrs) || !attrs.ID || !attrs['START-DATE']) continue;
        const startInstant = Date.parse(attrs['START-DATE']);
        const start = Number.isFinite(startInstant) ? mediaTimeAt(fragments, startInstant) : null;
        if (start === null) continue;   // without a program clock there is no media time to give
        const planned = Number(attrs.DURATION ?? attrs['PLANNED-DURATION']);
        const endInstant = attrs['END-DATE'] ? Date.parse(attrs['END-DATE']) : NaN;
        const duration = Number.isFinite(planned) && planned > 0
          ? planned
          : Number.isFinite(endInstant) ? (endInstant - startInstant) / 1000 : null;
        breaks.push({
          id: attrs.ID,
          start,
          end: duration === null ? null : start + duration,
          duration,
          source: 'daterange',
        });
      }
    }
  }
  return breaks;
}

export type AdBreakEvent = { type: 'start' | 'end'; adBreak: AdBreak };

/** Turns playhead movement into `start` / `end` transitions, once each. */
export class AdBreakTracker {
  private active: AdBreak | null = null;

  reset(): void { this.active = null; }

  get current(): AdBreak | null { return this.active; }

  update(breaks: readonly AdBreak[], time: number): AdBreakEvent[] {
    const events: AdBreakEvent[] = [];
    const inside = breaks.find((b) => time >= b.start && (b.end === null || time < b.end)) ?? null;
    if (this.active && inside?.id !== this.active.id) {
      events.push({ type: 'end', adBreak: this.active });
      this.active = null;
    }
    if (inside && !this.active) {
      this.active = inside;
      events.push({ type: 'start', adBreak: inside });
    }
    return events;
  }
}

export type AdSpan = { id: string; left: number; width: number };

/**
 * Where to draw the breaks on a seek bar covering `[origin, origin + span]`,
 * as percentages. Open-ended breaks are drawn as a thin tick; anything
 * outside the bar (a live window that has scrolled past it) is dropped.
 */
export function adSpans(breaks: readonly AdBreak[], origin: number, span: number): AdSpan[] {
  if (!(span > 0)) return [];
  const spans: AdSpan[] = [];
  for (const b of breaks) {
    const end = b.end ?? b.start;
    if (end < origin || b.start > origin + span) continue;
    const left = Math.max(0, ((b.start - origin) / span) * 100);
    const right = Math.min(100, ((end - origin) / span) * 100);
    spans.push({ id: b.id, left, width: Math.max(0.4, right - left) });
  }
  return spans;
}

/**
 * Two sources can mark the same SSAI break (a playlist tag and in-band ID3).
 * Entries of `secondary` that start within `tolerance` seconds of a `primary`
 * break, or inside one, are dropped; the primary entry wins.
 */
export function mergeAdBreaks(primary: readonly AdBreak[], secondary: readonly AdBreak[], tolerance = 2): AdBreak[] {
  const extra = secondary.filter((s) => !primary.some((p) =>
    p.id === s.id
    || Math.abs(p.start - s.start) <= tolerance
    || (p.end !== null && s.start >= p.start && s.start < p.end)));
  return [...primary, ...extra];
}
