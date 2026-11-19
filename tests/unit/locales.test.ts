import { describe, expect, it } from 'vitest';
import { en, type Dictionary } from '../../react/i18n/index';
import * as shipped from '../../react/i18n/locales/index';

/**
 * Every locale in the `locales` entry must carry every string the player can
 * show. A missing key would silently fall back to English mid-sentence, which
 * reads worse than no translation at all.
 */
const locales = Object.entries(shipped) as [string, Partial<Dictionary>][];
const keys = Object.keys(en) as (keyof Dictionary)[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** The strings live mode, the reconnect and the presence check added. */
const LIVE_KEYS: (keyof Dictionary)[] = [
  'live', 'goLive', 'behindLive', 'stats.latency',
  'presenceTitle', 'presenceCountdown', 'presenceContinue', 'presencePaused', 'play',
  'reconnecting', 'retrying', 'tryAgain',
  'error.LIVE_REFUSED', 'error.LIVE_UNAVAILABLE',
  'state.reconnecting', 'state.presencePaused', 'state.recovered',
];

describe('shipped locales', () => {
  it('ships the locales the docs promise', () => {
    expect(locales.map(([name]) => name).sort()).toEqual(['ar', 'de', 'es', 'fr', 'tr']);
  });

  it('has an English string for every live and presence key', () => {
    for (const key of LIVE_KEYS) expect(en[key], key).toEqual(expect.any(String));
  });

  it.each(locales)('%s translates every key', (_name, dictionary) => {
    const missing = keys.filter((key) => typeof dictionary[key] !== 'string' || dictionary[key] === '');
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s keeps the placeholders of every string', (_name, dictionary) => {
    const broken = keys.filter((key) => {
      const source = en[key];
      const text = dictionary[key];
      return typeof source === 'string' && typeof text === 'string'
        && placeholders(source).join() !== placeholders(text).join();
    });
    expect(broken).toEqual([]);
  });

  it.each(locales)('%s translates the live and presence prompts rather than copying English', (_name, dictionary) => {
    // `LIVE` is a loanword in several languages, so the badge is not checked.
    const copied = LIVE_KEYS
      .filter((key) => key !== 'live')
      .filter((key) => dictionary[key] === en[key]);
    expect(copied).toEqual([]);
  });
});
