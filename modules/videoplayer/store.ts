/**
 * The player's store: the four methods everything here uses, and nothing else.
 *
 * This replaces the zustand dependency. The public shape is deliberately the
 * same — `getState`, `setState`, `subscribe`, `getInitialState` — so
 * `engine.store` keeps working for anyone already reading it, and a consumer
 * who wants zustand's ecosystem can still wrap it.
 */

export type StoreListener<T> = (state: T, previous: T) => void;

export interface StoreApi<T> {
  getState(): T;
  getInitialState(): T;
  /** Merge a partial state (or the result of a function) into the current one. */
  setState(partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean): void;
  /** Returns an unsubscribe function. Listeners fire only when state changes. */
  subscribe(listener: StoreListener<T>): () => void;
}

type Setter<T> = StoreApi<T>['setState'];
type Getter<T> = StoreApi<T>['getState'];

export function createStore<T extends object>(
  initializer: (set: Setter<T>, get: Getter<T>, api: StoreApi<T>) => T,
): StoreApi<T> {
  let state: T;
  const listeners = new Set<StoreListener<T>>();

  const setState: Setter<T> = (partial, replace) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next === state) return;
    const previous = state;
    state = replace ? (next as T) : Object.assign({}, state, next);
    // Bail out when nothing actually changed, so subscribers are not woken by
    // an assignment of identical values (`setCurrentTime` on every timeupdate).
    if (!replace && shallowEqual(previous, state)) { state = previous; return; }
    for (const listener of listeners) listener(state, previous);
  };

  const getState: Getter<T> = () => state;

  const api: StoreApi<T> = {
    getState,
    getInitialState: () => initialState,
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  state = initializer(setState, getState, api);
  const initialState = state;
  return api;
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  for (const key of Object.keys(b) as (keyof T)[]) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
