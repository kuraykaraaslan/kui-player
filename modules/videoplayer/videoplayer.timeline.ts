/**
 * Timeline lookups shared by the seek preview and the chapter list. Kept apart
 * from the parsers so a player that never loads a WebVTT sidecar never carries
 * one.
 */

/** The entry covering `time`, using a binary search — storyboards get long. */
export function findAt<T extends { start: number; end: number }>(items: T[], time: number): T | null {
  let low = 0;
  let high = items.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const item = items[mid]!;
    if (time < item.start) high = mid - 1;
    else if (time >= item.end) low = mid + 1;
    else return item;
  }
  // Past the last cue, the last one still describes the frame.
  const last = items[items.length - 1];
  return last && time >= last.end ? last : null;
}
