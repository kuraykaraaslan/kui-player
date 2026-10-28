import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresenceGroup, isPresenceGroup, type PresenceEvent, type PresenceMember,
} from '../../modules/videoplayer/videoplayer.presence';
import { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function member(playing = true) {
  const events: PresenceEvent['type'][] = [];
  const m: PresenceMember & { playing: boolean; events: typeof events } = {
    playing,
    events,
    isPlaying() { return this.playing; },
    onEvent(e) { events.push(e.type); },
  };
  return m;
}

describe('createPresenceGroup', () => {
  it('rejects a missing or non-positive interval', () => {
    expect(() => createPresenceGroup({ everyMs: 0, graceMs: 1000 })).toThrow(TypeError);
    expect(() => createPresenceGroup({ everyMs: 1000, graceMs: Number.NaN })).toThrow(TypeError);
  });

  it('is recognised by isPresenceGroup, and plain options are not', () => {
    expect(isPresenceGroup(createPresenceGroup({ everyMs: 1, graceMs: 1 }))).toBe(true);
    expect(isPresenceGroup({ everyMs: 1, graceMs: 1 })).toBe(false);
    expect(isPresenceGroup(undefined)).toBe(false);
  });

  it('has no timer until somebody plays', () => {
    const group = createPresenceGroup({ everyMs: 1000, graceMs: 500 });
    const m = member(false);
    group.join(m);
    vi.advanceTimersByTime(60_000);
    expect(group.store.getState().phase).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);

    m.playing = true;
    group.update();
    expect(group.store.getState().phase).toBe('watching');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('asks every member once, counts the grace period down, and stops those that are playing', () => {
    const group = createPresenceGroup({ everyMs: 10_000, graceMs: 4000 });
    const playing = member(true);
    const idle = member(false);
    group.join(playing);
    group.join(idle);

    vi.advanceTimersByTime(10_000);
    expect(group.store.getState().phase).toBe('asking');
    expect(playing.events).toEqual(['ask']);
    expect(idle.events).toEqual(['ask']);

    vi.advanceTimersByTime(1000);
    expect(group.store.getState().remainingMs).toBeLessThanOrEqual(3000);
    expect(group.store.getState().remainingMs).toBeGreaterThan(2500);

    vi.advanceTimersByTime(3000);
    expect(playing.events).toEqual(['ask', 'timeout']);
    expect(idle.events).toEqual(['ask']);   // it was not playing: nothing to stop
    expect(group.store.getState().phase).toBe('idle');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts over after Continue', () => {
    const group = createPresenceGroup({ everyMs: 10_000, graceMs: 4000 });
    const m = member();
    group.join(m);
    vi.advanceTimersByTime(10_000);
    group.confirm();
    expect(m.events).toEqual(['ask', 'continue']);
    expect(group.store.getState()).toMatchObject({ phase: 'watching', remainingMs: 4000 });

    vi.advanceTimersByTime(9_900);
    expect(group.store.getState().phase).toBe('watching');
    vi.advanceTimersByTime(200);
    expect(group.store.getState().phase).toBe('asking');
  });

  it('withdraws the question when everything stopped by itself', () => {
    const group = createPresenceGroup({ everyMs: 1000, graceMs: 4000 });
    const m = member();
    group.join(m);
    vi.advanceTimersByTime(1000);
    m.playing = false;
    group.update();
    expect(m.events).toEqual(['ask', 'dismiss']);
    expect(group.store.getState().phase).toBe('idle');
  });

  it('forgets a member that leaves, and survives one that throws', () => {
    const group = createPresenceGroup({ everyMs: 1000, graceMs: 500 });
    const bad: PresenceMember = { isPlaying: () => true, onEvent: () => { throw new Error('boom'); } };
    const good = member();
    const leave = group.join(bad);
    group.join(good);
    vi.advanceTimersByTime(1000);
    expect(good.events).toEqual(['ask']);

    leave();
    group.confirm();
    vi.advanceTimersByTime(1000);
    expect(good.events).toEqual(['ask', 'continue', 'ask']);
  });

  it('does nothing after dispose', () => {
    const group = createPresenceGroup({ everyMs: 1000, graceMs: 500 });
    const m = member();
    group.join(m);
    group.dispose();
    vi.advanceTimersByTime(10_000);
    expect(m.events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('a group of nine players', () => {
  function wall() {
    const group = createPresenceGroup({ everyMs: 60_000, graceMs: 20_000 });
    const engines = Array.from({ length: 9 }, () => {
      const video = document.createElement('video');
      document.body.appendChild(video);
      const engine = new VideoPlayerEngine({ presence: group, qoeIntervalMs: 0, autoHideControls: false });
      engine.attach(video);
      return { engine, video };
    });
    const asks = vi.fn();
    const timeouts = vi.fn();
    for (const { engine } of engines) {
      engine.on('presence:ask', asks);
      engine.on('presence:timeout', timeouts);
    }
    return { group, engines, asks, timeouts };
  }

  it('shares one timer and asks once for all nine', () => {
    const { group, engines, asks } = wall();
    for (const { engine } of engines) engine.play();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(60_000);
    expect(group.store.getState().phase).toBe('asking');
    // One question: the group went to "asking" once, and every player heard it once.
    expect(asks).toHaveBeenCalledTimes(9);
    for (const { engine } of engines) expect(engine.store.getState().ownPresence).toBeNull();
  });

  it('stops all nine within the grace period when nobody answers', () => {
    const { engines, timeouts } = wall();
    for (const { engine } of engines) engine.play();
    vi.advanceTimersByTime(60_000 + 20_000);
    expect(timeouts).toHaveBeenCalledTimes(9);
    for (const { engine, video } of engines) {
      expect(video.paused).toBe(true);
      expect(engine.store.getState().presencePaused).toBe(true);
    }
  });

  it('keeps all nine playing when one answer comes in', () => {
    const { group, engines, timeouts } = wall();
    for (const { engine } of engines) engine.play();
    vi.advanceTimersByTime(60_000 + 10_000);
    group.confirm();
    vi.advanceTimersByTime(30_000);
    expect(timeouts).not.toHaveBeenCalled();
    for (const { video } of engines) expect(video.paused).toBe(false);
  });

  it('lets a player that was stopped start again on its own', () => {
    const { group, engines } = wall();
    for (const { engine } of engines) engine.play();
    vi.advanceTimersByTime(80_000);
    expect(group.store.getState().phase).toBe('idle');

    const [first, second] = engines;
    first!.engine.togglePlay();
    expect(first!.video.paused).toBe(false);
    expect(second!.video.paused).toBe(true);
    expect(group.store.getState().phase).toBe('watching');
  });

  it('stops counting for a player that was removed', () => {
    const { group, engines, asks } = wall();
    for (const { engine } of engines) { engine.play(); engine.setPresence(undefined); }
    vi.advanceTimersByTime(120_000);
    expect(group.store.getState().phase).toBe('idle');
    expect(asks).not.toHaveBeenCalled();
  });
});
