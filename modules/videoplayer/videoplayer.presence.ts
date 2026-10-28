import { createStore, type StoreApi } from './store.js';

/**
 * The "Still watching?" check, generically.
 *
 * After `everyMs` of playback the viewer is asked whether they are still there;
 * with no answer within `graceMs` playback and loading stop. Nothing here knows
 * what is playing: it is a cost guard for any stream that costs something to
 * keep running, and it cannot be enforced against a modified client.
 *
 * A group is one timer and one question for any number of players: a wall of
 * nine live tiles asks once, and stops all nine, rather than nine times.
 */
export type PresenceOptions = {
  /** Playback time before the question appears, ms. */
  everyMs: number;
  /** How long the viewer has to answer, ms. */
  graceMs: number;
};

/** `idle`: nobody is playing. `watching`: the timer runs. `asking`: the question is up. */
export type PresencePhase = 'idle' | 'watching' | 'asking';

export type PresenceState = {
  phase: PresencePhase;
  /** Milliseconds left to answer while `asking`; `graceMs` otherwise. */
  remainingMs: number;
  everyMs: number;
  graceMs: number;
};

export type PresenceEvent =
  | { type: 'ask'; graceMs: number }
  | { type: 'continue' }
  /** No answer: stop playing and loading. Sent to members that are playing. */
  | { type: 'timeout' }
  /** The question went away by itself (everything stopped playing). */
  | { type: 'dismiss' };

export interface PresenceMember {
  isPlaying(): boolean;
  onEvent(event: PresenceEvent): void;
}

export interface PresenceGroup {
  readonly options: Readonly<PresenceOptions>;
  readonly store: StoreApi<PresenceState>;
  /** Add a player; returns the function that removes it. */
  join(member: PresenceMember): () => void;
  /** A member started or stopped playing: re-evaluate the timer. */
  update(): void;
  /** The viewer is here ("Continue", or a deliberate Play): start the count again. */
  confirm(): void;
  dispose(): void;
}

const TICK_MS = 250;

export function isPresenceGroup(value: unknown): value is PresenceGroup {
  return typeof value === 'object' && value !== null
    && typeof (value as PresenceGroup).join === 'function'
    && typeof (value as PresenceGroup).confirm === 'function';
}

function validate(options: PresenceOptions): Readonly<PresenceOptions> {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!ok(options?.everyMs) || !ok(options?.graceMs)) {
    throw new TypeError('presence needs positive numbers for everyMs and graceMs (milliseconds)');
  }
  return { everyMs: options.everyMs, graceMs: options.graceMs };
}

export function createPresenceGroup(options: PresenceOptions): PresenceGroup {
  const opts = validate(options);
  const store = createStore<PresenceState>(() => ({
    phase: 'idle', remainingMs: opts.graceMs, everyMs: opts.everyMs, graceMs: opts.graceMs,
  }));
  const members = new Set<PresenceMember>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let last = 0;
  let played = 0;      // ms of playback since the viewer last confirmed
  let disposed = false;

  const set = (partial: Partial<PresenceState>) => store.setState(partial);
  const anyPlaying = () => { for (const m of members) if (m.isPlaying()) return true; return false; };
  const notify = (event: PresenceEvent, only?: (m: PresenceMember) => boolean) => {
    for (const m of Array.from(members)) {
      if (only && !only(m)) continue;
      try { m.onEvent(event); } catch { /* one broken player must not stop the others */ }
    }
  };
  const stopTimer = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
  const startTimer = () => {
    if (timer !== null) return;
    last = Date.now();
    timer = setInterval(tick, TICK_MS);
  };

  function ask() {
    set({ phase: 'asking', remainingMs: opts.graceMs });
    notify({ type: 'ask', graceMs: opts.graceMs });
  }

  function timeout() {
    stopTimer();
    played = 0;
    set({ phase: 'idle', remainingMs: opts.graceMs });
    notify({ type: 'timeout' }, (m) => m.isPlaying());
  }

  function tick() {
    const now = Date.now();
    const dt = Math.max(0, now - last);
    last = now;
    const { phase, remainingMs } = store.getState();
    if (phase === 'asking') {
      const left = remainingMs - dt;
      if (left <= 0) timeout(); else set({ remainingMs: left });
    } else if (phase === 'watching' && anyPlaying()) {
      played += dt;
      if (played >= opts.everyMs) ask();
    }
  }

  function update() {
    if (disposed) return;
    const { phase } = store.getState();
    const playing = anyPlaying();
    if (phase === 'asking') {
      // Everyone stopped by themselves: nothing left to ask about.
      if (!playing) {
        stopTimer();
        played = 0;
        set({ phase: 'idle', remainingMs: opts.graceMs });
        notify({ type: 'dismiss' });
      }
      return;
    }
    if (playing) {
      if (phase !== 'watching') set({ phase: 'watching' });
      startTimer();
    } else {
      stopTimer();
      if (phase !== 'idle') set({ phase: 'idle' });
    }
  }

  function confirm() {
    if (disposed) return;
    played = 0;
    if (store.getState().phase === 'asking') {
      set({ phase: 'watching', remainingMs: opts.graceMs });
      last = Date.now();
      notify({ type: 'continue' });
    }
    update();
  }

  return {
    options: opts,
    store,
    update,
    confirm,

    join(member) {
      if (disposed) return () => {};
      members.add(member);
      update();
      return () => { members.delete(member); update(); };
    },

    dispose() {
      disposed = true;
      stopTimer();
      members.clear();
    },
  };
}
