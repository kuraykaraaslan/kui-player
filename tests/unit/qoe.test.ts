import { describe, expect, it } from 'vitest';
import { QoeTracker } from '../../modules/videoplayer/videoplayer.qoe';

describe('QoeTracker', () => {
  it('counts only playing time and averages bitrate by it', () => {
    const q = new QoeTracker();
    q.setRendition({ bitrate: 1_000_000, height: 480 }, 0);
    q.setPlaying(true, 0);
    q.setRendition({ bitrate: 3_000_000, height: 1080 }, 10_000);   // 10 s at 1 Mbps
    q.setPlaying(false, 20_000);                                    // 10 s at 3 Mbps
    q.setPlaying(false, 50_000);                                    // paused time is ignored
    const s = q.snapshot(50_000);
    expect(s.playingMs).toBe(20_000);
    expect(s.avgBitrate).toBe(2_000_000);
    expect(s.switches).toBe(1);
  });

  it('measures stalls and keeps them out of playing time', () => {
    const q = new QoeTracker();
    q.setPlaying(true, 0);
    expect(q.stallStart(5_000)).toBe(1);
    expect(q.stallEnd(7_000)).toBe(2_000);
    const s = q.snapshot(15_000);
    expect(s.stallCount).toBe(1);
    expect(s.stallMs).toBe(2_000);
    expect(s.playingMs).toBe(13_000);
    expect(s.stallRatio).toBeCloseTo(2_000 / 15_000);
  });

  it('reports a stall that is still open', () => {
    const q = new QoeTracker();
    q.setPlaying(true, 0);
    q.stallStart(4_000);
    const s = q.snapshot(6_000);
    expect(s.stallCount).toBe(1);
    expect(s.stallMs).toBe(2_000);
    expect(s.playingMs).toBe(4_000);
  });

  it('ignores a repeated stallStart and an unmatched stallEnd', () => {
    const q = new QoeTracker();
    expect(q.stallEnd(100)).toBe(0);
    q.stallStart(100);
    q.stallStart(200);
    expect(q.stallEnd(300)).toBe(200);
  });

  it('passes frame and bandwidth figures through, null when unknown', () => {
    const q = new QoeTracker();
    expect(q.snapshot(0).droppedFrames).toBeNull();
    const s = q.snapshot(0, { dropped: 3, total: 300 }, 5_000_000);
    expect(s.droppedFrames).toBe(3);
    expect(s.bandwidthBps).toBe(5_000_000);
  });

  it('resets between sources', () => {
    const q = new QoeTracker();
    q.setPlaying(true, 0);
    q.stallStart(1000);
    q.stallEnd(2000);
    q.reset();
    expect(q.snapshot(5000).stallCount).toBe(0);
  });
});
