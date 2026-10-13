import { describe, expect, it, vi } from 'vitest';
import {
  baseLanguage, createCueTranslator, getTranslatorApi, resolveTargets, type TranslatorApi,
} from '../../modules/videoplayer/videoplayer.translate';

function fakeApi(availability: Record<string, 'unavailable' | 'downloadable' | 'downloading' | 'available'>) {
  const translate = vi.fn(async (text: string) => `«${text}»`);
  const create = vi.fn(async (options: { monitor?: (m: EventTarget) => void }) => {
    const monitor = new EventTarget();
    options.monitor?.(monitor);
    monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 0.5 }));
    return { translate, destroy: vi.fn() };
  });
  const api = {
    availability: vi.fn(async ({ targetLanguage }: { targetLanguage: string }) => availability[targetLanguage] ?? 'unavailable'),
    create,
  } as unknown as TranslatorApi;
  return { api, translate, create };
}

describe('feature detection', () => {
  it('is null without the API (Firefox, Safari, mobile Chrome)', () => {
    expect(getTranslatorApi({})).toBeNull();
    expect(getTranslatorApi({ Translator: {} })).toBeNull();
  });
  it('returns the API when it has both methods', () => {
    const { api } = fakeApi({});
    expect(getTranslatorApi({ Translator: api })).toBe(api);
  });
  it('compares languages without the region', () => {
    expect(baseLanguage('pt-BR')).toBe('pt');
    expect(baseLanguage(undefined)).toBe('');
  });
});

describe('resolveTargets', () => {
  it('offers supported targets in the given order, never the source language', async () => {
    const { api } = fakeApi({ tr: 'downloadable', fr: 'available', de: 'unavailable', en: 'available' });
    const targets = await resolveTargets(api, 'en-US', ['fr', 'de', 'en', 'tr']);
    expect(targets).toEqual([{ code: 'fr', availability: 'available' }, { code: 'tr', availability: 'downloadable' }]);
  });
  it('offers nothing when the source language is unknown, or the browser throws', async () => {
    const { api } = fakeApi({ tr: 'available' });
    expect(await resolveTargets(api, '', ['tr'])).toEqual([]);
    const broken = { availability: async () => { throw new Error('nope'); }, create: async () => ({}) } as unknown as TranslatorApi;
    expect(await resolveTargets(broken, 'en', ['tr'])).toEqual([]);
  });
});

describe('createCueTranslator', () => {
  it('reports model download progress', async () => {
    const { api } = fakeApi({ tr: 'downloadable' });
    const progress: number[] = [];
    await createCueTranslator(api, { source: 'en', target: 'tr', onProgress: (p) => progress.push(p) });
    expect(progress).toEqual([0.5]);
  });

  it('translates each distinct text once, even when asked concurrently and again later', async () => {
    const { api, translate } = fakeApi({ tr: 'available' });
    const t = await createCueTranslator(api, { source: 'en', target: 'tr' });
    const [a, b] = await Promise.all([t.translate('Hello'), t.translate('Hello')]);
    expect(a).toBe('«Hello»');
    expect(b).toBe('«Hello»');
    await t.translate('Hello');
    await t.translate('Bye');
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('turns an engine failure into null and does not retry it forever', async () => {
    const { api, translate } = fakeApi({ tr: 'available' });
    translate.mockRejectedValueOnce(new Error('boom'));
    const t = await createCueTranslator(api, { source: 'en', target: 'tr' });
    expect(await t.translate('Hello')).toBeNull();
    expect(await t.translate('Hello')).toBeNull();
    expect(translate).toHaveBeenCalledTimes(1);
  });
});
