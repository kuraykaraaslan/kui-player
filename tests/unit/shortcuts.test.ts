import { describe, expect, it } from 'vitest';
import { buildKeymap, lookupShortcut, describeKey } from '../../modules/videoplayer/videoplayer.shortcuts';

describe('shortcut keymap', () => {
  it('maps the defaults, including the new keys', () => {
    const map = buildKeymap();
    expect(lookupShortcut(map, ' ')).toBe('playPause');
    expect(lookupShortcut(map, 'j')).toBe('seekBack');
    expect(lookupShortcut(map, 'L')).toBe('seekForward');   // Caps Lock safe
    expect(lookupShortcut(map, 'c')).toBe('captions');
    expect(lookupShortcut(map, '7')).toBe('percent');
    expect(lookupShortcut(map, '?')).toBe('help');
    expect(lookupShortcut(map, 'Home')).toBe('start');
    expect(lookupShortcut(map, 'q')).toBeUndefined();
  });

  it('replaces keys per action and disables with false', () => {
    const map = buildKeymap({ seekForward: 'n', captions: false });
    expect(lookupShortcut(map, 'n')).toBe('seekForward');
    expect(lookupShortcut(map, 'ArrowRight')).toBeUndefined();   // replaced, not appended
    expect(lookupShortcut(map, 'c')).toBeUndefined();
    expect(lookupShortcut(map, 'k')).toBe('playPause');          // untouched
  });

  it('false turns every shortcut off', () => {
    expect(buildKeymap(false).size).toBe(0);
  });

  it('describes keys for the help list', () => {
    expect(describeKey(' ')).toBe('Space');
    expect(describeKey('ArrowLeft')).toBe('←');
    expect(describeKey('k')).toBe('K');
  });
});
