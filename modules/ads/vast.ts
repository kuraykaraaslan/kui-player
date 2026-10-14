/**
 * VAST 3/4 parsing and wrapper resolution, with no ad SDK. Everything here
 * follows only the URLs the integrator's ad tag leads to; nothing is contacted
 * on its own. Lives outside the player bundle (`@kuraykaraaslan/kui-player/ads`).
 */
export type MediaFile = { url: string; type: string; width: number; height: number; bitrate: number };

export type Creative = {
  /** Seconds. */
  duration: number;
  /** Seconds into the ad after which it can be skipped; `null` = not skippable. */
  skipOffset: number | null;
  mediaFiles: MediaFile[];
  /** Event name → pixel URLs (`start`, `firstQuartile`, `midpoint`, `thirdQuartile`, `complete`, `skip`, `pause`, `resume`, `mute`, `unmute`, `clickTracking`). */
  tracking: Record<string, string[]>;
  clickThrough: string | null;
};

export type ParsedAd = {
  id: string | null;
  sequence: number | null;
  title: string | null;
  impressions: string[];
  errors: string[];
  /** A wrapper points at the next VAST document instead of carrying a creative. */
  wrapperUrl: string | null;
  creative: Creative | null;
};

export type ParsedVast = { ads: ParsedAd[]; errors: string[] };

const text = (el: Element | null | undefined): string => el?.textContent?.trim() ?? '';
const children = (el: Element, name: string): Element[] => Array.from(el.getElementsByTagName(name));

/** `00:00:15`, `00:00:15.500`, `15` → seconds; `null` if unreadable. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(v)) return null;
  return v.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** `00:00:05` or `25%` of `duration`. */
export function parseSkipOffset(value: string | null | undefined, duration: number): number | null {
  if (!value) return null;
  if (value.trim().endsWith('%')) {
    const pct = Number.parseFloat(value);
    return Number.isFinite(pct) && pct >= 0 ? (pct / 100) * duration : null;
  }
  return parseClock(value);
}

function parseCreative(linear: Element, isWrapper: boolean): Creative | null {
  const parsed = parseClock(text(linear.getElementsByTagName('Duration')[0]));
  // A wrapper's creative carries only tracking; an inline one without a duration is unusable.
  if (parsed === null && !isWrapper) return null;
  const duration = parsed ?? 0;
  const mediaFiles = children(linear, 'MediaFile')
    .map((m) => ({
      url: text(m), type: m.getAttribute('type') ?? '',
      width: Number(m.getAttribute('width')) || 0, height: Number(m.getAttribute('height')) || 0,
      bitrate: Number(m.getAttribute('bitrate')) || 0,
    }))
    .filter((m) => m.url !== '');
  const tracking: Record<string, string[]> = {};
  for (const t of children(linear, 'Tracking')) {
    const event = t.getAttribute('event');
    if (event && text(t)) (tracking[event] ??= []).push(text(t));
  }
  for (const c of children(linear, 'ClickTracking')) if (text(c)) (tracking.clickTracking ??= []).push(text(c));
  const through = text(linear.getElementsByTagName('ClickThrough')[0]);
  return {
    duration,
    skipOffset: parseSkipOffset(linear.getAttribute('skipoffset'), duration),
    mediaFiles,
    tracking,
    clickThrough: through || null,
  };
}

/** Parse one VAST document. Malformed XML or a non-VAST root yields no ads and an error, never a throw. */
export function parseVast(xml: string): ParsedVast {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || doc.documentElement?.nodeName !== 'VAST') {
    return { ads: [], errors: ['not a VAST document'] };
  }
  const ads: ParsedAd[] = [];
  for (const ad of children(doc.documentElement, 'Ad')) {
    const wrapper = ad.getElementsByTagName('Wrapper')[0];
    const inline = ad.getElementsByTagName('InLine')[0];
    const body = wrapper ?? inline;
    if (!body) continue;
    const linear = body.getElementsByTagName('Linear')[0];
    ads.push({
      id: ad.getAttribute('id'),
      sequence: ad.getAttribute('sequence') ? Number(ad.getAttribute('sequence')) : null,
      title: text(body.getElementsByTagName('AdTitle')[0]) || null,
      impressions: children(body, 'Impression').map(text).filter(Boolean),
      errors: children(body, 'Error').map(text).filter(Boolean),
      wrapperUrl: wrapper ? text(wrapper.getElementsByTagName('VASTAdTagURI')[0]) || null : null,
      creative: linear ? parseCreative(linear, Boolean(wrapper)) : null,
    });
  }
  return { ads, errors: ads.length === 0 ? ['no ads in the response'] : [] };
}

export type PlayableAd = {
  id: string | null;
  sequence: number | null;
  title: string | null;
  /** Impressions and errors accumulated across every wrapper on the way. */
  impressions: string[];
  errors: string[];
  creative: Creative;
};

/**
 * Fetch and unwrap a VAST tag. Wrappers add their impressions, tracking and
 * error URLs to the ad that finally plays. Depth is capped, so a loop of
 * wrappers cannot spin forever.
 */
export async function resolveVast(
  tagUrlOrXml: string,
  load: (url: string) => Promise<string>,
  options: { maxDepth?: number } = {},
): Promise<{ ads: PlayableAd[]; errors: string[] }> {
  const maxDepth = options.maxDepth ?? 4;
  const errors: string[] = [];

  async function walk(
    source: string, depth: number, inherited: { impressions: string[]; errors: string[]; tracking: Record<string, string[]> },
  ): Promise<PlayableAd[]> {
    let xml = source;
    if (!source.trimStart().startsWith('<')) {
      try { xml = await load(source); } catch { errors.push(`could not load ${source}`); return []; }
    }
    const parsed = parseVast(xml);
    errors.push(...parsed.errors);
    const out: PlayableAd[] = [];
    for (const ad of parsed.ads) {
      const merged = {
        impressions: [...inherited.impressions, ...ad.impressions],
        errors: [...inherited.errors, ...ad.errors],
        tracking: { ...inherited.tracking },
      };
      for (const [k, v] of Object.entries(ad.creative?.tracking ?? {})) merged.tracking[k] = [...(merged.tracking[k] ?? []), ...v];
      if (ad.wrapperUrl) {
        if (depth >= maxDepth) { errors.push('wrapper chain too deep'); continue; }
        out.push(...await walk(ad.wrapperUrl, depth + 1, merged));
      } else if (ad.creative && ad.creative.mediaFiles.length > 0) {
        out.push({
          id: ad.id, sequence: ad.sequence, title: ad.title, impressions: merged.impressions, errors: merged.errors,
          creative: { ...ad.creative, tracking: merged.tracking },
        });
      }
    }
    return out;
  }

  const ads = await walk(tagUrlOrXml, 0, { impressions: [], errors: [], tracking: {} });
  // Ad pods play in `sequence` order; ads without one keep the order they came in.
  const ordered = ads
    .map((ad, i) => ({ ad, i }))
    .sort((a, b) => (a.ad.sequence ?? a.i + 1e6) - (b.ad.sequence ?? b.i + 1e6) || a.i - b.i)
    .map((x) => x.ad);
  return { ads: ordered, errors };
}

/**
 * The file to play: playable type first, then the closest bitrate to a
 * target, preferring one that is not larger than the player.
 */
export function pickMediaFile(
  files: readonly MediaFile[], canPlay: (mime: string) => boolean, options: { width?: number; targetBitrate?: number } = {},
): MediaFile | null {
  const playable = files.filter((f) => canPlay(f.type));
  if (playable.length === 0) return null;
  const target = options.targetBitrate ?? 1000;
  const fits = options.width ? playable.filter((f) => f.width === 0 || f.width <= options.width! * 1.5) : playable;
  // Nothing fits the player: the smallest file is the least wasteful one.
  if (fits.length === 0) return [...playable].sort((a, b) => a.width - b.width)[0] ?? null;
  return [...fits].sort((a, b) => Math.abs((a.bitrate || target) - target) - Math.abs((b.bitrate || target) - target))[0] ?? null;
}
