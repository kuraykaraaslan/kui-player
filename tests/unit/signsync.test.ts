import { describe, expect, it } from 'vitest';
import { planSignSync, type SignSyncInput } from '../../modules/videoplayer/videoplayer.signsync';

const base: SignSyncInput = {
  mainTime: 10, mainPlaying: true, mainRate: 1, mainWaiting: false,
  signTime: 10, signPaused: false, signRate: 1,
};

describe('planSignSync', () => {
  it('does nothing when the two are in step', () => {
    expect(planSignSync(base)).toEqual({});
    expect(planSignSync({ ...base, signTime: 10.2 })).toEqual({});   // inside the tolerance
  });

  it('re-aligns once the drift passes the threshold, either way', () => {
    expect(planSignSync({ ...base, signTime: 10.5 })).toEqual({ seekTo: 10 });
    expect(planSignSync({ ...base, signTime: 9.4 })).toEqual({ seekTo: 10 });
    expect(planSignSync({ ...base, signTime: 10.5, threshold: 1 })).toEqual({});
  });

  it('starts when the main video plays and stops when it pauses', () => {
    expect(planSignSync({ ...base, signPaused: true })).toEqual({ play: true });
    expect(planSignSync({ ...base, mainPlaying: false })).toEqual({ pause: true });
    expect(planSignSync({ ...base, mainPlaying: false, signPaused: true })).toEqual({});
  });

  it('holds while the main video buffers', () => {
    expect(planSignSync({ ...base, mainWaiting: true })).toEqual({ pause: true });
    expect(planSignSync({ ...base, mainWaiting: true, signPaused: true })).toEqual({});
  });

  it('follows the playback rate', () => {
    expect(planSignSync({ ...base, mainRate: 1.5 })).toEqual({ rate: 1.5 });
  });

  it('combines corrections', () => {
    expect(planSignSync({ ...base, signTime: 0, signPaused: true, signRate: 2 }))
      .toEqual({ seekTo: 10, rate: 1, play: true });
  });
});
