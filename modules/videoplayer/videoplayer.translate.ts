/**
 * On-device subtitle translation through the browser's built-in `Translator`
 * (Chromium desktop, experimental). The translation itself runs on the device;
 * the page makes no request for it. The one network event is the browser
 * fetching the language model the first time a pair is used — which the browser
 * does, not this code, and which is reported as download progress.
 */
export type TranslatorAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export type TranslatorInstance = {
  translate(text: string): Promise<string>;
  destroy?(): void;
};

export type TranslatorApi = {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<TranslatorInstance>;
};

/** The browser's `Translator`, or `null` where it does not exist. */
export function getTranslatorApi(host: object | undefined = typeof globalThis === 'undefined' ? undefined : globalThis): TranslatorApi | null {
  const api = (host as { Translator?: Partial<TranslatorApi> } | undefined)?.Translator;
  return api && typeof api.availability === 'function' && typeof api.create === 'function'
    ? (api as TranslatorApi)
    : null;
}

/** `pt-BR` → `pt`: the model pairs are per language, not per region. */
export const baseLanguage = (tag: string | undefined): string => (tag ?? '').toLowerCase().split('-')[0] ?? '';

export type TranslationTarget = { code: string; availability: TranslatorAvailability };

/** The targets worth offering: supported, and not the language already on screen. */
export async function resolveTargets(
  api: TranslatorApi, source: string, targets: readonly string[],
): Promise<TranslationTarget[]> {
  const from = baseLanguage(source);
  if (!from) return [];
  const out: TranslationTarget[] = [];
  await Promise.all(targets.map(async (code) => {
    const to = baseLanguage(code);
    if (!to || to === from) return;
    try {
      const availability = await api.availability({ sourceLanguage: from, targetLanguage: to });
      if (availability !== 'unavailable') out.push({ code, availability });
    } catch { /* a refusing browser means "not offered" */ }
  }));
  // Keep the order the integrator gave.
  return targets.flatMap((code) => out.filter((t) => t.code === code));
}

export type CueTranslator = {
  /** Translated text, or `null` if the engine failed on this cue. */
  translate(text: string): Promise<string | null>;
  destroy(): void;
};

/**
 * One translator for a language pair, with a per-text cache and de-duplication
 * of in-flight requests — a cue is translated once however many times the
 * playhead passes over it, and a long file is translated cue by cue as it is
 * reached rather than all at once.
 */
export async function createCueTranslator(
  api: TranslatorApi,
  options: { source: string; target: string; onProgress?: (loaded: number) => void },
): Promise<CueTranslator> {
  const instance = await api.create({
    sourceLanguage: baseLanguage(options.source),
    targetLanguage: baseLanguage(options.target),
    monitor: (monitor) => {
      monitor.addEventListener('downloadprogress', (event) => {
        const loaded = (event as Event & { loaded?: number }).loaded;
        if (typeof loaded === 'number') options.onProgress?.(Math.max(0, Math.min(1, loaded)));
      });
    },
  });
  const done = new Map<string, string | null>();
  const pending = new Map<string, Promise<string | null>>();
  return {
    translate(text) {
      if (done.has(text)) return Promise.resolve(done.get(text) ?? null);
      let request = pending.get(text);
      if (!request) {
        request = instance.translate(text)
          .then((result) => { done.set(text, result); return result; })
          .catch(() => { done.set(text, null); return null; })
          .finally(() => { pending.delete(text); });
        pending.set(text, request);
      }
      return request;
    },
    destroy() { instance.destroy?.(); done.clear(); pending.clear(); },
  };
}
