import { useEffect, useState, type RefObject } from 'react';
import { detectFormat } from '../../modules/videoplayer/videoplayer.subtitles.js';
import { findAt } from '../../modules/videoplayer/videoplayer.timeline.js';
import type { VttCue } from '../../modules/videoplayer/videoplayer.vtt.js';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  selectedSubtitle: number | null;
  subtitles?: SubtitleTrack[];
};

/**
 * The text of the cue that should be on screen right now.
 *
 * WebVTT rides on the element's own text tracks — the browser has already
 * parsed and timed them, and `mode: 'hidden'` gets the cues without letting it
 * draw them. SRT and ASS the browser will not touch, so those are fetched and
 * timed here; either way the same styled overlay renders the result.
 */
export function useSubtitleCues({ videoRef, selectedSubtitle, subtitles }: Options) {
  // Both are keyed by what produced them, so switching track or source shows
  // nothing rather than the previous track's line.
  const [cueState, setCueState] = useState<{ key: string; text: string | null }>({ key: '', text: null });
  const [loaded, setLoaded] = useState<{ src: string; cues: VttCue[] } | null>(null);

  const track = selectedSubtitle === null ? undefined : subtitles?.[selectedSubtitle];
  const src = track?.src;
  const format = src ? detectFormat(src) : 'vtt';
  const isSidecar = format !== 'vtt';
  const cueKey = src ?? '';
  const sidecar = src && loaded?.src === src ? loaded.cues : null;

  // ── formats the element cannot load ──
  useEffect(() => {
    if (!src || !isSidecar) return;
    let cancelled = false;
    const controller = new AbortController();

    // The parser arrives with the file: a player showing WebVTT never loads it.
    Promise.all([
      fetch(src, { signal: controller.signal })
        .then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status))))),
      import('../../modules/videoplayer/videoplayer.subtitles.parse.js'),
    ])
      .then(([text, { parseSubtitles }]) => {
        if (!cancelled) setLoaded({ src, cues: parseSubtitles(text, src) });
      })
      .catch(() => { if (!cancelled) setLoaded({ src, cues: [] }); });

    return () => { cancelled = true; controller.abort(); };
  }, [src, isSidecar]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sidecar) return;

    const onTimeUpdate = () => {
      const cue = findAt(sidecar, video.currentTime);
      // `findAt` returns the last cue once playback is past it; only show a cue
      // that actually covers now.
      const active = cue && video.currentTime >= cue.start && video.currentTime < cue.end ? cue : null;
      setCueState({ key: cueKey, text: active?.text ?? null });
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onTimeUpdate);
    onTimeUpdate();
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onTimeUpdate);
    };
  }, [videoRef, sidecar, cueKey]);

  // ── WebVTT through the element's own text tracks ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((t) => { t.mode = 'disabled'; });

    if (selectedSubtitle === null || !subtitles?.[selectedSubtitle] || isSidecar) return;

    // Only VTT tracks are rendered as <track> children, so the element's track
    // index is not the subtitle index whenever an SRT/ASS track precedes it.
    const vttIndex = subtitles
      .slice(0, selectedSubtitle)
      .filter((sub) => detectFormat(sub.src) === 'vtt').length;
    const textTrack = video.textTracks[vttIndex];
    if (!textTrack) return;

    textTrack.mode = 'hidden';

    // A source swap (quality change / retry) resets every track back to
    // 'disabled' — re-arm the selected one once the new media is ready.
    const reapply = () => { textTrack.mode = 'hidden'; };
    video.addEventListener('loadedmetadata', reapply);

    const onCueChange = () => {
      const active = textTrack.activeCues;
      if (!active || active.length === 0) { setCueState({ key: cueKey, text: null }); return; }
      const text = Array.from(active)
        .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, ''))
        .join('\n');
      setCueState({ key: cueKey, text: text || null });
    };

    textTrack.addEventListener('cuechange', onCueChange);
    return () => {
      textTrack.removeEventListener('cuechange', onCueChange);
      video.removeEventListener('loadedmetadata', reapply);
    };
  }, [videoRef, selectedSubtitle, subtitles, isSidecar, cueKey]);

  return cueState.key === cueKey ? cueState.text : null;
}
