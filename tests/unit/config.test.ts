import { afterEach, describe, expect, it } from 'vitest';
import { configurePlayer, playerDefaults, resolveHideAbout } from '../../modules/videoplayer/videoplayer.config';
import * as core from '../../modules';

describe('library-wide defaults', () => {
  afterEach(() => configurePlayer({ hideAbout: undefined }));

  it('is exported from the core entry', () => {
    expect(core.configurePlayer).toBe(configurePlayer);
    expect(core.playerDefaults).toBe(playerDefaults);
  });

  it('starts empty, merges keys, and goes back to the built-in default on undefined', () => {
    expect(playerDefaults()).toEqual({});
    configurePlayer({ hideAbout: true });
    expect(playerDefaults()).toEqual({ hideAbout: true });
    configurePlayer({});
    expect(playerDefaults()).toEqual({ hideAbout: true });
    configurePlayer({ hideAbout: undefined });
    expect(playerDefaults()).toEqual({});
  });

  it('hands out a frozen snapshot, not the shared object', () => {
    configurePlayer({ hideAbout: true });
    const snapshot = playerDefaults();
    expect(Object.isFrozen(snapshot)).toBe(true);
    configurePlayer({ hideAbout: false });
    expect(snapshot.hideAbout).toBe(true);
    expect(playerDefaults().hideAbout).toBe(false);
  });

  it('keeps the defaults on globalThis, so a second copy of the library sees them', () => {
    configurePlayer({ hideAbout: true });
    const holder = globalThis as unknown as Record<symbol, unknown>;
    expect(holder[Symbol.for('kui-player.defaults')]).toEqual({ hideAbout: true });
  });

  it('resolves hideAbout: the player\'s own value, else the default, else false', () => {
    expect(resolveHideAbout(undefined)).toBe(false);
    expect(resolveHideAbout(true)).toBe(true);
    configurePlayer({ hideAbout: true });
    expect(resolveHideAbout(undefined)).toBe(true);
    expect(resolveHideAbout(false)).toBe(false);
  });
});
