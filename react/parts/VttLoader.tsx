import { useEffect } from 'react';
import { useVttResource } from '../hooks/useVttResource.js';
import { parseChapters, parseStoryboard } from '../../modules/videoplayer/videoplayer.vtt.js';
import type { Chapter, StoryboardTile } from '../../modules/videoplayer/videoplayer.vtt.js';

const NO_CHAPTERS: Chapter[] = [];
const NO_TILES: StoryboardTile[] = [];

/**
 * Fetches and parses the WebVTT sidecars, and hands the results back up.
 * Rendered only when a chapters or storyboard URL is supplied, which keeps the
 * parser out of every player that has neither.
 */
export default function VttLoader({
  chaptersUrl, thumbnailsUrl, onChapters, onTiles,
}: {
  chaptersUrl?: string;
  thumbnailsUrl?: string;
  onChapters: (chapters: Chapter[]) => void;
  onTiles: (tiles: StoryboardTile[]) => void;
}) {
  const chapters = useVttResource(chaptersUrl, parseChapters, NO_CHAPTERS);
  const tiles = useVttResource(thumbnailsUrl, parseStoryboard, NO_TILES);

  useEffect(() => { onChapters(chapters); }, [chapters, onChapters]);
  useEffect(() => { onTiles(tiles); }, [tiles, onTiles]);

  return null;
}
