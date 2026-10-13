/**
 * Study aids: a map of which parts of a video were actually watched, and
 * timestamped notes with export. Pure data handling — storage and UI live elsewhere.
 */
export const WATCH_BUCKETS = 100;

/** Longest gap between two playhead positions still counted as continuous watching. */
const CONTINUOUS_S = 2.5;

/** Which hundredths of the video were played through (not skipped over). */
export class WatchedMap {
  private readonly seen: boolean[];

  constructor(buckets = WATCH_BUCKETS, initial?: readonly boolean[]) {
    this.seen = Array.from({ length: buckets }, (_, i) => initial?.[i] === true);
  }

  /**
   * Record that playback moved from `from` to `to`. A seek (a big jump) marks
   * nothing: skipping to the end must not count as having watched the middle.
   */
  mark(from: number, to: number, duration: number): void {
    if (!(duration > 0) || to < from || to - from > CONTINUOUS_S) return;
    const last = this.seen.length - 1;
    const first = Math.min(last, Math.max(0, Math.floor((from / duration) * this.seen.length)));
    const end = Math.min(last, Math.max(0, Math.floor((to / duration) * this.seen.length - 1e-9)));
    for (let i = first; i <= Math.max(first, end); i += 1) this.seen[i] = true;
  }

  get percent(): number {
    return Math.round((this.seen.filter(Boolean).length / this.seen.length) * 100);
  }

  /** `[start, end)` fractions of the video for each watched run, for drawing. */
  runs(): { start: number; end: number }[] {
    const out: { start: number; end: number }[] = [];
    let start = -1;
    this.seen.forEach((on, i) => {
      if (on && start < 0) start = i;
      if (!on && start >= 0) { out.push({ start: start / this.seen.length, end: i / this.seen.length }); start = -1; }
    });
    if (start >= 0) out.push({ start: start / this.seen.length, end: 1 });
    return out;
  }

  toArray(): boolean[] { return [...this.seen]; }
}

export type Note = { id: string; time: number; text: string; at: number };

export function makeNote(time: number, text: string, now = Date.now()): Note | null {
  const clean = text.trim();
  return clean === '' ? null : { id: `${now.toString(36)}-${Math.floor(time * 1000).toString(36)}`, time: Math.max(0, time), text: clean, at: now };
}

/** Notes in video order, so an export reads like the lecture. */
export const sortNotes = (notes: readonly Note[]): Note[] => [...notes].sort((a, b) => a.time - b.time || a.at - b.at);

export function notesToMarkdown(notes: readonly Note[], title: string, formatTime: (s: number) => string): string {
  const lines = sortNotes(notes).map((n) => `- **${formatTime(n.time)}** — ${n.text.replace(/\n+/g, ' ')}`);
  return `# ${title || 'Notes'}\n\n${lines.join('\n')}\n`;
}

export function notesToJson(notes: readonly Note[], title: string): string {
  return JSON.stringify({ title, notes: sortNotes(notes).map(({ time, text, at }) => ({ time, text, at })) }, null, 2);
}

/** Tolerant reader for what storage hands back. */
export function parseNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is Note =>
    !!n && typeof n.id === 'string' && typeof n.time === 'number' && typeof n.text === 'string' && typeof n.at === 'number');
}
