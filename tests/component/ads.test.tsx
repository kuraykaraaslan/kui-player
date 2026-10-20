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

  it('renders in the player root, not inside the top slot (a 24 px strip that hides with the controls)', async () => {
    const { main, adRegion, container } = setup({ tag: vast('pre'), load: async () => '' });
    act(() => { emit(main, 'play', { paused: false }); });
    const region = await waitFor(() => { const r = adRegion(); expect(r).not.toBeNull(); return r!; }, { timeout: 4000 });
    expect(region.parentElement).toBe(container.querySelector('.kui-player'));
    expect(region.closest('.kui-slot')).toBeNull();
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

  describe('non-linear overlay', () => {
    const nlVast = (extra = '') => `<VAST version="4.2"><Ad id="nl"><InLine>
      <Impression>https://t.test/nl/imp</Impression>
      <Creatives><Creative><NonLinearAds>
        <TrackingEvents><Tracking event="creativeView">https://t.test/nl/view</Tracking></TrackingEvents>
        <NonLinear width="300" height="50" minSuggestedDuration="00:00:07">
          <StaticResource creativeType="image/png">https://cdn.test/banner.png</StaticResource>
          <NonLinearClickThrough>https://brand.test/nl</NonLinearClickThrough>
          <NonLinearClickTracking>https://t.test/nl/click</NonLinearClickTracking>
        </NonLinear>${extra}
      </NonLinearAds></Creative></Creatives>
    </InLine></Ad></VAST>`;
    const vmapNl = (inner = nlVast()) => `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="00:00:10" breakType="nonlinear" breakId="nl"><vmap:AdSource><vmap:VASTAdData>${inner}</vmap:VASTAdData></vmap:AdSource></vmap:AdBreak></vmap:VMAP>`;
    const banner = () => screen.queryByRole('complementary', { name: 'Advertisement' });

    async function reach(props: Partial<AdsOverlayProps> = {}) {
      const ctx = setup({ vmap: vmapNl(), load: async () => '', ...props });
      emit(ctx.main, 'loadedmetadata', { duration: 100 });
      act(() => { emit(ctx.main, 'play', { paused: false }); });
      act(() => { emit(ctx.main, 'timeupdate', { currentTime: 10.5 }); });
      return ctx;
    }

    afterEach(() => { vi.useRealTimers(); });

    it('puts the banner in the player root too', async () => {
      const { container } = await reach();
      const region = await waitFor(() => { const b = banner(); expect(b).not.toBeNull(); return b!; }, { timeout: 4000 });
      expect(region.parentElement).toBe(container.querySelector('.kui-player'));
    });

    it('shows the image over the video at its VMAP time, tracks it, and never pauses the content', async () => {
      const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
      const { main, pings, events } = setup({ vmap: vmapNl(), load: async () => '' });
      emit(main, 'loadedmetadata', { duration: 100 });
      act(() => { emit(main, 'play', { paused: false }); });
      act(() => { emit(main, 'timeupdate', { currentTime: 5 }); });
      expect(banner()).toBeNull();                                    // not yet
      act(() => { emit(main, 'timeupdate', { currentTime: 10.5 }); });
      const region = await waitFor(() => { const b = banner(); expect(b).not.toBeNull(); return b!; }, { timeout: 4000 });
      const img = within(region).getByRole('img') as HTMLImageElement;
      expect(img.src).toBe('https://cdn.test/banner.png');
      expect(main.paused).toBe(false);
      expect(pause).not.toHaveBeenCalled();
      expect(screen.queryByRole('region', { name: 'Advertisement' })).toBeNull();   // no linear ad UI
      expect(pings).toEqual(expect.arrayContaining(['https://t.test/nl/imp', 'https://t.test/nl/view']));
      expect(events.map((e) => e.type)).toEqual(['nonlinear:start']);
    });

    it('can be dismissed, and a break shows only once', async () => {
      const user = userEvent.setup();
      const { main, events } = await reach();
      const region = await waitFor(() => { const b = banner(); expect(b).not.toBeNull(); return b!; }, { timeout: 4000 });
      await user.click(within(region).getByRole('button', { name: 'Close ad' }));
      expect(banner()).toBeNull();
      expect(events).toContainEqual({ type: 'nonlinear:end', adId: 'nl', reason: 'dismiss' });
      act(() => { emit(main, 'timeupdate', { currentTime: 11 }); });
      expect(banner()).toBeNull();
    });

    it('hides itself after minSuggestedDuration (default 10 s when absent)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { events } = await reach();
      await waitFor(() => expect(banner()).not.toBeNull(), { timeout: 4000 });
      await act(async () => {});                                      // let the banner's effect schedule its timer
      act(() => { vi.advanceTimersByTime(6500); });
      expect(banner()).not.toBeNull();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(banner()).toBeNull();
      expect(events).toContainEqual({ type: 'nonlinear:end', adId: 'nl', reason: 'timeout' });
    });

    it('uses 10 s when the ad suggests no duration', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await reach({ vmap: vmapNl(nlVast().replace(' minSuggestedDuration="00:00:07"', '')) });
      await waitFor(() => expect(banner()).not.toBeNull(), { timeout: 4000 });
      await act(async () => {});                                      // let the banner's effect schedule its timer
      act(() => { vi.advanceTimersByTime(9500); });
      expect(banner()).not.toBeNull();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(banner()).toBeNull();
    });

    it('links to the click-through in a new tab with noopener noreferrer and fires click tracking', async () => {
      const user = userEvent.setup();
      const { pings, events } = await reach();
      const region = await waitFor(() => { const b = banner(); expect(b).not.toBeNull(); return b!; }, { timeout: 4000 });
      const link = within(region).getByRole('link');
      expect(link).toHaveAttribute('href', 'https://brand.test/nl');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await user.click(link);
      expect(pings).toContain('https://t.test/nl/click');
      expect(events).toContainEqual({ type: 'nonlinear:click', adId: 'nl' });
    });

    it('renders nothing for an HTML or iframe resource and does not execute it', async () => {
      const evil = `<VAST version="4.2"><Ad id="e"><InLine><Impression>https://t.test/e/imp</Impression><Creatives><Creative><NonLinearAds>
        <NonLinear><IFrameResource>https://evil.test/f.html</IFrameResource><HTMLResource><![CDATA[<img src=x onerror=alert(1)>]]></HTMLResource></NonLinear>
      </NonLinearAds></Creative></Creatives></InLine></Ad></VAST>`;
      const { pings } = await reach({ vmap: vmapNl(evil) });
      await new Promise((r) => setTimeout(r, 50));
      expect(banner()).toBeNull();
      expect(document.querySelector('iframe')).toBeNull();
      expect(pings).toEqual([]);
    });

    describe('interaction and cleanup', () => {
      const vmapMix = (breaks: string) => `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">${breaks}</vmap:VMAP>`;
      const brk = (id: string, offset: string, type: string, inner: string) =>
        `<vmap:AdBreak timeOffset="${offset}" breakType="${type}" breakId="${id}"><vmap:AdSource><vmap:VASTAdData>${inner}</vmap:VASTAdData></vmap:AdSource></vmap:AdBreak>`;
      const wait = { timeout: 4000 };

      it('shows a start banner after a linear pre-roll instead of losing it', async () => {
        const vmap = vmapMix(brk('pre', 'start', 'linear', vast('pre')) + brk('nl', 'start', 'nonlinear', nlVast()));
        const { main, adRegion, events } = setup({ vmap, load: async () => '' });
        emit(main, 'loadedmetadata', { duration: 100 });
        act(() => { emit(main, 'play', { paused: false }); });
        await waitFor(() => expect(adRegion()).not.toBeNull(), wait);
        expect(banner()).toBeNull();
        act(() => { emit(adVideo(), 'ended'); });
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        expect(events.filter((e) => e.type === 'nonlinear:start')).toHaveLength(1);
      });

      it('queues a banner that comes due behind another one and shows it when the first closes', async () => {
        const user = userEvent.setup();
        const second = nlVast().replace('id="nl"', 'id="nl2"');
        const vmap = vmapMix(brk('a', '00:00:10', 'nonlinear', nlVast()) + brk('b', '00:00:12', 'nonlinear', second));
        const { main, events } = setup({ vmap, load: async () => '' });
        emit(main, 'loadedmetadata', { duration: 100 });
        act(() => { emit(main, 'play', { paused: false }); });
        act(() => { emit(main, 'timeupdate', { currentTime: 10.5 }); });
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        act(() => { emit(main, 'timeupdate', { currentTime: 12.5 }); });
        await user.click(within(banner()!).getByRole('button', { name: 'Close ad' }));
        await waitFor(() => expect(events).toContainEqual({ type: 'nonlinear:start', adId: 'nl2' }), wait);
      });

      it('ends a visible banner with reason replaced when a linear break takes over', async () => {
        const vmap = vmapMix(brk('nl', '00:00:10', 'nonlinear', nlVast()) + brk('mid', '00:00:20', 'linear', vast('mid')));
        const { main, events, adRegion } = setup({ vmap, load: async () => '' });
        emit(main, 'loadedmetadata', { duration: 100 });
        act(() => { emit(main, 'play', { paused: false }); });
        act(() => { emit(main, 'timeupdate', { currentTime: 10.5 }); });
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        act(() => { emit(main, 'timeupdate', { currentTime: 20.5 }); });
        await waitFor(() => expect(adRegion()).not.toBeNull(), wait);
        expect(banner()).toBeNull();
        expect(events).toContainEqual({ type: 'nonlinear:end', adId: 'nl', reason: 'replaced' });
      });

      it('does not fire a second impression when seeking back over a shown break', async () => {
        const { main, events } = await reach();
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        act(() => { emit(main, 'timeupdate', { currentTime: 3 }); });
        act(() => { emit(main, 'timeupdate', { currentTime: 10.5 }); });
        await act(async () => {});
        expect(events.filter((e) => e.type === 'nonlinear:start')).toHaveLength(1);
      });

      it('skips a break the playhead jumped far past', async () => {
        const { main, events } = setup({ vmap: vmapNl(), load: async () => '' });
        emit(main, 'loadedmetadata', { duration: 100 });
        act(() => { emit(main, 'play', { paused: false }); });
        act(() => { emit(main, 'timeupdate', { currentTime: 40 }); });
        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
        expect(banner()).toBeNull();
        expect(events).toEqual([]);
      });

      it('leaves no timer, event or state update behind when unmounted while a banner shows', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { events, unmount } = await reach();
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        await act(async () => {});
        const before = events.length;
        unmount();
        act(() => { vi.advanceTimersByTime(20000); });
        expect(events).toHaveLength(before);
        expect(err).not.toHaveBeenCalled();
      });

      it('shows nothing when unmounted while the ad request is still resolving', async () => {
        const events: AdEvent[] = [];
        let release: (xml: string) => void = () => {};
        const slow = new Promise<string>((r) => { release = r; });
        const ctx = setup({ vmap: vmapNl('https://ads.test/slow'), load: () => slow, onEvent: (e) => events.push(e) });
        emit(ctx.main, 'loadedmetadata', { duration: 100 });
        act(() => { emit(ctx.main, 'play', { paused: false }); });
        act(() => { emit(ctx.main, 'timeupdate', { currentTime: 10.5 }); });
        ctx.unmount();
        await act(async () => { release(nlVast()); await new Promise((r) => setTimeout(r, 20)); });
        expect(events).toEqual([]);
        expect(banner()).toBeNull();
      });

      it('lets a banner outlive the content ending and still hide on its own timer', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { main, events } = await reach();
        await waitFor(() => expect(banner()).not.toBeNull(), wait);
        await act(async () => {});
        act(() => { emit(main, 'ended'); });
        expect(banner()).not.toBeNull();
        act(() => { vi.advanceTimersByTime(7500); });
        expect(banner()).toBeNull();
        expect(events).toContainEqual({ type: 'nonlinear:end', adId: 'nl', reason: 'timeout' });
      });

      it('dismisses with Escape and gives a decorative image an empty alt when it is not a link', async () => {
        const user = userEvent.setup();
        const noLink = nlVast().replace(/<NonLinearClickThrough>.*<\/NonLinearClickThrough>/, '');
        await reach({ vmap: vmapNl(noLink) });
        const region = await waitFor(() => { const b = banner(); expect(b).not.toBeNull(); return b!; }, wait);
        expect(region.querySelector('img')).toHaveAttribute('alt', '');
        within(region).getByRole('button', { name: 'Close ad' }).focus();
        await user.keyboard('{Escape}');
        expect(banner()).toBeNull();
      });
    });
  });
});
