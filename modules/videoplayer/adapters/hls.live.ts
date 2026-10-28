import type { LiveReauthOptions } from '../videoplayer.live.js';

/*
 * The parts of live HLS recovery that do not depend on hls.js itself: when to
 * try again, and what a refusal said. Kept apart so they can be tested without
 * a streaming engine, and so the adapter file stays about wiring.
 */

export type RecoveryKind = 'auth' | 'network';

export type RecoveryHandlers = {
  /** Open the original source again. `attempt` counts from 1. */
  reload(kind: RecoveryKind, attempt: number): void;
  /** Out of attempts: show the error state with Retry. */
  giveUp(kind: RecoveryKind): void;
};

/**
 * Reconnect schedule for a live source.
 *
 * A refusal (401 / 403 / 404 — a session that ended, a link that expired) is
 * answered with one immediate reload of the original URL, which is how a new
 * session is opened. If that is refused too, and for every network error, the
 * delay doubles from `baseDelayMs` up to `maxDelayMs`. A fragment that loads
 * calls `recovered()`, which starts the count over.
 */
export class LiveRecovery {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly options: Required<LiveReauthOptions>,
    private readonly handlers: RecoveryHandlers,
  ) {}

  /** A load failed. Ignored while a reconnect is already scheduled. */
  fail(kind: RecoveryKind): void {
    if (this.timer !== null) return;
    if (this.attempt >= this.options.maxAttempts) {
      this.handlers.giveUp(kind);
      return;
    }
    const n = this.attempt;
    this.attempt += 1;
    const doubling = kind === 'auth' ? n - 1 : n;
    const delay = kind === 'auth' && n === 0
      ? 0
      : Math.min(this.options.maxDelayMs, this.options.baseDelayMs * 2 ** doubling);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.handlers.reload(kind, n + 1);
    }, delay);
  }

  /** Data is flowing again. Returns `true` when that ended a recovery. */
  recovered(): boolean {
    const was = this.attempt > 0;
    this.attempt = 0;
    this.clear();
    return was;
  }

  get recovering(): boolean { return this.attempt > 0; }

  dispose(): void {
    this.clear();
    this.attempt = 0;
  }

  private clear(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
  }
}

/** Longest refusal text worth showing in the player. */
const MAX_REFUSAL_CHARS = 280;

type XhrLike = {
  responseText?: string;
  response?: unknown;
  responseType?: string;
  getResponseHeader?: (name: string) => string | null;
};
type ResponseLike = {
  headers?: { get(name: string): string | null };
  clone?: () => { text(): Promise<string> };
};

function decodeBody(body: unknown): string | undefined {
  if (typeof body === 'string') return body;
  // The tag check, not `instanceof`: a buffer from another frame is still a buffer.
  if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
    try { return new TextDecoder('utf-8', { fatal: false }).decode((body as ArrayBuffer).slice(0, 4096)); } catch { return undefined; }
  }
  return undefined;
}

/**
 * What the source said when it refused: a JSON body's `message`, or a short
 * plain-text body. Anything else (an HTML error page, an empty body) is
 * ignored, so the player never shows markup or a stack trace.
 */
export function parseRefusal(body: string | undefined, contentType: string | null | undefined): string | undefined {
  const text = body?.trim();
  if (!text) return undefined;
  const type = (contentType ?? '').toLowerCase();
  const clip = (s: string) => {
    const one = s.replace(/\s+/g, ' ').trim();
    if (!one) return undefined;
    return one.length > MAX_REFUSAL_CHARS ? `${one.slice(0, MAX_REFUSAL_CHARS - 1)}…` : one;
  };

  if (type.includes('json') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const message = typeof parsed === 'object' && parsed !== null
        ? (parsed as { message?: unknown }).message
        : undefined;
      return typeof message === 'string' ? clip(message) : undefined;
    } catch {
      return undefined;
    }
  }
  if (type.includes('text/plain') || (type === '' && !text.startsWith('<'))) {
    if (text.startsWith('<')) return undefined;
    return clip(text);
  }
  return undefined;
}

/**
 * Read the refusal out of whatever hls.js hands to an error handler as
 * `networkDetails`: an `XMLHttpRequest` (its text is already there) or a fetch
 * `Response` (read from a clone, which is why this is async).
 */
export async function readRefusal(networkDetails: unknown): Promise<string | undefined> {
  if (typeof networkDetails !== 'object' || networkDetails === null) return undefined;
  try {
    const res = networkDetails as ResponseLike;
    if (typeof res.clone === 'function' && res.headers) {
      return parseRefusal(await res.clone().text(), res.headers.get('content-type'));
    }
    const xhr = networkDetails as XhrLike;
    const body = (xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : undefined)
      ?? decodeBody(xhr.response);
    return parseRefusal(body, xhr.getResponseHeader?.('content-type'));
  } catch {
    return undefined;
  }
}
