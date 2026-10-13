/**
 * Timestamped share links: reading `?t=90` / `?t=1m30s` / `#t=90` on load and
 * building the URL for "share from here". Pure string work, no DOM access, so
 * it is safe under SSR and trivial to test.
 */

const UNIT_SECONDS = { h: 3600, m: 60, s: 1 } as const;

/**
 * Seconds for `90`, `90.5`, `1m30s`, `1h2m3s` or `1:30` / `1:02:03`.
 * Anything else — empty, negative, nonsense — is `null`, never an exception:
 * a hand-edited URL must not be able to break the player.
 */
export function parseTimeParam(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^\d+(:\d{1,2}){1,2}$/.test(v)) {
    return v.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(v);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * UNIT_SECONDS.h + Number(m) * UNIT_SECONDS.m + Number(s);
}

/** The start time in a URL's query or hash, or `null`. The query wins over the hash. */
export function readUrlTime(href: string, param = 't'): number | null {
  let url: URL;
  try { url = new URL(href, 'http://localhost'); } catch { return null; }
  const fromQuery = parseTimeParam(url.searchParams.get(param));
  if (fromQuery !== null) return fromQuery;
  const hash = url.hash.replace(/^#/, '');
  return parseTimeParam(new URLSearchParams(hash).get(param));
}

/** `href` with the time set in the query and any stale hash time removed. */
export function buildShareUrl(href: string, seconds: number, param = 't'): string {
  const url = new URL(href);
  url.searchParams.set(param, String(Math.max(0, Math.floor(seconds))));
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  if (hash.has(param)) {
    hash.delete(param);
    const rest = hash.toString();
    url.hash = rest ? `#${rest}` : '';
  }
  return url.toString();
}
