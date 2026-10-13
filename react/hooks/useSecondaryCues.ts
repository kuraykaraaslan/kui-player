import { useEffect, useState, type RefObject } from 'react';
import { findAt } from '../../modules/videoplayer/videoplayer.timeline.js';
import type { VttCue } from '../../modules/videoplayer/videoplayer.vtt.js';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  selectedSecondary: number | null;
  subtitles?: SubtitleTrack[];
};

/**
 * The second line of a dual-language pair. The primary track may own the
 * element's text track (WebVTT), and one video cannot show two at once through
 * that route — so the secondary is always fetched and timed here, in whatever
 * format it comes. That also keeps the two tracks on independent clocks: a
 * translation whose cues do not line up with the original still advances on its
 * own timing.
 */
export function useSecondaryCues({ videoRef, selectedSecondary, subtitles }: Options): string | null {
  const src = selectedSecondary === null ? undefined : subtitles?.[selectedSecondary]?.src;
  const [loaded, setLoaded] = useState<{ src: string; cues: VttCue[] } | null>(null);
  const [shown, setShown] = useState<{ src: string; text: string | null }>({ src: '', text: null });
  const cues = src && loaded?.src === src ? loaded.cues : null;

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const controller = new AbortController();
    Promise.all([
      fetch(src, { signal: controller.signal })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
      import('../../modules/videoplayer/videoplayer.subtitles.parse.js'),
    ])
      .then(([text, { parseSubtitles }]) => { if (!cancelled) setLoaded({ src, cues: parseSubtitles(text, src) }); })
      .catch(() => { if (!cancelled) setLoaded({ src, cues: [] }); });
    return () => { cancelled = true; controller.abort(); };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cues || !src) return;
    const update = () => {
      const cue = findAt(cues, video.currentTime);
      const active = cue && video.currentTime >= cue.start && video.currentTime < cue.end ? cue : null;
      setShown({ src, text: active?.text ?? null });
    };
    video.addEventListener('timeupdate', update);
    video.addEventListener('seeked', update);
    update();
    return () => {
      video.removeEventListener('timeupdate', update);
      video.removeEventListener('seeked', update);
    };
  }, [videoRef, cues, src]);

  return src && shown.src === src ? shown.text : null;
}
