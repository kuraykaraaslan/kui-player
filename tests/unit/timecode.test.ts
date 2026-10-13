import { describe, expect, it } from 'vitest';
import {
  frameAt, fromTimecode, normaliseFps, parseFrameInput, snapFps, timeOfFrame, toTimecode,
} from '../../modules/videoplayer/videoplayer.timecode';

describe('frame arithmetic', () => {
  it('maps time to frame and back to the middle of the frame', () => {
    expect(frameAt(1, 25)).toBe(25);
    expect(frameAt(0.999, 25)).toBe(24);
    expect(timeOfFrame(25, 25)).toBeCloseTo(1.02);
    expect(frameAt(timeOfFrame(1234, 29.97), 29.97)).toBe(1234);   // round trip at an NTSC rate
  });
  it('treats 29.97 as 30000/1001', () => {
    expect(normaliseFps(29.97)).toBeCloseTo(29.97003, 4);
    expect(normaliseFps(25)).toBe(25);
    expect(normaliseFps(-1)).toBe(30);
  });
  it('snaps a measured rate to a standard one', () => {
    expect(snapFps(29.9)).toBe(29.97);
    expect(snapFps(25.2)).toBe(25);
    expect(snapFps(59.8)).toBe(59.94);
    expect(snapFps(37.5)).toBe(37.5);
  });
});

describe('non-drop timecode', () => {
  it('formats HH:MM:SS:FF', () => {
    expect(toTimecode(0, 25)).toBe('00:00:00:00');
    expect(toTimecode(61.52, 25)).toBe('00:01:01:13');
    expect(toTimecode(3600 + 2, 24)).toBe('01:00:02:00');
  });
  it('parses it back, and rejects frames that do not exist', () => {
    expect(fromTimecode('00:01:01:13', 25)).toBeCloseTo(61.52);
    expect(fromTimecode('00:00:00:25', 25)).toBeNull();
    expect(fromTimecode('00:61:00:00', 25)).toBeNull();
    expect(fromTimecode('nonsense', 25)).toBeNull();
  });
});

describe('drop-frame timecode (29.97)', () => {
  it('skips frame numbers 00 and 01 at the start of each minute, except every tenth', () => {
    // Frame 1800 is the first of minute 1 at 30 nominal fps: the display jumps to ;02.
    expect(toTimecode(1799 / (30000 / 1001) + 1e-4, 29.97, true)).toBe('00:00:59;29');
    expect(toTimecode(1800 / (30000 / 1001) + 1e-4, 29.97, true)).toBe('00:01:00;02');
    // Ten minutes in nothing is dropped: 17982 frames later is exactly 00:10:00;00.
    expect(toTimecode(17982 / (30000 / 1001) + 1e-4, 29.97, true)).toBe('00:10:00;00');
  });
  it('round-trips through the parser', () => {
    for (const frame of [0, 1799, 1800, 17981, 17982, 107892]) {
      const seconds = frame / (30000 / 1001) + 1e-4;
      const tc = toTimecode(seconds, 29.97, true);
      expect(frameAt(fromTimecode(tc, 29.97, true)! + 1e-4, 29.97)).toBe(frame);
    }
  });
  it('refuses a dropped frame number', () => {
    expect(fromTimecode('00:01:00;00', 29.97, true)).toBeNull();
    expect(fromTimecode('00:10:00;00', 29.97, true)).not.toBeNull();   // tenth minute keeps them
  });
});

describe('parseFrameInput', () => {
  it('reads a bare number as a frame and otherwise a timecode', () => {
    expect(parseFrameInput('50', 25)).toBeCloseTo(2.02);
    expect(parseFrameInput('00:00:02:00', 25)).toBe(2);
    expect(parseFrameInput('', 25)).toBeNull();
    expect(parseFrameInput('1.5', 25)).toBeNull();
  });
});
