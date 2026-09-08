import { findAt } from '../../modules/videoplayer/videoplayer.timeline.js';
import type { Chapter, StoryboardTile } from '../../modules/videoplayer/videoplayer.vtt.js';

/**
 * What hovering the seek bar shows: the time, the chapter it lands in, and —
 * when a storyboard is supplied — the frame itself.
 */
export function SeekPreview({
  ratio, time, label, tiles, chapters, duration,
}: {
  ratio: number;
  time: number;
  label: string;
  tiles: StoryboardTile[];
  chapters: Chapter[];
  duration: number;
}) {
  const tile = tiles.length > 0 ? findAt(tiles, time) : null;
  const chapter = chapters.length > 0 ? findAt(chapters, time) : null;
  if (!tile && !chapter) return null;

  const rect = tile?.rect;
  const thumbnail = tile
    ? {
        width: rect?.w ?? 160,
        height: rect?.h ?? 90,
        backgroundImage: `url(${tile.url})`,
        // Sprite sheets: shift the sheet so the wanted tile lands in the box.
        backgroundPosition: rect ? `-${rect.x}px -${rect.y}px` : 'center',
        backgroundSize: rect ? 'auto' : 'cover',
      }
    : null;

  return (
    <div className="kui-preview" style={{ insetInlineStart: `${ratio * 100}%` }} aria-hidden="true">
      {thumbnail && <span className="kui-preview-frame" style={thumbnail} />}
      {chapter && <span className="kui-preview-chapter">{chapter.title}</span>}
      <span className="kui-preview-time">{label}</span>
      {duration <= 0 && null}
    </div>
  );
}
