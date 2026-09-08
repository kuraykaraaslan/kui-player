import { beforeEach, describe, expect, it } from 'vitest';
import {
  PlayerStorage, hashSource, MIN_RESUME_SECONDS,
} from '../../modules/videoplayer/videoplayer.persist';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => { storage = memoryStorage(); });

describe('hashSource', () => {
  it('is stable, short, and never stores the URL itself', () => {
    const a = hashSource('https://example.com/a.mp4');
    expect(a).toBe(hashSource('https://example.com/a.mp4'));
    expect(a).not.toBe(hashSource('https://example.com/b.mp4'));
    expect(a).toMatch(/^[a-z0-9]+$/);
    expect(a.length).toBeLessThan(10);
  });
});

describe('PlayerStorage', () => {
  it('round-trips preferences', () => {
    const store = new PlayerStorage({ storage });
    store.writePreferences({ volume: 0.4, muted: true, speed: 1.5, subtitleFontSize: 'lg' });
    expect(store.readPreferences()).toEqual({ volume: 0.4, muted: true, speed: 1.5, subtitleFontSize: 'lg' });
  });

  it('round-trips a position', () => {
    const store = new PlayerStorage({ storage });
    store.writePosition('a.mp4', 120, 600);
    expect(store.readPosition('a.mp4')).toMatchObject({ time: 120, duration: 600 });
  });

  it('ignores a position too close to the start to be worth resuming', () => {
    const store = new PlayerStorage({ storage });
    store.writePosition('a.mp4', MIN_RESUME_SECONDS - 1, 600);
    expect(store.readPosition('a.mp4')).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('forgets a position once the viewer has effectively finished', () => {
    const store = new PlayerStorage({ storage });
    store.writePosition('a.mp4', 100, 600);
    expect(store.readPosition('a.mp4')).not.toBeNull();
    store.writePosition('a.mp4', 590, 600);
    expect(store.readPosition('a.mp4')).toBeNull();
  });

  it('expires a position after its TTL', () => {
    const store = new PlayerStorage({ storage, ttlDays: 1 });
    store.writePosition('a.mp4', 100, 600);
    const key = [...storage.map.keys()][0]!;
    const stored = JSON.parse(storage.map.get(key)!);
    storage.map.set(key, JSON.stringify({ ...stored, at: Date.now() - 3 * 24 * 60 * 60 * 1000 }));
    expect(store.readPosition('a.mp4')).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it('honours the feature switches', () => {
    const store = new PlayerStorage({ storage, resume: false, preferences: false });
    store.writePosition('a.mp4', 100, 600);
    store.writePreferences({ volume: 0.2 });
    expect(storage.map.size).toBe(0);
    expect(store.readPosition('a.mp4')).toBeNull();
    expect(store.readPreferences()).toBeNull();
  });

  it('namespaces keys so two players can coexist', () => {
    new PlayerStorage({ storage, key: 'one' }).writePosition('a.mp4', 100, 600);
    const other = new PlayerStorage({ storage, key: 'two' });
    expect(other.readPosition('a.mp4')).toBeNull();
    expect([...storage.map.keys()][0]).toMatch(/^one:pos:/);
  });

  it('shrugs off unusable storage rather than throwing', () => {
    const hostile = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const store = new PlayerStorage({ storage: hostile });
    expect(() => store.writePosition('a.mp4', 100, 600)).not.toThrow();
    expect(store.readPosition('a.mp4')).toBeNull();
    expect(store.readPreferences()).toBeNull();
  });

  it('survives someone else\'s data in its key', () => {
    storage.map.set('kui-player:prefs', 'not json');
    expect(new PlayerStorage({ storage }).readPreferences()).toBeNull();
  });
});
