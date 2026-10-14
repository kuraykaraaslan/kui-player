/** Beacon URLs, macros and quartile bookkeeping for ad playback. Pure apart from `ping`. */

export type MacroValues = { errorCode?: number; playhead?: number; assetUri?: string };

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function clock(seconds: number): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}.${pad(ms % 1000, 3)}`;
}

/** Fill the VAST macros a tracking URL may contain. Unknown ones are left for the server to see. */
export function expandMacros(url: string, values: MacroValues = {}, now = new Date(), random = Math.random): string {
  const table: Record<string, string | undefined> = {
    TIMESTAMP: now.toISOString(),
    CACHEBUSTING: String(Math.floor(random() * 1e8)).padStart(8, '0'),
    ERRORCODE: values.errorCode === undefined ? undefined : String(values.errorCode),
    CONTENTPLAYHEAD: values.playhead === undefined ? undefined : clock(values.playhead),
    ASSETURI: values.assetUri === undefined ? undefined : encodeURIComponent(values.assetUri),
  };
  return url.replace(/\[([A-Z]+)\]/g, (match, name: string) => table[name] ?? match);
}

/** Fire-and-forget pixel. An image request carries no response the page has to read. */
export function pingBeacon(url: string): void {
  if (typeof Image === 'undefined') return;
  const pixel = new Image();
  pixel.referrerPolicy = 'no-referrer-when-downgrade';
  pixel.src = url;
}

export type QuartileEvent = 'start' | 'firstQuartile' | 'midpoint' | 'thirdQuartile';

/** Reports each progress event once, in order, from the ad's own clock. */
export class AdQuartiles {
  private fired = new Set<QuartileEvent>();

  reset(): void { this.fired.clear(); }

  update(time: number, duration: number): QuartileEvent[] {
    const out: QuartileEvent[] = [];
    const mark = (event: QuartileEvent, reached: boolean) => {
      if (reached && !this.fired.has(event)) { this.fired.add(event); out.push(event); }
    };
    mark('start', time > 0);
    if (duration > 0) {
      mark('firstQuartile', time >= duration * 0.25);
      mark('midpoint', time >= duration * 0.5);
      mark('thirdQuartile', time >= duration * 0.75);
    }
    return out;
  }
}

/** Seconds until the skip button appears (0 = now), or `null` when the ad cannot be skipped. */
export function skipCountdown(skipOffset: number | null, time: number): number | null {
  if (skipOffset === null) return null;
  return Math.max(0, Math.ceil(skipOffset - time));
}
