import type { AudioTrackKind, AudioTrackOption } from './videoplayer.types.js';

/**
 * What an audio rendition is for. The sources disagree on vocabulary: HLS says
 * `CHARACTERISTICS="public.accessibility.describes-video"`, DASH says
 * `Role=description`, Safari's `AudioTrack.kind` says `"descriptions"`.
 */
export function audioKind(source: {
  characteristics?: string;
  roles?: readonly (string | { value?: string } | null | undefined)[];
  kind?: string;
}): AudioTrackKind {
  const roles = (source.roles ?? []).map((r) => (typeof r === 'string' ? r : r?.value ?? '').toLowerCase());
  const characteristics = (source.characteristics ?? '').toLowerCase();
  const kind = (source.kind ?? '').toLowerCase();
  if (characteristics.includes('describes-video') || roles.includes('description') || kind === 'descriptions') {
    return 'description';
  }
  if (roles.includes('commentary') || kind === 'commentary') return 'commentary';
  return 'main';
}

const base = (lang?: string) => (lang ?? '').toLowerCase().split('-')[0];

/**
 * The description track to switch to: same language as what is playing now,
 * else the first description track. `null` when the stream has none.
 */
export function pickDescriptionTrack(tracks: readonly AudioTrackOption[], currentIndex: number): number | null {
  const described = tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === 'description');
  if (described.length === 0) return null;
  const language = base(tracks[currentIndex]?.language);
  return (described.find(({ t }) => language && base(t.language) === language) ?? described[0])!.i;
}

/** Where "description off" should return to: the remembered main track, else the same-language one. */
export function pickMainTrack(
  tracks: readonly AudioTrackOption[], currentIndex: number, remembered: number | null,
): number {
  if (remembered !== null && tracks[remembered] && tracks[remembered]!.kind !== 'description') return remembered;
  const language = base(tracks[currentIndex]?.language);
  const mains = tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.kind !== 'description');
  return (mains.find(({ t }) => language && base(t.language) === language) ?? mains[0])?.i ?? currentIndex;
}

export const hasDescription = (tracks: readonly AudioTrackOption[] | undefined): boolean =>
  !!tracks?.some((t) => t.kind === 'description');
