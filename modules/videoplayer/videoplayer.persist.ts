import type { SubtitleFontSize } from './videoplayer.types.js';

/**
 * What the player may remember between visits, and where.
 *
 * Nothing here runs unless the consumer asks for it: persistence is off by
 * default, because writing to a viewer's storage without being asked is not a
 * default a privacy-first player gets to have.
 */
export type PersistOptions = {
  /** Namespace for the keys. Change it to isolate players on one origin. */
  key?: string;
  /** Where to keep it. Defaults to `localStorage`; pass your own to control it. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Remember where the viewer stopped, per source (default true). */
  resume?: boolean;
  /** Remember volume, speed, subtitle language and size, source-independent (default true). */
  preferences?: boolean;
  /** Forget a position after this many days (default 30). */
  ttlDays?: number;
};

export type StoredPreferences = {
  volume?: number;
  muted?: boolean;
  speed?: number;
  subtitleLanguage?: string | null;
  subtitleFontSize?: SubtitleFontSize;
};

export type StoredPosition = { time: number; duration: number; at: number };

const DEFAULT_KEY = 'kui-player';
const DEFAULT_TTL_DAYS = 30;
/** Below this, resuming is more annoying than useful. */
export const MIN_RESUME_SECONDS = 15;
/** Past this proportion the viewer has effectively finished; start over. */
export const RESUME_COMPLETE_RATIO = 0.95;

/** A short, stable id for a source URL — the key, without storing the URL itself. */
export function hashSource(src: string): string {
  let hash = 2166136261;
  for (let i = 0; i < src.length; i += 1) {
    hash ^= src.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function read<T>(storage: PersistOptions['storage'], key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;   // private mode, quota, or someone else's data in our key
  }
}

function write(storage: PersistOptions['storage'], key: string, value: unknown): void {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** Reads and writes the two things worth remembering. Never throws. */
export class PlayerStorage {
  private readonly storage: PersistOptions['storage'];
  private readonly namespace: string;
  private readonly ttlMs: number;

  readonly resumeEnabled: boolean;
  readonly preferencesEnabled: boolean;

  constructor(options: PersistOptions = {}) {
    const fallback = typeof localStorage === 'undefined' ? undefined : localStorage;
    this.storage = options.storage ?? fallback;
    this.namespace = options.key ?? DEFAULT_KEY;
    this.ttlMs = (options.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
    this.resumeEnabled = options.resume ?? true;
    this.preferencesEnabled = options.preferences ?? true;
  }

  get available(): boolean { return this.storage !== undefined; }

  readPreferences(): StoredPreferences | null {
    if (!this.preferencesEnabled) return null;
    return read<StoredPreferences>(this.storage, `${this.namespace}:prefs`);
  }

  writePreferences(prefs: StoredPreferences): void {
    if (!this.preferencesEnabled) return;
    write(this.storage, `${this.namespace}:prefs`, prefs);
  }

  /** The stored position for a source, or `null` when there is nothing useful. */
  readPosition(src: string): StoredPosition | null {
    if (!this.resumeEnabled || !src) return null;
    const key = `${this.namespace}:pos:${hashSource(src)}`;
    const stored = read<StoredPosition>(this.storage, key);
    if (!stored) return null;
    if (Date.now() - stored.at > this.ttlMs) { this.clearPosition(src); return null; }
    if (stored.time < MIN_RESUME_SECONDS) return null;
    if (stored.duration > 0 && stored.time / stored.duration > RESUME_COMPLETE_RATIO) return null;
    return stored;
  }

  writePosition(src: string, time: number, duration: number): void {
    if (!this.resumeEnabled || !src) return;
    const key = `${this.namespace}:pos:${hashSource(src)}`;
    // Near the end, forget it instead: next time should start from the top.
    if (time < MIN_RESUME_SECONDS || (duration > 0 && time / duration > RESUME_COMPLETE_RATIO)) {
      try { this.storage?.removeItem(key); } catch { /* ignore */ }
      return;
    }
    write(this.storage, key, { time, duration, at: Date.now() } satisfies StoredPosition);
  }

  clearPosition(src: string): void {
    try { this.storage?.removeItem(`${this.namespace}:pos:${hashSource(src)}`); } catch { /* ignore */ }
  }
}
