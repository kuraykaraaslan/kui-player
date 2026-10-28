import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, within } from '@testing-library/react';
import { defineKuiPlayer, type KuiPlayerElement } from '../../embed/webComponent';
import { setPagePresence } from '../../embed/pagePresence';
import { emit } from '../setup';
import { fakeAdapter, stubObservers } from './skin-harness';

/*
 * `<kui-player>` and the embed script: the same options as attributes (and a
 * few properties), the engine's events as `kui-*` DOM events, and a page-level
 * "Still watching?" from `data-*` attributes on the script tag.
 */

const LIVE = 'https://example.com/cam/live.m3u8';
const SECOND = 1000;

let observers: ReturnType<typeof stubObservers>;
beforeEach(() => { observers = stubObservers(); defineKuiPlayer(); });
afterEach(() => {
  setPagePresence(null);
  observers.restore();
  document.body.innerHTML = '';
  document.head.querySelectorAll('script[data-auto]').forEach((s) => s.remove());
});

function element(attrs: Record<string, string> = {}, props: Partial<KuiPlayerElement> = {}): KuiPlayerElement {
  const el = document.createElement('kui-player') as KuiPlayerElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  Object.assign(el, props);
  act(() => { document.body.appendChild(el); });
  return el;
}

describe('<kui-player>: live-stream options', () => {
  it('opens an adapter-managed source through the adapters property, with live from its attribute', async () => {
    const { adapter, hosts } = fakeAdapter();
    const el = element({ src: LIVE, live: '{"credentials":"include"}' }, { adapters: [adapter] });
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(hosts[0]!.live).toMatchObject({ hinted: true, credentials: 'include' });
    // The adapter owns the pipeline: the element must not load the address too.
    expect(el.video.hasAttribute('src')).toBe(false);
    expect(el.src).toBe(LIVE);
  });

  it('plays a source no adapter claims through the element itself', () => {
    const { adapter } = fakeAdapter();
    const el = element({ src: 'https://example.com/a.mp4' }, { adapters: [adapter] });
    expect(el.video.getAttribute('src')).toBe('https://example.com/a.mp4');
    expect(adapter.attach).not.toHaveBeenCalled();
  });

  it('holds the source back with load-on-play', async () => {
    const { adapter, hosts } = fakeAdapter();
    const el = element({ src: LIVE, live: '', 'load-on-play': '' }, { adapters: [adapter] });
    await act(async () => { await Promise.resolve(); });
    expect(adapter.attach).not.toHaveBeenCalled();
    act(() => el.skin!.engine.play());
    await waitFor(() => expect(hosts).toHaveLength(1));
  });

  it('turns load-on-play off in place', async () => {
    const { adapter, hosts } = fakeAdapter();
    const el = element({ src: LIVE, 'load-on-play': '' }, { adapters: [adapter] });
    expect(adapter.attach).not.toHaveBeenCalled();
    const skin = el.skin;
    act(() => el.removeAttribute('load-on-play'));
    await waitFor(() => expect(hosts).toHaveLength(1));
    expect(el.skin).toBe(skin);   // no remount
  });

  it('dispatches kui-* events for the engine\'s', async () => {
    const { adapter, hosts } = fakeAdapter();
    const el = element({ src: LIVE, live: '' }, { adapters: [adapter] });
    await waitFor(() => expect(hosts).toHaveLength(1));
    const reconnect = vi.fn();
    const error = vi.fn();
    el.addEventListener('kui-live-reconnect', (e) => reconnect((e as CustomEvent).detail));
    el.addEventListener('kui-error', (e) => error((e as CustomEvent).detail));

    act(() => hosts[0]!.updateRecovery?.({ reconnecting: true, attempt: 2, reason: 'network' }));
    expect(reconnect).toHaveBeenCalledWith({ attempt: 2, reason: 'network' });
    act(() => {
      hosts[0]!.reportError({ code: 2, name: 'LIVE_UNAVAILABLE', message: 'gone', recoverable: false });
    });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ name: 'LIVE_UNAVAILABLE' }));
  });

  it('lists the sources attribute in the quality menu and reports a change as kui-source-change', async () => {
    const sources = [{ label: 'Standard', src: 'https://example.com/sd.mp4' }, { label: 'High', src: 'https://example.com/hd.mp4' }];
    const el = element({ sources: JSON.stringify(sources), 'prefer-alternate-in-fullscreen': '' });
    expect(el.video.getAttribute('src')).toBe(sources[0]!.src);
    expect(el.sources).toEqual(sources);

    const changed = vi.fn();
    el.addEventListener('kui-source-change', (e) => changed((e as CustomEvent).detail));
    act(() => {
      (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = document.body;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(el.video.getAttribute('src')).toBe(sources[1]!.src);
    expect(changed).toHaveBeenCalledWith({ index: 1, source: sources[1] });
    act(() => {
      (document as unknown as { fullscreenElement: Element | null }).fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
  });

  it('asks "Still watching?" from the presence attributes, inside the player', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      const el = element({ src: 'https://example.com/a.mp4', 'presence-every-ms': '5000', 'presence-grace-ms': '5000' });
      const asked = vi.fn();
      el.addEventListener('kui-presence-ask', (e) => asked((e as CustomEvent).detail));
      act(() => { void el.video.play(); });
      act(() => { vi.advanceTimersByTime(5 * SECOND); });
      expect(asked).toHaveBeenCalledWith({ graceMs: 5000 });
      act(() => { vi.advanceTimersByTime(5 * SECOND); });
      expect(el.video.paused).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('joins the page\'s group unless presence="off"', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      setPagePresence({ everyMs: 10 * SECOND, graceMs: 5 * SECOND });
      const joined = element({ src: 'https://example.com/a.mp4' });
      const out = element({ src: 'https://example.com/b.mp4', presence: 'off' });
      act(() => { void joined.video.play(); void out.video.play(); });
      act(() => { vi.advanceTimersByTime(10 * SECOND); });
      expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
      act(() => { vi.advanceTimersByTime(5 * SECOND); });
      expect(joined.video.paused).toBe(true);
      expect(out.video.paused).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes a presence group through the property, and live in place', () => {
    const el = element({ src: 'https://example.com/a.mp4' });
    const skin = el.skin;
    act(() => { el.live = { dvr: true }; el.presence = false; });
    expect(el.skin).toBe(skin);
    expect(el.live).toEqual({ dvr: true });
    expect(el.presence).toBe(false);
  });
});

describe('the embed script', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as { kuiPlayer?: unknown }).kuiPlayer;
    delete (window as { __tepegozVideoPlayer?: unknown }).__tepegozVideoPlayer;
  });

  function script(data: Record<string, string>) {
    const tag = document.createElement('script');
    // Each test imports a fresh copy of the bundle; one still watching the document would skin the next test's videos.
    for (const [name, value] of Object.entries({ observe: 'false', ...data })) tag.setAttribute(`data-${name}`, value);
    document.head.appendChild(tag);
  }

  it('makes the page\'s group from data-presence-* attributes and skins the videos into it', async () => {
    document.body.innerHTML = '<video id="a" src="a.mp4"></video><video id="b" src="b.mp4"></video><video id="c" src="c.mp4" data-kui-presence="off"></video>';
    script({ auto: 'video', 'presence-every-ms': '600000', 'presence-grace-ms': '30000' });
    await import('../../embed/index');
    const api = window.kuiPlayer!;

    const group = api.getPagePresence();
    expect(group?.options).toEqual({ everyMs: 600000, graceMs: 30000 });
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-kui-skinned]')).toHaveLength(3);
    api.unmountAll();
    api.setPagePresence(null);
    expect(document.querySelectorAll('[data-kui-presence-prompt]')).toHaveLength(0);
  });

  /** A page video whose stream has no end: an unbounded duration and a seekable window. */
  function liveVideo() {
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'seekable', { configurable: true, value: { length: 1, start: () => 0, end: () => 100 } });
    act(() => { emit(video, 'durationchange', { duration: Infinity }); emit(video, 'timeupdate'); });
    const host = document.querySelector('[data-tepegoz-video-player]') as HTMLElement;
    return within(host.shadowRoot as unknown as HTMLElement);
  }

  it('applies data-live to the skinned videos: a seek bar over the DVR window', async () => {
    document.body.innerHTML = '<video src="a.mp4"></video>';
    script({ auto: 'video', live: '{"dvr":true}' });
    await import('../../embed/index');
    expect(await liveVideo().findByRole('slider', { name: 'Seek' })).toBeInTheDocument();
  });

  it('shows a live element with no seek bar by default', async () => {
    document.body.innerHTML = '<video src="a.mp4"></video>';
    script({ auto: 'video' });
    await import('../../embed/index');
    const chrome = liveVideo();
    expect(await chrome.findByRole('button', { name: /LIVE|Go to live edge/ })).toBeInTheDocument();
    expect(chrome.queryByRole('slider', { name: 'Seek' })).not.toBeInTheDocument();
  });

  it('data-live="false" turns the live behaviours off', async () => {
    document.body.innerHTML = '<video src="a.mp4"></video>';
    script({ auto: 'video', live: 'false' });
    await import('../../embed/index');
    expect(await liveVideo().findByRole('slider', { name: 'Seek' })).toBeInTheDocument();
  });

  it('keeps the old behaviour with no new attributes: no group, no prompt', async () => {
    document.body.innerHTML = '<video id="a" src="a.mp4"></video>';
    script({ auto: 'video' });
    await import('../../embed/index');
    expect(window.kuiPlayer!.getPagePresence()).toBeNull();
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
  });

  it('data-presence="off" keeps the players out of the group, and offers no group', async () => {
    document.body.innerHTML = '<video id="a" src="a.mp4"></video>';
    script({ auto: 'video', presence: 'off', 'presence-every-ms': '1000', 'presence-grace-ms': '1000' });
    await import('../../embed/index');
    expect(window.kuiPlayer!.getPagePresence()).toBeNull();
  });

  it('makes a group on demand from the global', async () => {
    await import('../../embed/index');
    const api = window.kuiPlayer!;
    const group = api.createPagePresenceGroup({ everyMs: 1000, graceMs: 1000, prompt: false });
    expect(document.querySelector('[data-kui-presence-prompt]')).toBeNull();
    expect(api.getPagePresence()).toBeNull();   // made, not made the default
    expect(api.setPagePresence(group)).toBe(group);
    expect(api.getPagePresence()).toBe(group);
  });
});
