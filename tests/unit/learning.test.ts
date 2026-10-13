import { describe, expect, it } from 'vitest';
import {
  WatchedMap, makeNote, notesToJson, notesToMarkdown, parseNotes, sortNotes,
} from '../../modules/videoplayer/videoplayer.learning';

describe('WatchedMap', () => {
  it('marks what was played through and reports the share', () => {
    const map = new WatchedMap();
    for (let t = 0; t < 50; t += 1) map.mark(t, t + 1, 100);    // played the first half
    expect(map.percent).toBe(50);
    expect(map.runs()).toEqual([{ start: 0, end: 0.5 }]);
  });

  it('does not count a seek as watching', () => {
    const map = new WatchedMap();
    map.mark(0, 1, 100);
    map.mark(1, 90, 100);          // jumped ahead
    map.mark(90, 91, 100);
    expect(map.percent).toBe(2);
    expect(map.runs()).toHaveLength(2);
  });

  it('ignores going backwards and an unknown duration', () => {
    const map = new WatchedMap();
    map.mark(10, 5, 100);
    map.mark(0, 1, 0);
    expect(map.percent).toBe(0);
  });

  it('clamps at the edges and round-trips through an array', () => {
    const map = new WatchedMap();
    map.mark(99, 100, 100);
    expect(map.runs()).toEqual([{ start: 0.99, end: 1 }]);
    const again = new WatchedMap(100, map.toArray());
    expect(again.percent).toBe(map.percent);
  });
});

describe('notes', () => {
  it('makes a note from non-empty text only', () => {
    expect(makeNote(5, '   ')).toBeNull();
    expect(makeNote(65.5, '  mitochondria  ', 1000)).toMatchObject({ time: 65.5, text: 'mitochondria', at: 1000 });
    expect(makeNote(-3, 'x')?.time).toBe(0);
  });

  it('exports in video order as Markdown and JSON', () => {
    const notes = [makeNote(90, 'later', 2)!, makeNote(5, 'first\nline', 1)!];
    expect(sortNotes(notes).map((n) => n.text)).toEqual(['first\nline', 'later']);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    expect(notesToMarkdown(notes, 'Lecture 1', fmt)).toBe('# Lecture 1\n\n- **0:05** — first line\n- **1:30** — later\n');
    expect(JSON.parse(notesToJson(notes, 'Lecture 1'))).toEqual({
      title: 'Lecture 1', notes: [{ time: 5, text: 'first\nline', at: 1 }, { time: 90, text: 'later', at: 2 }],
    });
  });

  it('reads storage defensively', () => {
    expect(parseNotes('nope')).toEqual([]);
    expect(parseNotes([{ id: 'a', time: 1, text: 'ok', at: 1 }, { id: 3 }, null])).toHaveLength(1);
  });
});
