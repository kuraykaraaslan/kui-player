/**
 * Offline copies of whole media files, kept in the browser's Cache Storage.
 *
 * Scope, stated plainly: this is for **progressive files** (MP4, WebM, MP3 …) that are
 * not DRM-protected. Adaptive streams (HLS/DASH) are many small requests and would need
 * a service worker on the host's own origin; protected content needs persistent licenses.
 * Neither is attempted here. A downloaded file plays from a `blob:` URL, which holds it in
 * memory — fine for lectures and podcasts, not for feature films.
 */
export type CacheStorageLike = Pick<CacheStorage, 'open' | 'delete'>;

export type StorageEstimateLike = { usage?: number; quota?: number };

export type OfflineProgress = (loaded: number, total: number | null) => void;

export type OfflineFailure = 'quota' | 'network' | 'unsupported' | 'unsafe';

export class OfflineError extends Error {
  constructor(readonly reason: OfflineFailure, message?: string) {
    super(message ?? reason);
    this.name = 'OfflineError';
  }
}

/** HLS / DASH manifests: many files, so not downloadable as one. */
export const isStreamingSource = (src: string): boolean => /\.(m3u8|mpd)(\?|#|$)/i.test(src);

/** Room for `needed` bytes with a little slack, or unknown (`true`: let the write decide). */
export function hasRoomFor(estimate: StorageEstimateLike | null, needed: number | null): boolean {
  if (needed === null || !estimate || estimate.quota === undefined || estimate.usage === undefined) return true;
  return estimate.quota - estimate.usage > needed * 1.1;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}

export class OfflineStore {
  constructor(
    private readonly cacheName = 'kui-player-offline',
    private readonly caches: CacheStorageLike | undefined = typeof globalThis.caches === 'undefined' ? undefined : globalThis.caches,
    private readonly estimateStorage: (() => Promise<StorageEstimateLike>) | undefined =
      typeof navigator !== 'undefined' && navigator.storage?.estimate ? () => navigator.storage.estimate() : undefined,
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}

  get supported(): boolean { return this.caches !== undefined; }

  private async cache(): Promise<Cache> {
    if (!this.caches) throw new OfflineError('unsupported', 'Cache Storage is not available');
    return this.caches.open(this.cacheName);
  }

  async has(url: string): Promise<boolean> {
    if (!this.caches) return false;
    try { return (await (await this.cache()).match(url)) !== undefined; } catch { return false; }
  }

  /** The stored file, or `null`. */
  async open(url: string): Promise<Blob | null> {
    if (!this.caches) return null;
    try {
      const response = await (await this.cache()).match(url);
      return response ? await response.blob() : null;
    } catch { return null; }
  }

  async remove(url: string): Promise<boolean> {
    if (!this.caches) return false;
    try { return await (await this.cache()).delete(url); } catch { return false; }
  }

  async list(): Promise<{ url: string; bytes: number }[]> {
    if (!this.caches) return [];
    try {
      const cache = await this.cache();
      const out: { url: string; bytes: number }[] = [];
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        out.push({ url: request.url, bytes: (await response?.blob())?.size ?? 0 });
      }
      return out;
    } catch { return []; }
  }

  async estimate(): Promise<StorageEstimateLike | null> {
    try { return (await this.estimateStorage?.()) ?? null; } catch { return null; }
  }

  /**
   * Download `url` into the cache, reporting progress. Refuses credentials-bearing
   * cross-origin surprises by using the default (same-site cookies only) fetch mode.
   * Rejects with an `OfflineError` whose `reason` says what to tell the viewer.
   */
  async download(url: string, options: { onProgress?: OfflineProgress; signal?: AbortSignal } = {}): Promise<number> {
    if (!this.caches) throw new OfflineError('unsupported', 'Cache Storage is not available');
    if (isStreamingSource(url)) throw new OfflineError('unsupported', 'Streams cannot be downloaded as one file');

    let response: Response;
    try {
      response = await this.fetcher(url, { signal: options.signal });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') throw error;
      throw new OfflineError('network');
    }
    if (!response.ok) throw new OfflineError('network', `HTTP ${response.status}`);

    const declared = Number(response.headers.get('content-length'));
    const total = Number.isFinite(declared) && declared > 0 ? declared : null;
    if (!hasRoomFor(await this.estimate(), total)) throw new OfflineError('quota');

    const chunks: BlobPart[] = [];
    let loaded = 0;
    const reader = response.body?.getReader();
    try {
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          options.onProgress?.(loaded, total);
        }
      } else {
        const blob = await response.blob();
        chunks.push(blob);
        loaded = blob.size;
        options.onProgress?.(loaded, loaded);
      }
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') throw error;
      throw new OfflineError('network');
    }

    const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'application/octet-stream' });
    if (!hasRoomFor(await this.estimate(), blob.size)) throw new OfflineError('quota');
    try {
      await (await this.cache()).put(url, new Response(blob, { headers: { 'content-type': blob.type, 'content-length': String(blob.size) } }));
    } catch (error) {
      // Cache.put rejects with QuotaExceededError when the write does not fit.
      throw new OfflineError((error as { name?: string }).name === 'QuotaExceededError' ? 'quota' : 'unsafe');
    }
    return blob.size;
  }
}
