import { useCallback, useSyncExternalStore } from 'react';
import type { StoreApi } from '../../modules/videoplayer/store.js';

/**
 * Subscribe a component to a slice of the player store.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is`, so selectors must
 * return a stable value — every selector in this library returns a primitive or
 * an array held in state, never a fresh object.
 */
export function useStore<T extends object, U>(api: StoreApi<T>, selector: (state: T) => U): U {
  const getSnapshot = useCallback(() => selector(api.getState()), [api, selector]);
  const subscribe = useCallback((onChange: () => void) => api.subscribe(onChange), [api]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
