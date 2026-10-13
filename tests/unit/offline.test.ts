import { Blob as NodeBlob } from 'node:buffer';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import {
  OfflineError, OfflineStore, formatBytes, hasRoomFor, isStreamingSource, type CacheStorageLike,
} from '../../modules/videoplayer/videoplayer.offline';

// jsdom's Blob has no stream(), which Response needs; real browsers and Node do. Use Node's for this file.
beforeAll(() => { vi.stubGlobal('Blob', NodeBlob); });
afterAll(() => { vi.unstubAllGlobals(); });

/** A Map-backed stand-in for Cache Storage: enough of the surface the store touches. */
function fakeCaches(options: { putFails?: string } = {}) {
  const entries = new Map<string, Response>();
  const cache = {
    match: async (request: string | Request) => entries.get(typeof request === 'string' ? request : request.url)?.clone(),
    put: async (request: string | Request, response: Response) => {
      if (options.putFails) throw Object.assign(new Error('full'), { name: options.putFails });
      entries.set(typeof request === 'string' ? request : request.url, response);
    },
    delete: async (request: string | Request) => entries.delete(typeof request === 'string' ? request : request.url),
    keys: async () => [...entries.keys()].map((url) => new Request(url)),
  } as unknown as Cache;
  const storage: CacheStorageLike = { open: async () => cache, delete: async () => true };
  return { storage, entries };
}

const body = (chunks: Uint8Array[], headers: Record<string, string> = {}) =>
  new Response(new ReadableStream({
    start(controller) { chunks.forEach((c) => controller.enqueue(c)); controller.close(); },
  }), { status: 200, headers });

const fetcher = (response: () => Response) => vi.fn(async () => response()) as unknown as typeof fetch;

describe('helpers', () => {
  it('spots streaming manifests', () => {
    expect(isStreamingSource('https://x/a.m3u8?token=1')).toBe(true);
    expect(isStreamingSource('https://x/a.mpd')).toBe(true);
    expect(isStreamingSource('https://x/a.mp4')).toBe(false);
  });
  it('checks for room with a margin, and gives the benefit of the doubt when unknown', () => {
    expect(hasRoomFor({ usage: 0, quota: 1000 }, 500)).toBe(true);
    expect(hasRoomFor({ usage: 400, quota: 1000 }, 590)).toBe(false);   // needs ~650 with slack
    expect(hasRoomFor(null, 500)).toBe(true);
    expect(hasRoomFor({ usage: 1, quota: 2 }, null)).toBe(true);
  });
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 kB');
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB');
  });
});

describe('OfflineStore', () => {
  it('downloads with progress, stores the file, and can open and remove it', async () => {
    const { storage } = fakeCaches();
    const progress: [number, number | null][] = [];
    const store = new OfflineStore('t', storage, async () => ({ usage: 0, quota: 1e9 }),
      fetcher(() => body([new Uint8Array(3), new Uint8Array(5)], { 'content-length': '8', 'content-type': 'video/mp4' })));

    expect(await store.has('https://x/a.mp4')).toBe(false);
    const bytes = await store.download('https://x/a.mp4', { onProgress: (l, t) => progress.push([l, t]) });
    expect(bytes).toBe(8);
    expect(progress).toEqual([[3, 8], [8, 8]]);
    expect(await store.has('https://x/a.mp4')).toBe(true);
    const blob = await store.open('https://x/a.mp4');
    expect(blob?.size).toBe(8);
    expect(blob?.type).toBe('video/mp4');
    expect(await store.list()).toEqual([{ url: 'https://x/a.mp4', bytes: 8 }]);
    expect(await store.remove('https://x/a.mp4')).toBe(true);
    expect(await store.has('https://x/a.mp4')).toBe(false);
  });

  it('reports unknown totals as null progress totals', async () => {
    const { storage } = fakeCaches();
    const seen: (number | null)[] = [];
    const store = new OfflineStore('t', storage, undefined, fetcher(() => body([new Uint8Array(4)])));
    await store.download('https://x/a.mp3', { onProgress: (_l, t) => seen.push(t) });
    expect(seen).toEqual([null]);
  });

  it('refuses before downloading when it will not fit', async () => {
    const { storage } = fakeCaches();
    const f = fetcher(() => body([new Uint8Array(10)], { 'content-length': '1000' }));
    const store = new OfflineStore('t', storage, async () => ({ usage: 900, quota: 1000 }), f);
    await expect(store.download('https://x/a.mp4')).rejects.toMatchObject({ reason: 'quota' });
  });

  it('turns a write that overflows into a quota error', async () => {
    const { storage } = fakeCaches({ putFails: 'QuotaExceededError' });
    const store = new OfflineStore('t', storage, undefined, fetcher(() => body([new Uint8Array(4)])));
    await expect(store.download('https://x/a.mp4')).rejects.toMatchObject({ reason: 'quota' });
  });

  it('reports network failures and bad statuses, and rejects streams and missing storage', async () => {
    const { storage } = fakeCaches();
    const down = new OfflineStore('t', storage, undefined, vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch);
    await expect(down.download('https://x/a.mp4')).rejects.toMatchObject({ reason: 'network' });

    const notFound = new OfflineStore('t', storage, undefined, fetcher(() => new Response('', { status: 404 })));
    await expect(notFound.download('https://x/a.mp4')).rejects.toMatchObject({ reason: 'network' });

    const ok = new OfflineStore('t', storage, undefined, fetcher(() => body([])));
    await expect(ok.download('https://x/live.m3u8')).rejects.toMatchObject({ reason: 'unsupported' });

    const none = new OfflineStore('t', undefined);
    expect(none.supported).toBe(false);
    expect(await none.has('x')).toBe(false);
    await expect(none.download('https://x/a.mp4')).rejects.toBeInstanceOf(OfflineError);
  });

  it('passes an abort through untouched, so cancelling is not an "error" the UI reports', async () => {
    const { storage, entries } = fakeCaches();
    const aborting = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }) as unknown as typeof fetch;
    const store = new OfflineStore('t', storage, undefined, aborting);
    await expect(store.download('https://x/a.mp4')).rejects.toMatchObject({ name: 'AbortError' });
    expect(entries.size).toBe(0);
  });
});
