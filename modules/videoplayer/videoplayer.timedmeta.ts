/**
 * In-band timed metadata (ID3 inside segments, or cues the browser exposes on a
 * `metadata` text track) read as the same ad breaks the playlist tags give.
 * Pure and defensive: malformed input yields nothing and never throws.
 */
import { isAdDateRange, parseAttributes, type AdBreak } from './videoplayer.adbreaks.js';

export type Id3Frame = {
  id: string;
  /** TXXX / WXXX description, or PRIV owner. */
  description: string;
  /** Decoded text value (TXXX/T***), URL (WXXX) or printable PRIV payload. */
  text: string;
  data?: Uint8Array;
};

const MAX_TAG = 1 << 20;

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function utf16(bytes: Uint8Array, littleEndian: boolean): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(littleEndian ? bytes[i]! | (bytes[i + 1]! << 8) : (bytes[i]! << 8) | bytes[i + 1]!);
  }
  return out;
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 1 || encoding === 2) {
      let b = bytes;
      let le = false;
      if (encoding === 1 && b.length >= 2) {
        if (b[0] === 0xff && b[1] === 0xfe) { le = true; b = b.subarray(2); }
        else if (b[0] === 0xfe && b[1] === 0xff) b = b.subarray(2);
      }
      return utf16(b, le);
    }
    if (encoding === 3 && typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    return latin1(bytes);
  } catch { return ''; }
}

/** Index of the string terminator at or after `from` (double-null aligned for UTF-16), or -1. */
function terminator(bytes: Uint8Array, from: number, encoding: number): number {
  const wide = encoding === 1 || encoding === 2;
  for (let i = from; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return i;
  }
  return -1;
}

/** Reverse ID3 unsynchronisation: `FF 00` becomes `FF`. */
function unsync(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[n++] = bytes[i]!;
    if (bytes[i] === 0xff && bytes[i + 1] === 0) i++;
  }
  return out.subarray(0, n);
}

const clean = (s: string): string => s.replace(/\0+$/g, '').replace(/^\uFEFF/, '');
const printable = (s: string): boolean => {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 13) return false;
    if (c === 0x7f) return false;
  }
  return true;
};

function decodeFrame(id: string, body: Uint8Array): Id3Frame | null {
  if (id === 'PRIV') {
    const end = body.indexOf(0);
    if (end < 0) return null;
    const data = body.subarray(end + 1);
    const asText = clean(decodeText(data, 3));
    return { id, description: latin1(body.subarray(0, end)), text: printable(asText) ? asText : '', data };
  }
  if (id === 'TXXX' || id === 'WXXX') {
    if (body.length < 2) return null;
    const enc = body[0]!;
    const wide = enc === 1 || enc === 2;
    const end = terminator(body, 1, enc);
    if (end < 0) return { id, description: '', text: clean(decodeText(body.subarray(1), enc)) };
    const rest = body.subarray(end + (wide ? 2 : 1));
    return {
      id,
      description: clean(decodeText(body.subarray(1, end), enc)),
      text: id === 'WXXX' ? clean(latin1(rest)) : clean(decodeText(rest, enc)),
    };
  }
  if (id[0] === 'T' && body.length >= 1) return { id, description: '', text: clean(decodeText(body.subarray(1), body[0]!)) };
  return null;
}

/**
 * The text, URL and private frames of an ID3v2.3 / v2.4 tag. Anything else
 * (no `ID3` header, a v2.2 tag, truncated or oversized frames) is skipped.
 */
export function decodeId3(input: Uint8Array | null | undefined): Id3Frame[] {
  const frames: Id3Frame[] = [];
  try {
    if (!(input instanceof Uint8Array) || input.length < 10) return frames;
    if (input[0] !== 0x49 || input[1] !== 0x44 || input[2] !== 0x33) return frames;
    const version = input[3]!;
    if (version !== 3 && version !== 4) return frames;
    const tagUnsync = (input[5]! & 0x80) !== 0;
    // v2.3 unsynchronises the whole tag body; v2.4 does it per frame.
    const data = tagUnsync && version === 3
      ? (() => { const b = unsync(input.subarray(10)); const o = new Uint8Array(10 + b.length); o.set(input.subarray(0, 10)); o.set(b, 10); return o; })()
      : input;
    const synchsafe = (o: number) => ((data[o]! & 0x7f) << 21) | ((data[o + 1]! & 0x7f) << 14) | ((data[o + 2]! & 0x7f) << 7) | (data[o + 3]! & 0x7f);
    const tagEnd = Math.min(data.length, 10 + Math.min(version === 3 && tagUnsync ? data.length : synchsafe(6), MAX_TAG));
    let pos = 10;
    if (data[5]! & 0x40) {   // extended header
      const size = version === 4 ? synchsafe(pos) : ((data[pos]! << 24) | (data[pos + 1]! << 16) | (data[pos + 2]! << 8) | data[pos + 3]!) + 4;
      pos += Math.max(0, size);
    }
    while (pos + 10 <= tagEnd) {
      if (data[pos] === 0) break;   // padding
      const id = latin1(data.subarray(pos, pos + 4));
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = version === 4
        ? synchsafe(pos + 4)
        : ((data[pos + 4]! << 24) | (data[pos + 5]! << 16) | (data[pos + 6]! << 8) | data[pos + 7]!) >>> 0;
      const bodyStart = pos + 10;
      if (size > tagEnd - bodyStart) break;   // truncated or lying about its size
      let body = data.subarray(bodyStart, bodyStart + size);
      const flags = data[pos + 9]!;
      pos = bodyStart + size;
      if (version === 4) {
        if (flags & 0x0c) continue;                 // compressed or encrypted: unreadable
        if (flags & 0x40) body = body.subarray(1);  // grouping identity byte
        if (flags & 0x01) body = body.subarray(4);  // data length indicator
        if (tagUnsync || flags & 0x02) body = unsync(body);
      } else {
        if (flags & 0xc0) continue;                 // compressed or encrypted
        if (flags & 0x20) body = body.subarray(1);  // grouping identity byte
      }
      const frame = decodeFrame(id, body);
      if (frame) frames.push(frame);
    }
  } catch { /* malformed: keep what was read */ }
  return frames;
}

// ─── markers → ad breaks ─────────────────────────────────────────────────────

/** One ad-out or ad-in signal at a media time. */
export type Marker =
  | { kind: 'out'; time: number; id: string; duration: number | null; source: AdBreak['source']; implicit?: boolean }
  | { kind: 'in'; time: number };

const AD_IN = /\bcue-?in|\bad[-_ ]?(break[-_ ]?)?(end|in)\b|scte35-in/i;
const AD_OUT = /cue-?out|ad[-_ ]?break|\bads?\b|interstitial|scte35-out/i;
const SCTE_OWNER = /scte|splice/i;

function durationOf(text: string, bareNumber: boolean): number | null {
  const raw = /duration["'=:\s]+([\d.]+)/i.exec(text)?.[1] ?? (bareNumber ? /^\s*([\d.]+)\s*$/.exec(text)?.[1] : undefined);
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * An ad marker carried by ID3 frames, if one is there. Only readable text is
 * understood: a binary SCTE-35 `PRIV` payload is not decoded, so it needs a
 * textual `TXXX` alongside it (or a `duration=` in the payload) to count.
 */
export function id3Marker(frames: readonly Id3Frame[], time: number): Marker | null {
  if (!Number.isFinite(time) || time < 0) return null;
  for (const f of frames) {
    // Only user-defined and private frames carry ad signals; title, artist
    // and the other T*** frames are ordinary text.
    if ((f.id !== 'TXXX' && f.id !== 'PRIV') || !(f.text || f.description)) continue;
    const label = `${f.description} ${f.text}`;
    if (AD_IN.test(label)) return { kind: 'in', time };
    const adKeyed = AD_OUT.test(f.description) || (f.id === 'PRIV' && SCTE_OWNER.test(f.description));
    if (!adKeyed && !AD_OUT.test(f.text)) continue;
    const duration = durationOf(f.text, adKeyed);
    const explicit = /\bid["'=:\s]+([\w.:-]+)/i.exec(f.text)?.[1];
    return { kind: 'out', time, id: explicit ?? `id3-${time.toFixed(3)}`, duration, source: 'id3', ...(explicit ? {} : { implicit: true }) };
  }
  return null;
}

/**
 * Markers → breaks. Duplicates (same id, or an id-less cue repeated inside a
 * break) collapse to the first; an `in` closes the latest open break.
 */
export function breaksFromMarkers(markers: readonly Marker[]): AdBreak[] {
  const sorted = [...markers].sort((a, b) => a.time - b.time);
  const breaks: AdBreak[] = [];
  const seen = new Set<string>();
  let open: AdBreak | null = null;
  for (const m of sorted) {
    if (m.kind === 'in') {
      if (open && m.time > open.start) { open.end = m.time; open.duration = m.time - open.start; }
      open = null;
      continue;
    }
    if (seen.has(m.id)) continue;
    // A cue with no id repeated per segment lands at a new time each time:
    // one that falls inside (or right at the start of) a break is a repeat.
    if (m.implicit && breaks.some((b) => Math.abs(b.start - m.time) <= 1 || (m.time >= b.start && (b.end === null || m.time < b.end)))) continue;
    seen.add(m.id);
    const b: AdBreak = {
      id: m.id, start: m.time, end: m.duration === null ? null : m.time + m.duration,
      duration: m.duration, source: m.source,
    };
    breaks.push(b);
    open = b.end === null ? b : null;
  }
  return breaks;
}

/**
 * Accumulates in-band markers as segments parse; republish `breaks` after each
 * `add`. Past `cap` markers the oldest are evicted, so a long live stream keeps
 * working; an `in` marker is always accepted.
 */
export class MetadataBreaks {
  private markers: { marker: Marker; key: string }[] = [];
  private keys = new Set<string>();

  constructor(private readonly cap = 256) {}

  clear(): void { this.markers = []; this.keys.clear(); }

  get breaks(): AdBreak[] { return breaksFromMarkers(this.markers.map((m) => m.marker)); }

  /** Feed one ID3 tag at media time `time`. Returns whether the list changed. */
  addId3(data: Uint8Array | null | undefined, time: number): boolean {
    const marker = id3Marker(decodeId3(data), time);
    if (!marker) return false;
    const key = marker.kind === 'in' ? `in@${marker.time.toFixed(3)}` : `out:${marker.id}`;
    if (this.keys.has(key)) return false;
    if (marker.kind === 'out' && marker.implicit) {
      const before = this.breaks.length;
      if (breaksFromMarkers([...this.markers.map((m) => m.marker), marker]).length === before) return false;
    }
    this.keys.add(key);
    this.markers.push({ marker, key });
    while (this.markers.length > Math.max(1, this.cap)) this.keys.delete(this.markers.shift()!.key);
    return true;
  }
}

// ─── native HLS: cues on a `metadata` text track ─────────────────────────────

/** The slice of a `TextTrackCue` / `DataCue` this reads. */
export type MetaCue = {
  id?: string;
  startTime: number;
  endTime?: number;
  type?: string;
  value?: unknown;
  text?: string;
};

type KeyData = { key?: unknown; data?: unknown; info?: unknown };

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

function bytesOf(v: unknown): Uint8Array | null {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return null;
}

/** An ID3 frame (Safari exposes them as `{ key, info, data }`) as a frame. */
function frameFromEntry(e: KeyData): Id3Frame | null {
  if (typeof e.key !== 'string' || !/^(PRIV|WXXX|T[A-Z0-9]{3})$/.test(e.key)) return null;
  const bytes = bytesOf(e.data);
  const text = typeof e.data === 'string' ? e.data : bytes ? clean(decodeText(bytes, 3)) : '';
  return {
    id: e.key,
    description: typeof e.info === 'string' ? e.info : '',
    text: printable(text) ? text : '',
    ...(bytes ? { data: bytes } : {}),
  };
}

/** `EXT-X-DATERANGE` attributes as a native cue exposes them, best effort. */
function dateRangeAttrs(cue: MetaCue): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const entry of asArray(cue.value)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.key === 'string' && (typeof e.data === 'string' || typeof e.data === 'number')) {
      attrs[e.key.toUpperCase()] = String(e.data);
    } else if (!('key' in e)) {
      for (const [k, v] of Object.entries(e)) if (typeof v === 'string' || typeof v === 'number') attrs[k.toUpperCase()] = String(v);
    }
  }
  if (typeof cue.text === 'string' && cue.text.includes('=')) Object.assign(attrs, parseAttributes(cue.text));
  return attrs;
}

function cueMarkers(cue: MetaCue): Marker[] {
  try {
    const start = cue.startTime;
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) return [];
    const entries = asArray(cue.value).filter((e): e is KeyData => !!e && typeof e === 'object');
    const frames = entries.map(frameFromEntry).filter((f): f is Id3Frame => f !== null);
    if (frames.length > 0 && /id3/i.test(cue.type ?? 'id3')) {
      const m = id3Marker(frames, start);
      if (m) return [m];
    }
    const attrs = dateRangeAttrs(cue);
    const id = attrs.ID ?? (cue.id || '');
    if (id && isAdDateRange(attrs)) {
      const planned = Number(attrs.DURATION ?? attrs['PLANNED-DURATION']);
      const end = cue.endTime;
      const duration = Number.isFinite(planned) && planned > 0
        ? planned
        : typeof end === 'number' && Number.isFinite(end) && end > start ? end - start : null;
      return [{ kind: 'out', time: start, id, duration, source: 'daterange' }];
    }
  } catch { /* an odd cue is simply not a marker */ }
  return [];
}

const MAX_CUES = 2048;
const MAX_BREAKS = 256;

/** All ad breaks the given metadata cues mark. Safe to rescan; duplicates collapse. */
export function breaksFromCues(cues: ArrayLike<MetaCue> | null | undefined, limit = MAX_CUES): AdBreak[] {
  const markers: Marker[] = [];
  if (!cues) return [];
  for (let i = 0; i < cues.length && i < limit; i++) {
    const cue = cues[i];
    if (cue) markers.push(...cueMarkers(cue));
  }
  return breaksFromMarkers(markers);
}

type TrackLike = { kind: string; mode: string; cues: ArrayLike<MetaCue> | null; addEventListener(t: string, cb: (e: Event) => void): void; removeEventListener(t: string, cb: (e: Event) => void): void };

/**
 * Watch a native `<video>`'s `metadata` text tracks (Safari plays HLS itself,
 * so hls.js never sees the stream). Feature-detected: returns a no-op where
 * `textTracks` is missing. `onBreaks` gets the full list on every change.
 */
export function watchNativeMetadata(video: HTMLMediaElement, onBreaks: (breaks: AdBreak[]) => void): () => void {
  const list = (video as { textTracks?: TextTrackList }).textTracks as unknown as
    | (ArrayLike<TrackLike> & { addEventListener?: TrackLike['addEventListener']; removeEventListener?: TrackLike['removeEventListener'] })
    | undefined;
  if (!list || typeof list.addEventListener !== 'function') return () => {};

  const watched = new Set<TrackLike>();
  let last = '';
  const scan = () => {
    try {
      const all: AdBreak[] = [];
      let budget = MAX_CUES;   // across all tracks, so many tracks cannot multiply the work
      for (const t of watched) {
        const n = Math.min(t.cues?.length ?? 0, budget);
        if (n <= 0) continue;
        budget -= n;
        all.push(...breaksFromCues(t.cues, n));
      }
      const merged = breaksFromMarkers(all.map((b): Marker => ({ kind: 'out', time: b.start, id: b.id, duration: b.duration, source: b.source })))
        .slice(-MAX_BREAKS);
      const key = JSON.stringify(merged);
      if (key === last) return;
      last = key;
      onBreaks(merged);
    } catch { /* never let a cue break playback */ }
  };
  const watch = (t: TrackLike | undefined) => {
    if (!t || t.kind !== 'metadata' || watched.has(t)) return;
    watched.add(t);
    // Cues are only populated for a track that is not `disabled`; `hidden` loads them without rendering.
    try { if (t.mode === 'disabled') t.mode = 'hidden'; } catch { /* read-only on some engines */ }
    t.addEventListener('cuechange', scan);
  };
  const addAll = () => { for (let i = 0; i < list.length; i++) watch(list[i]); scan(); };
  const onAdd = (e: unknown) => { watch((e as { track?: TrackLike }).track); addAll(); };

  list.addEventListener('addtrack', onAdd);
  video.addEventListener('loadedmetadata', addAll);
  addAll();
  return () => {
    list.removeEventListener?.('addtrack', onAdd);
    video.removeEventListener('loadedmetadata', addAll);
    for (const t of watched) t.removeEventListener('cuechange', scan);
    watched.clear();
  };
}
