/**
 * Live streams, generically.
 *
 * Nothing here knows what is being streamed: a source is live when its playlist
 * has no end (`EXT-X-ENDLIST` missing) or its element reports an unbounded
 * duration. These options only decide how the player *behaves* while one runs.
 */

/** How the reload on a refused or vanished live source backs off. */
export type LiveReauthOptions = {
  /** Reconnect attempts before giving up with a Retry state (default 5). */
  maxAttempts?: number;
  /** First back-off delay, ms; doubles on each attempt (default 1000). */
  baseDelayMs?: number;
  /** Ceiling for the doubling, ms (default 15000). */
  maxDelayMs?: number;
};

export type LiveOptions = {
  /**
   * Keep a seek bar over the DVR window. Default `false`: a live stream shows a
   * LIVE badge, "back to live" when behind the edge, and no seek bar.
   */
  dvr?: boolean;
  /**
   * Stop loading while the player is scrolled out of view or the tab is hidden,
   * and resume at the live edge when it comes back. Default `true`.
   */
  stopWhenHidden?: boolean;
  /**
   * Reload the original URL once when a playlist or segment of a live source
   * answers 401 / 403 / 404 (a session that ended), then back off; network
   * errors reconnect with the same back-off. `false` turns it off. Default on.
   */
  reauth?: boolean | LiveReauthOptions;
  /**
   * `'include'` also sends cookies on cross-origin playlist and segment
   * requests. Same-origin requests always carry them and follow redirects.
   * Default `'same-origin'`.
   */
  credentials?: 'same-origin' | 'include';
};

/** `live` as the player takes it: `true` / an object says "this source is live". */
export type LiveInput = boolean | LiveOptions | undefined;

export type ResolvedLive = {
  /**
   * The page said the source is live. Adapters use it to pick small-tile
   * defaults (first variant, capped to the player size) before the playlist is
   * known. Without it, live is still detected from the playlist.
   */
  hinted: boolean;
  dvr: boolean;
  stopWhenHidden: boolean;
  reauth: false | Required<LiveReauthOptions>;
  credentials: 'same-origin' | 'include';
};

export const DEFAULT_REAUTH: Required<LiveReauthOptions> = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 15_000,
};

export function resolveLive(input: LiveInput): ResolvedLive {
  // `false` is the opt-out: the pre-live-mode behaviour (seek bar over the DVR
  // window, nothing stopped, nothing reloaded).
  if (input === false) {
    return { hinted: false, dvr: true, stopWhenHidden: false, reauth: false, credentials: 'same-origin' };
  }
  const o: LiveOptions = typeof input === 'object' ? input : {};
  const reauth = o.reauth === false
    ? false
    : { ...DEFAULT_REAUTH, ...(typeof o.reauth === 'object' ? o.reauth : {}) };
  return {
    hinted: input !== undefined,
    dvr: o.dvr ?? false,
    stopWhenHidden: o.stopWhenHidden ?? true,
    reauth,
    credentials: o.credentials ?? 'same-origin',
  };
}
