import type { SubtitleEdge, SubtitleFont, SubtitleFontSize } from './videoplayer.types.js';

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

/** The colours captions are conventionally offered in, per CVAA guidance. */
export const SUBTITLE_COLORS: { label: string; value: string }[] = [
  { label: 'White', value: '#ffffff' },
  { label: 'Yellow', value: '#ffeb3b' },
  { label: 'Cyan', value: '#4dd0e1' },
  { label: 'Green', value: '#81c784' },
  { label: 'Black', value: '#000000' },
];

export const SUBTITLE_BACKGROUNDS: { label: string; value: number }[] = [
  { label: 'Opaque', value: 1 },
  { label: 'Semi-transparent', value: 0.8 },
  { label: 'Light', value: 0.4 },
  { label: 'None', value: 0 },
];

export const SUBTITLE_EDGES: { label: string; value: SubtitleEdge }[] = [
  { label: 'None', value: 'none' },
  { label: 'Drop shadow', value: 'shadow' },
  { label: 'Outline', value: 'outline' },
];

export const SUBTITLE_FONTS: { label: string; value: SubtitleFont; stack: string }[] = [
  { label: 'Sans-serif', value: 'sans', stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: 'Serif', value: 'serif', stack: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'mono', stack: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

export const SUBTITLE_EDGE_STYLES: Record<SubtitleEdge, string> = {
  none: 'none',
  shadow: '0 2px 4px rgba(0,0,0,0.9)',
  outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
};
