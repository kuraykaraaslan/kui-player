import type { Chapter } from './videoplayer.vtt.js';

/** What a chapter is for, so the player can offer to skip it. */
export type ChapterKind = 'intro' | 'recap' | 'credits' | 'content';

/**
 * A kind given explicitly always wins. Otherwise it is guessed from the title —
 * the only signal a WebVTT chapters file carries. Anchored at the start so a
 * chapter called "Introduction to monads" is not mistaken for a skippable intro.
 */
const TITLE_KINDS: [ChapterKind, RegExp][] = [
  ['intro', /^(intro|opening|title sequence|giriş|jeneriğe giriş|einleitung|vorspann|introducción|générique d['’]ouverture|مقدمة)\s*$/i],
  ['recap', /^(recap|previously|previously on|özet|önceki bölüm|rückblick|resumen|résumé|ملخص)\s*$/i],
  ['credits', /^(credits|end credits|ending|outro|jenerik|bitiş|abspann|créditos|générique|شارة)\s*$/i],
];

export function chapterKind(chapter: Pick<Chapter, 'title'> & { kind?: ChapterKind }): ChapterKind {
  if (chapter.kind) return chapter.kind;
  const title = chapter.title.trim();
  for (const [kind, pattern] of TITLE_KINDS) if (pattern.test(title)) return kind;
  return 'content';
}

/** Index of the chapter containing `time` (start inclusive, end exclusive), or -1. */
export function chapterIndexAt(chapters: readonly Chapter[], time: number): number {
  return chapters.findIndex((c) => time >= c.start && time < c.end);
}

/** The intro/recap chapter at `time` that can be skipped, with where skipping lands. */
export function skippableAt(
  chapters: readonly Chapter[], time: number,
): { kind: 'intro' | 'recap'; to: number; index: number } | null {
  const index = chapterIndexAt(chapters, time);
  const chapter = chapters[index];
  if (!chapter) return null;
  const kind = chapterKind(chapter);
  return kind === 'intro' || kind === 'recap' ? { kind, to: chapter.end, index } : null;
}

/** The credits chapter at `time`, if the playhead is inside one. */
export function creditsAt(chapters: readonly Chapter[], time: number): number {
  const index = chapterIndexAt(chapters, time);
  const chapter = chapters[index];
  return chapter && chapterKind(chapter) === 'credits' ? index : -1;
}

/**
 * Where `[` / `]` should go. Previous restarts the current chapter when the
 * playhead is more than three seconds in — the convention of every media key.
 * Returns `null` when there is nowhere to go.
 */
export function chapterJumpTarget(
  chapters: readonly Chapter[], time: number, direction: 'previous' | 'next',
): number | null {
  if (chapters.length === 0) return null;
  const index = chapterIndexAt(chapters, time);
  if (direction === 'next') {
    const next = chapters.find((c) => c.start > time);
    return next ? next.start : null;
  }
  const current = chapters[index];
  if (current && time - current.start > 3) return current.start;
  const previous = index > 0 ? chapters[index - 1] : index === -1 ? chapters[chapters.length - 1] : undefined;
  return previous ? previous.start : current ? current.start : null;
}
