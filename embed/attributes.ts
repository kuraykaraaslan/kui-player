import type { LiveInput } from '../modules/videoplayer/videoplayer.live.js';
import type { PresenceOptions } from '../modules/videoplayer/videoplayer.presence.js';
import type { AlternateSource } from '../modules/videoplayer/videoplayer.types.js';

/*
 * HTML attributes and `data-*` values are strings. These turn the ones that
 * stand for the live-stream options into the values the engine takes, so
 * `<kui-player live presence-every-ms="600000" …>` and the embed script's
 * `data-live` read the same everywhere.
 */

const OFF = new Set(['false', 'off', '0', 'no']);

/** Is this attribute value one of the ways to say "off"? */
export function isOff(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && OFF.has(value.trim().toLowerCase());
}

function parseObject(value: string, name: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* reported below */ }
  console.warn(`kui-player: ignoring "${name}", it is not a JSON object`);
  return undefined;
}

/** A presence flag: absent is `fallback`; present and not "false" / "off" / "0" is true. */
export function parseFlag(value: string | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  return !isOff(value);
}

/**
 * `live` → `true`, `live="false"` / `"off"` → `false` (the old behaviour entirely),
 * `live='{"dvr":true}'` → the options. Absent → `undefined` (detect from the stream).
 */
export function parseLive(value: string | null | undefined): LiveInput {
  if (value === null || value === undefined) return undefined;
  if (isOff(value)) return false;
  if (value.trim().startsWith('{')) return parseObject(value, 'live') as LiveInput;
  return true;
}

/**
 * `presence="off"` → `false` (out of the page's group), `presence='{"everyMs":…,"graceMs":…}'`
 * or the pair `presence-every-ms` + `presence-grace-ms` → the options. Anything else → `undefined`.
 */
export function parsePresence(
  value: string | null | undefined,
  everyMs?: string | null,
  graceMs?: string | null,
): PresenceOptions | false | undefined {
  if (isOff(value)) return false;
  const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (value && value.trim().startsWith('{')) {
    const o = parseObject(value, 'presence');
    return o && positive(o.everyMs) && positive(o.graceMs) ? { everyMs: o.everyMs, graceMs: o.graceMs } : undefined;
  }
  const every = everyMs ? Number(everyMs) : Number.NaN;
  const grace = graceMs ? Number(graceMs) : Number.NaN;
  return positive(every) && positive(grace) ? { everyMs: every, graceMs: grace } : undefined;
}

/** `sources='[{"label":"Standard","src":"…"},{"label":"High","src":"…"}]'`. */
export function parseSources(value: string | null | undefined): AlternateSource[] | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const list = parsed.filter((s): s is AlternateSource =>
        !!s && typeof s === 'object' && typeof (s as AlternateSource).src === 'string' && typeof (s as AlternateSource).label === 'string');
      return list.length > 0 ? list : undefined;
    }
  } catch { /* reported below */ }
  console.warn('kui-player: ignoring "sources", it is not a JSON array of { label, src }');
  return undefined;
}
