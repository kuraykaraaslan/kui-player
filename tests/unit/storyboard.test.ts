import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script, no type declarations
import { buildVtt, formatTimestamp } from '../../scripts/storyboard.mjs';
import { parseStoryboard } from '../../modules/videoplayer/videoplayer.vtt';

describe('storyboard generator', () => {
  it('formats cue timestamps', () => {
    expect(formatTimestamp(3723.5)).toBe('01:02:03.500');
  });

  it('round-trips through the seek-preview reader', () => {
    const vtt = buildVtt({ duration: 23, interval: 5, width: 160, height: 90, columns: 3, sprite: 'sprite.jpg' });
    const tiles = parseStoryboard(vtt, 'https://cdn.test/v/thumbs.vtt');
    expect(tiles).toHaveLength(5);
    expect(tiles[0]).toMatchObject({ start: 0, end: 5 });
    expect(tiles[3]).toMatchObject({ start: 15, end: 20 });
    expect(tiles[4].end).toBe(23);
    expect(tiles[3].rect).toEqual({ x: 0, y: 90, w: 160, h: 90 });
    expect(tiles[0].url).toBe('https://cdn.test/v/sprite.jpg');
  });
});
