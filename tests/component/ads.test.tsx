import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoPlayer } from '../../react';
import { AdsOverlay, type AdEvent, type AdsOverlayProps } from '../../react/ads';
import { emit } from '../setup';

const SRC = 'https://example.com/movie.mp4';

const vast = (id: string, extra = '', skip = '') => `<VAST version="4.2"><Ad id="${id}" ${extra}><InLine>
  <AdTitle>${id}</AdTitle>
  <Impression>https://t.test/imp/${id}?cb=[CACHEBUSTING]</Impression>
  <Error>https://t.test/err/${id}?code=[ERRORCODE]</Error>
  <Creatives><Creative><Linear ${skip}>
    <Duration>00:00:20</Duration>
    <TrackingEvents>
      <Tracking event="start">https://t.test/start/${id}</Tracking>
      <Tracking event="firstQuartile">https://t.test/q1/${id}</Tracking>
      <Tracking event="midpoint">https://t.test/mid/${id}</Tracking>
      <Tracking event="complete">https://t.test/done/${id}</Tracking>
      <Tracking event="skip">https://t.test/skip/${id}</Tracking>
    </TrackingEvents>
    <VideoClicks><ClickThrough>https://brand.test/${id}</ClickThrough><ClickTracking>https://t.test/click/${id}</ClickTracking></VideoClicks>
    <MediaFiles><MediaFile type="video/mp4" width="640" height="360" bitrate="800">https://cdn.test/${id}.mp4</MediaFile></MediaFiles>
  </Linear></Creative></Creatives>
</InLine></Ad></VAST>`;

function setup(props: AdsOverlayProps) {
  const pings: string[] = [];
  const events: AdEvent[] = [];
  const utils = render(
    <VideoPlayer
      src={SRC}
      enableCast={false}
      slots={{ top: <AdsOverlay ping={(u) => pings.push(u)} onEvent={(e) => events.push(e)} {...props} /> as unknown as Node }}
    />,
  );
  const main = utils.container.querySelector('video:not([style])') as HTMLVideoElement;
  const adRegion = () => screen.queryByRole('region', { name: 'Advertisement' });
  return { ...utils, main, pings, events, adRegion };
}

const adVideo = () => document.querySelector('[role="region"] video') as HTMLVideoElement;
const clean = (urls: string[]) => urls.map((u) => u.replace(/cb=\d+/, 'cb=N'));

describe('ads overlay', () => {
  beforeEach(() => { vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('holds the content for a pre-roll, tracks it, and resumes the content afterwards', async () => {
    const { main, pings, events, adRegion } = setup({ tag: vast('pre'), load: async () => '' });
    emit(main, 'loadedmetadata', { duration: 100 });
    act(() => { emit(main, 'play', { paused: false }); });

    const region = await waitFor(() => { const r = adRegion(); expect(r).not.toBeNull(); return r!; }, { timeout: 4000 });
    expect(main.paused).toBe(true);                                   // the film waits
    expect(within(region).getByText(/Ad 1 of 1 · 20s/)).toBeInTheDocument();
    await waitFor(() => expect(clean(pings)).toContain('https://t.test/imp/pre?cb=N'));

    act(() => { emit(adVideo(), 'timeupdate', { currentTime: 6 }); });
    act(() => { emit(adVideo(), 'timeupdate', { currentTime: 11 }); });
    expect(pings).toEqual(expect.arrayContaining(['https://t.test/q1/pre', 'https://t.test/mid/pre']));

    act(() => { emit(adVideo(), 'ended'); });
    await waitFor(() => expect(adRegion()).toBeNull());
    expect(pings).toContain('https://t.test/done/pre');
    expect(main.paused).toBe(false);                                  // and the film starts
    expect(events.map((e) => e.type)).toEqual(['break:start', 'ad:start', 'ad:complete', 'break:end']);
  });

  it('does not start the content under the ad when the viewer presses play again', async () => {
    const { main, adRegion } = setup({ tag: vast('pre'), load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    await waitFor(() => expect(adRegion()).not.toBeNull(), { timeout: 4000 });
    act(() => { main.play(); });
    expect(main.paused).toBe(true);
  });

  it('shows a skip button only once the skip offset is reached, and reports the skip', async () => {
    const user = userEvent.setup();
    const { main, pings, events, adRegion } = setup({ tag: vast('s', '', 'skipoffset="00:00:05"'), load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    const region = await waitFor(() => { const r = adRegion(); expect(r).not.toBeNull(); return r!; }, { timeout: 4000 });
    expect(within(region).getByText('Skip in 5s')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: 'Skip ad' })).not.toBeInTheDocument();

    act(() => { emit(adVideo(), 'timeupdate', { currentTime: 5.2 }); });
    await user.click(await within(region).findByRole('button', { name: 'Skip ad' }));
    await waitFor(() => expect(adRegion()).toBeNull());
    expect(pings).toContain('https://t.test/skip/s');
    expect(events.map((e) => e.type)).toContain('ad:skip');
  });

  it('opens the click-through safely and pauses the ad', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const { main, pings, adRegion } = setup({ tag: vast('c'), load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    const region = await waitFor(() => { const r = adRegion(); expect(r).not.toBeNull(); return r!; }, { timeout: 4000 });
    await user.click(within(region).getByRole('button', { name: 'Learn more' }));
    expect(open).toHaveBeenCalledWith('https://brand.test/c', '_blank', 'noopener,noreferrer');
    expect(pings).toContain('https://t.test/click/c');
    expect(adVideo().paused).toBe(true);
  });

  it('plays a pod in order and says which ad it is', async () => {
    const pod = `<VAST version="4.0">${vast('two', 'sequence="2"').replace(/<\/?VAST[^>]*>/g, '')}${vast('one', 'sequence="1"').replace(/<\/?VAST[^>]*>/g, '')}</VAST>`;
    const { main, events, adRegion } = setup({ tag: pod, load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    await waitFor(() => expect(screen.getByText(/Ad 1 of 2/)).toBeInTheDocument(), { timeout: 4000 });
    act(() => { emit(adVideo(), 'ended'); });
    await waitFor(() => expect(screen.getByText(/Ad 2 of 2/)).toBeInTheDocument());
    act(() => { emit(adVideo(), 'ended'); });
    await waitFor(() => expect(adRegion()).toBeNull());
    expect(events.filter((e) => e.type === 'ad:complete').map((e) => (e as { adId: string }).adId)).toEqual(['one', 'two']);
  });

  it('carries on with the content when the ad tag fails — and pings nothing it was not given', async () => {
    const { main, pings, events, adRegion } = setup({ tag: 'https://ads.test/down', load: async () => { throw new Error('offline'); } });
    act(() => { emit(main, 'play', { paused: false }); });
    await waitFor(() => expect(events.map((e) => e.type)).toEqual(['break:start', 'break:end']), { timeout: 4000 });
    expect(adRegion()).toBeNull();
    expect(main.paused).toBe(false);
    expect(pings).toEqual([]);
  });

  it('reports a file that cannot be played with the VAST error code, then resumes', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    const { main, pings, events } = setup({ tag: vast('bad'), load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    await waitFor(() => expect(events.some((e) => e.type === 'ad:error')).toBe(true), { timeout: 4000 });
    expect(pings).toContain('https://t.test/err/bad?code=403');
    await waitFor(() => expect(main.paused).toBe(false));
  });

  it('runs a VMAP schedule: a mid-roll at its time, once', async () => {
    const vmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="00:00:30" breakType="linear" breakId="mid"><vmap:AdSource><vmap:AdTagURI>https://ads.test/mid</vmap:AdTagURI></vmap:AdSource></vmap:AdBreak></vmap:VMAP>`;
    const { main, events, adRegion } = setup({ vmap, load: async () => vast('mid') });
    emit(main, 'loadedmetadata', { duration: 100 });
    act(() => { emit(main, 'play', { paused: false }); });
    act(() => { emit(main, 'timeupdate', { currentTime: 10 }); });
    expect(adRegion()).toBeNull();                                    // not yet

    act(() => { emit(main, 'timeupdate', { currentTime: 30.5 }); });
    await waitFor(() => expect(adRegion()).not.toBeNull(), { timeout: 4000 });
    act(() => { emit(adVideo(), 'ended'); });
    await waitFor(() => expect(adRegion()).toBeNull());

    act(() => { emit(main, 'timeupdate', { currentTime: 31 }); });
    expect(adRegion()).toBeNull();                                    // each break plays once
    expect(events.filter((e) => e.type === 'break:start')).toHaveLength(1);
  });

  it('makes no request of its own: only the tag it was given is loaded', async () => {
    const load = vi.fn(async () => vast('x'));
    const { main } = setup({ tag: 'https://ads.test/tag', load });
    act(() => { emit(main, 'play', { paused: false }); });
    await waitFor(() => expect(load).toHaveBeenCalledWith('https://ads.test/tag'), { timeout: 4000 });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
