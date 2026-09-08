import { cn } from '../../libs/utils/cn.js';
import type { Chapter } from '../../modules/videoplayer/videoplayer.vtt.js';

/**
 * Chapter boundaries drawn into the seek bar. The bar stays one slider — the
 * segments are decoration over it, so keyboard and pointer seeking are
 * unaffected.
 */
export function ChapterTrack({
  chapters, duration, progress,
}: {
  chapters: Chapter[];
  duration: number;
  progress: number;
}) {
  if (chapters.length === 0 || duration <= 0) return null;

  return (
    <div className="kui-chapters" aria-hidden="true">
      {chapters.map((chapter) => {
        const left = (chapter.start / duration) * 100;
        const width = ((Math.min(chapter.end, duration) - chapter.start) / duration) * 100;
        if (width <= 0) return null;
        return (
          <span
            key={`${chapter.start}-${chapter.title}`}
            className={cn('kui-chapter', progress >= left && 'is-passed')}
            style={{ insetInlineStart: `${left}%`, width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}
