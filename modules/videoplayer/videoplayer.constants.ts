import type { SubtitleFontSize } from './videoplayer.types';

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const SUBTITLE_SIZES: Record<SubtitleFontSize, string> = {
  sm: '0.8rem',
  md: '1rem',
  lg: '1.3rem',
  xl: '1.65rem',
};

export const SUBTITLE_SIZE_LABELS: Record<SubtitleFontSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'X-Large',
};
