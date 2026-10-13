import { useEffect, useRef, useState } from 'react';
import { OfflineStore, isStreamingSource, type OfflineError } from '../../modules/videoplayer/videoplayer.offline.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';

export type OfflineOptions = {
  /** Cache Storage name (default `kui-player-offline`). */
  cacheName?: string;
};

type Props = {
  options: OfflineOptions;
  /** The page's own source URL (not a blob). */
  src: string;
  /** Called with a `blob:` URL when this source should play from the device, `null` to go back to the network. */
  onLocalSrc: (url: string | null) => void;
};

/**
 * Downloads one progressive media file for offline viewing and, when a copy
 * already exists, makes the player use it. Driven through the player store —
 * the settings row asks, this does — so no UI of its own. Opt-in; see
 * `videoplayer.offline.ts` for what is and is not covered.
 */
export default function OfflineController({ options, src, onLocalSrc }: Props) {
  const engine = useVideoPlayerEngine();
  const [store] = useState(() => new OfflineStore(options.cacheName));
  const abort = useRef<AbortController | null>(null);
  const localUrl = useRef<string | null>(null);

  // What is the state of this source on this device?
  useEffect(() => {
    const s = engine.store.getState();
    let cancelled = false;
    abort.current?.abort();
    if (!src || !store.supported || isStreamingSource(src)) {
      s.setOffline({ state: 'unavailable', percent: null, bytes: null, reason: null });
      return;
    }
    s.setOffline({ state: 'none', percent: null, bytes: null, reason: null });
    void (async () => {
      const blob = await store.open(src);
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      localUrl.current = url;
      onLocalSrc(url);
      engine.store.getState().setOffline({ state: 'downloaded', percent: null, bytes: blob.size, reason: null });
    })();
    return () => {
      cancelled = true;
      if (localUrl.current) { URL.revokeObjectURL(localUrl.current); localUrl.current = null; }
      onLocalSrc(null);
    };
  }, [engine, store, src, onLocalSrc]);

  // Requests from the settings menu.
  useEffect(() => engine.store.subscribe((state, previous) => {
    const request = state.offlineRequest;
    if (!request || request === previous.offlineRequest) return;
    state.requestOffline(null);
    const set = state.setOffline;

    if (request === 'cancel') { abort.current?.abort(); return; }

    if (request === 'remove') {
      void store.remove(src).then(() => {
        if (localUrl.current) { URL.revokeObjectURL(localUrl.current); localUrl.current = null; onLocalSrc(null); }
        set({ state: 'none', percent: null, bytes: null, reason: null });
      });
      return;
    }

    // download
    const controller = new AbortController();
    abort.current = controller;
    set({ state: 'downloading', percent: 0, bytes: null, reason: null });
    store.download(src, {
      signal: controller.signal,
      onProgress: (loaded, total) => {
        set({ state: 'downloading', percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : null, bytes: loaded, reason: null });
      },
    }).then((bytes) => {
      set({ state: 'downloaded', percent: null, bytes, reason: null });
    }).catch((error: unknown) => {
      if ((error as { name?: string }).name === 'AbortError') {
        set({ state: 'none', percent: null, bytes: null, reason: null });
      } else {
        set({ state: 'failed', percent: null, bytes: null, reason: (error as OfflineError).reason ?? 'network' });
      }
    });
  }), [engine, store, src, onLocalSrc]);

  return null;
}
