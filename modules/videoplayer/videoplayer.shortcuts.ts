/**
 * Keyboard shortcut map: which key triggers which action, and how a consumer
 * remaps or disables them. Pure data and lookup — the DOM wiring lives in the
 * React hook.
 */
export type ShortcutAction =
  | 'playPause' | 'seekBack' | 'seekForward' | 'volumeUp' | 'volumeDown' | 'mute'
  | 'fullscreen' | 'pip' | 'captions' | 'percent' | 'frameBack' | 'frameForward'
  | 'slower' | 'faster' | 'start' | 'end' | 'help' | 'stats';

export const DEFAULT_SHORTCUTS: Readonly<Record<ShortcutAction, readonly string[]>> = {
  playPause: [' ', 'k'],
  seekBack: ['ArrowLeft', 'j'],
  seekForward: ['ArrowRight', 'l'],
  volumeUp: ['ArrowUp'],
  volumeDown: ['ArrowDown'],
  mute: ['m'],
  fullscreen: ['f'],
  pip: ['i'],
  captions: ['c'],
  percent: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  frameBack: [','],
  frameForward: ['.'],
  slower: ['<'],
  faster: ['>'],
  start: ['Home'],
  end: ['End'],
  help: ['?'],
  stats: ['Shift+I'],
};

/**
 * Per-action override: a key, a list of keys, or `false` to turn the action
 * off. `{ seekForward: 'l' }` replaces the defaults for that action only.
 */
export type ShortcutOverrides = Partial<Record<ShortcutAction, string | readonly string[] | false>>;

export type Keymap = ReadonlyMap<string, ShortcutAction>;

/** Letters match case-insensitively (Caps Lock must not disable the player). */
const normalise = (key: string): string => {
  if (key.length === 1) return key.toLowerCase();
  return /^shift\+/i.test(key) ? `shift+${key.slice(6).toLowerCase()}` : key;
};

export function resolveShortcuts(
  overrides: ShortcutOverrides | false = {},
): Record<ShortcutAction, readonly string[]> {
  const out = {} as Record<ShortcutAction, readonly string[]>;
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const o = overrides === false ? false : overrides[action];
    out[action] = o === false ? [] : o === undefined ? DEFAULT_SHORTCUTS[action] : ([] as string[]).concat(o);
  }
  return out;
}

export function buildKeymap(overrides: ShortcutOverrides | false = {}): Keymap {
  const map = new Map<string, ShortcutAction>();
  const resolved = resolveShortcuts(overrides);
  for (const [action, keys] of Object.entries(resolved) as [ShortcutAction, readonly string[]][]) {
    for (const key of keys) map.set(normalise(key), action);
  }
  return map;
}

/**
 * `Shift+<letter>` bindings are looked up first; a shifted letter with no such
 * binding resolves to nothing rather than to the plain-letter action, so
 * `Shift+I` never falls through to `i` when the stats panel is disabled.
 */
export function lookupShortcut(keymap: Keymap, key: string, shift = false): ShortcutAction | undefined {
  if (shift && key.length === 1 && key.toLowerCase() !== key.toUpperCase()) {
    return keymap.get(`shift+${key.toLowerCase()}`);
  }
  return keymap.get(normalise(key));
}

/** Human label for a key in the help list. */
export function describeKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key.startsWith('Arrow')) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[key] ?? key;
  return key.length === 1 ? key.toUpperCase() : key;
}
