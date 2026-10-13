import { describe, expect, it } from 'vitest';
import { chapterJumpTarget, chapterKind, creditsAt, skippableAt } from '../../modules/videoplayer/videoplayer.chapters';
import type { Chapter } from '../../modules/videoplayer/videoplayer.vtt';

const chapters: Chapter[] = [
  { start: 0, end: 20, title: 'Recap' },
  { start: 20, end: 80, title: 'Intro' },
  { start: 80, end: 500, title: 'Introduction to monads' },
  { start: 500, end: 560, title: 'Credits' },
];

describe('chapterKind', () => {
  it('guesses from the title in several languages, anchored to the whole title', () => {
    expect(chapterKind({ title: 'Intro' })).toBe('intro');
    expect(chapterKind({ title: ' Özet ' })).toBe('recap');
    expect(chapterKind({ title: 'Jenerik' })).toBe('credits');
    expect(chapterKind({ title: 'Introduction to monads' })).toBe('content');
  });
  it('lets an explicit kind win', () => {
    expect(chapterKind({ title: 'Cold open', kind: 'intro' })).toBe('intro');
    expect(chapterKind({ title: 'Intro', kind: 'content' })).toBe('content');
  });
});

describe('skippableAt', () => {
  it('finds the intro or recap under the playhead and where it ends', () => {
    expect(skippableAt(chapters, 5)).toEqual({ kind: 'recap', to: 20, index: 0 });
    expect(skippableAt(chapters, 20)).toEqual({ kind: 'intro', to: 80, index: 1 });
    expect(skippableAt(chapters, 80)).toBeNull();
    expect(skippableAt([], 5)).toBeNull();
  });
});

describe('creditsAt', () => {
  it('returns the credits chapter index or -1', () => {
    expect(creditsAt(chapters, 520)).toBe(3);
    expect(creditsAt(chapters, 100)).toBe(-1);
  });
});

describe('chapterJumpTarget', () => {
  it('jumps forward to the next chapter start', () => {
    expect(chapterJumpTarget(chapters, 30, 'next')).toBe(80);
    expect(chapterJumpTarget(chapters, 520, 'next')).toBeNull();
  });
  it('restarts the chapter first, then goes back', () => {
    expect(chapterJumpTarget(chapters, 30, 'previous')).toBe(20);   // >3 s in: restart
    expect(chapterJumpTarget(chapters, 21, 'previous')).toBe(0);    // <3 s in: previous
    expect(chapterJumpTarget(chapters, 1, 'previous')).toBe(0);     // first chapter
  });
  it('has nowhere to go without chapters', () => {
    expect(chapterJumpTarget([], 10, 'next')).toBeNull();
  });
});
