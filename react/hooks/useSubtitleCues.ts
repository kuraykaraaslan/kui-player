import { useEffect, useState, type RefObject } from 'react';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  selectedSubtitle: number | null;
  subtitles?: SubtitleTrack[];
};

export function useSubtitleCues({ videoRef, selectedSubtitle, subtitles }: Options) {
  const [cueText, setCueText] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((t) => { t.mode = 'disabled'; });
    setCueText(null);

    if (selectedSubtitle === null || !subtitles?.[selectedSubtitle]) return;

    const track = video.textTracks[selectedSubtitle];
    if (!track) return;

    track.mode = 'hidden';

    const onCueChange = () => {
      const active = track.activeCues;
      if (!active || active.length === 0) { setCueText(null); return; }
      const text = Array.from(active)
        .map((c) => (c as VTTCue).text.replace(/<[^>]+>/g, ''))
        .join('\n');
      setCueText(text || null);
    };

    track.addEventListener('cuechange', onCueChange);
    return () => track.removeEventListener('cuechange', onCueChange);
  }, [videoRef, selectedSubtitle, subtitles]);

  return cueText;
}
