import { useEffect, useState, type RefObject } from 'react';
import {
  createCueTranslator, getTranslatorApi, resolveTargets, type CueTranslator, type TranslationTarget,
} from '../../modules/videoplayer/videoplayer.translate.js';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';
import { useCueTrack } from './useCueTrack.js';

/**
 * Which translation targets to offer for the track now playing. Empty — so the
 * menu shows nothing — where the browser has no `Translator`, no source
 * language is known, or the pair is unsupported.
 */
export function useTranslationTargets(
  targets: readonly string[] | undefined, source: SubtitleTrack | undefined,
): TranslationTarget[] {
  const [result, setResult] = useState<{ key: string; list: TranslationTarget[] }>({ key: '', list: [] });
  const key = `${source?.srclang ?? ''}|${(targets ?? []).join(',')}`;
  const lang = source?.srclang;

  useEffect(() => {
    const api = getTranslatorApi();
    if (!api || !lang || !targets?.length) return;
    let cancelled = false;
    void resolveTargets(api, lang, targets).then((list) => { if (!cancelled) setResult({ key, list }); });
    return () => { cancelled = true; };
    // `key` summarises the inputs; `targets` is usually a fresh array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return result.key === key ? result.list : [];
}

export type TranslationLine = {
  text: string | null;
  /** Model download progress 0–1 while the browser fetches the language pair. */
  downloading: number | null;
  failed: boolean;
};

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  source: SubtitleTrack | undefined;
  target: string | null;
};

/**
 * The current cue of `source`, translated into `target` on the device. Cues are
 * translated as the playhead reaches them, and each at most once.
 */
export function useTranslatedCues({ videoRef, source, target }: Options): TranslationLine {
  const raw = useCueTrack({ videoRef, src: target ? source?.src : undefined });
  const srcLang = source?.srclang;
  const active = Boolean(target && srcLang && source?.src);

  const [translator, setTranslator] = useState<{ pair: string; value: CueTranslator } | null>(null);
  const [progress, setProgress] = useState<{ pair: string; value: number | null }>({ pair: '', value: null });
  const [failedPair, setFailedPair] = useState('');
  const [out, setOut] = useState<{ key: string; text: string | null }>({ key: '', text: null });
  const pair = active ? `${srcLang}>${target}` : '';

  // One translator per language pair; created on selection, inside the viewer's click.
  useEffect(() => {
    const api = getTranslatorApi();
    if (!pair || !api || !srcLang || !target) return;
    let cancelled = false;
    let created: CueTranslator | null = null;
    createCueTranslator(api, {
      source: srcLang, target,
      onProgress: (value) => { if (!cancelled) setProgress({ pair, value: value < 1 ? value : null }); },
    }).then((value) => {
      if (cancelled) { value.destroy(); return; }
      created = value;
      setTranslator({ pair, value });
      setProgress({ pair, value: null });
    }).catch(() => { if (!cancelled) setFailedPair(pair); });
    return () => { cancelled = true; created?.destroy(); };
  }, [pair, srcLang, target]);

  useEffect(() => {
    if (!raw || !translator || translator.pair !== pair) return;
    let cancelled = false;
    void translator.value.translate(raw).then((text) => {
      if (!cancelled) setOut({ key: `${pair}|${raw}`, text });
    });
    return () => { cancelled = true; };
  }, [raw, translator, pair]);

  const ready = translator?.pair === pair;
  const current = Boolean(raw) && out.key === `${pair}|${raw}`;
  return {
    text: active && ready && current ? out.text : null,
    downloading: progress.pair === pair ? progress.value : null,
    failed: failedPair === pair || (current && out.text === null),
  };
}
