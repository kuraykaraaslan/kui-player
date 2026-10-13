import type { RefObject } from 'react';
import type { SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';
import { useCueTrack } from './useCueTrack.js';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  selectedSecondary: number | null;
  subtitles?: SubtitleTrack[];
};

/** The second line of a dual-language pair (see 9.5): another track, followed on its own clock. */
export function useSecondaryCues({ videoRef, selectedSecondary, subtitles }: Options): string | null {
  const src = selectedSecondary === null ? undefined : subtitles?.[selectedSecondary]?.src;
  return useCueTrack({ videoRef, src });
}
