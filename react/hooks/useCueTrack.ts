import { useEffect, useState, type RefObject } from 'react';
import { findAt } from '../../modules/videoplayer/videoplayer.timeline.js';
import type { VttCue } from '../../modules/videoplayer/videoplayer.vtt.js';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The subtitle file to follow; `undefined` for none. */
  src: string | undefined;
};

/**
 * The text of the cue covering the playhead, for any subtitle file. Always
 * fetched and timed here, in whatever format it comes — the primary track may
 * own the element's text track (WebVTT), and one video cannot show two through
 * that route. It also keeps tracks on independent clocks: a translation whose
 * cues do not line up with the original still advances on its own timing.
 */
export function useCueTrack({ videoRef, src }: Options): string | null {
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
