import { describe, expect, it } from 'vitest';
import { isSafeHttpUrl, parseClock, parseSkipOffset, parseVast, pickMediaFile, resolveVast } from '../../modules/ads/vast';
import { breakTime, dueBreaks, parseOffset, parseVmap } from '../../modules/ads/vmap';

const INLINE = (id: string, extra = '') => `<?xml version="1.0"?>
<VAST version="4.2"><Ad id="${id}" ${extra}><InLine>
  <AdTitle>Spot ${id}</AdTitle>
  <Impression><![CDATA[https://t.test/imp/${id}]]></Impression>
  <Error>https://t.test/err/${id}</Error>
  <Creatives><Creative><Linear skipoffset="00:00:05">
    <Duration>00:00:15</Duration>
    <TrackingEvents>
      <Tracking event="start">https://t.test/start/${id}</Tracking>
      <Tracking event="complete">https://t.test/complete/${id}</Tracking>
    </TrackingEvents>
    <VideoClicks><ClickThrough>https://brand.test/${id}</ClickThrough><ClickTracking>https://t.test/click/${id}</ClickTracking></VideoClicks>
    <MediaFiles>
      <MediaFile type="video/mp4" width="1280" height="720" bitrate="2500">https://cdn.test/${id}-720.mp4</MediaFile>
      <MediaFile type="video/mp4" width="640" height="360" bitrate="800">https://cdn.test/${id}-360.mp4</MediaFile>
      <MediaFile type="video/x-flv" width="640" height="360" bitrate="800">https://cdn.test/${id}.flv</MediaFile>
    </MediaFiles>
  </Linear></Creative></Creatives>
</InLine></Ad></VAST>`;

const WRAPPER = (next: string) => `<VAST version="4.0"><Ad id="w"><Wrapper>
  <Impression>https://t.test/wrapper-imp</Impression>
  <VASTAdTagURI>${next}</VASTAdTagURI>
  <Creatives><Creative><Linear><TrackingEvents><Tracking event="start">https://t.test/wrapper-start</Tracking></TrackingEvents></Linear></Creative></Creatives>
</Wrapper></Ad></VAST>`;

describe('clock and skip offset', () => {
  it('reads times', () => {
    expect(parseClock('00:00:15')).toBe(15);
    expect(parseClock('00:01:30.500')).toBe(90.5);
    expect(parseClock('15')).toBe(15);
    expect(parseClock('soon')).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });
  it('reads a skip offset as time or percentage', () => {
    expect(parseSkipOffset('00:00:05', 30)).toBe(5);
    expect(parseSkipOffset('25%', 20)).toBe(5);
    expect(parseSkipOffset(null, 20)).toBeNull();
    expect(parseSkipOffset('-5%', 20)).toBeNull();
  });
});

describe('parseVast', () => {
  it('reads an inline ad completely', () => {
    const { ads } = parseVast(INLINE('a1'));
    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({ id: 'a1', title: 'Spot a1', impressions: ['https://t.test/imp/a1'], errors: ['https://t.test/err/a1'] });
    const c = ads[0]!.creative!;
    expect(c).toMatchObject({ duration: 15, skipOffset: 5, clickThrough: 'https://brand.test/a1' });
    expect(c.tracking.start).toEqual(['https://t.test/start/a1']);
    expect(c.tracking.clickTracking).toEqual(['https://t.test/click/a1']);
    expect(c.mediaFiles).toHaveLength(3);
  });
  it('fails soft on junk', () => {
    expect(parseVast('not xml at all')).toMatchObject({ ads: [], errors: ['not a VAST document'] });
    expect(parseVast('<html><body/></html>').ads).toEqual([]);
    expect(parseVast('<VAST version="4.0"></VAST>').errors).toEqual(['no ads in the response']);
  });
});

describe('resolveVast', () => {
  it('follows a wrapper and keeps its impressions and tracking', async () => {
    const files: Record<string, string> = { 'https://ads.test/inner': INLINE('inner') };
    const out = await resolveVast(WRAPPER('https://ads.test/inner'), async (u) => files[u]!);
    expect(out.ads).toHaveLength(1);
    expect(out.ads[0]!.impressions).toEqual(['https://t.test/wrapper-imp', 'https://t.test/imp/inner']);
    expect(out.ads[0]!.creative.tracking.start).toEqual(['https://t.test/wrapper-start', 'https://t.test/start/inner']);
  });

  it('stops a wrapper loop at the depth limit', async () => {
    const loop = WRAPPER('https://ads.test/again');
    const out = await resolveVast('https://ads.test/again', async () => loop, { maxDepth: 3 });
    expect(out.ads).toEqual([]);
    expect(out.errors).toContain('wrapper chain too deep');
  });

  it('survives a failing fetch and orders a pod by sequence', async () => {
    const failing = await resolveVast('https://ads.test/down', async () => { throw new Error('offline'); });
    expect(failing).toEqual({ ads: [], nonLinear: [], errors: ['could not load https://ads.test/down'] });

    const pod = `<VAST version="4.0">${INLINE('b', 'sequence="2"').replace(/<\/?VAST[^>]*>|<\?xml[^>]*>/g, '')}${INLINE('a', 'sequence="1"').replace(/<\/?VAST[^>]*>|<\?xml[^>]*>/g, '')}</VAST>`;
    const out = await resolveVast(pod, async () => '');
    expect(out.ads.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('pickMediaFile', () => {
  const { ads } = parseVast(INLINE('a1'));
  const files = ads[0]!.creative!.mediaFiles;
  const mp4Only = (mime: string) => mime === 'video/mp4';
  it('ignores what the browser cannot play and prefers the bitrate nearest the target', () => {
    expect(pickMediaFile(files, mp4Only)?.url).toContain('360');             // 800 is closer to the default 1000 than 2500
    expect(pickMediaFile(files, mp4Only, { targetBitrate: 2500 })?.url).toContain('720');
    expect(pickMediaFile(files, () => false)).toBeNull();
  });
  it('avoids files much larger than the player when it can', () => {
    expect(pickMediaFile(files, mp4Only, { width: 400, targetBitrate: 2500 })?.url).toContain('360');
  });
});

describe('VMAP', () => {
  it('reads offsets', () => {
    expect(parseOffset('start')).toEqual({ kind: 'start' });
    expect(parseOffset('end')).toEqual({ kind: 'end' });
    expect(parseOffset('00:01:30.5')).toEqual({ kind: 'time', seconds: 90.5 });
    expect(parseOffset('25%')).toEqual({ kind: 'percent', percent: 25 });
    expect(parseOffset('#2')).toEqual({ kind: 'position', index: 2 });
    expect(parseOffset('later')).toBeNull();
  });

  it('parses a schedule with a tag URI and inline VAST', () => {
    const xml = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
      <vmap:AdBreak timeOffset="start" breakType="linear" breakId="pre"><vmap:AdSource><vmap:AdTagURI templateType="vast3">https://ads.test/pre</vmap:AdTagURI></vmap:AdSource></vmap:AdBreak>
      <vmap:AdBreak timeOffset="00:00:30" breakType="linear" breakId="mid"><vmap:AdSource><vmap:VASTAdData>${INLINE('m').replace('<?xml version="1.0"?>', '')}</vmap:VASTAdData></vmap:AdSource></vmap:AdBreak>
      <vmap:AdBreak timeOffset="nonsense" breakType="linear" breakId="bad"/>
    </vmap:VMAP>`;
    const breaks = parseVmap(xml);
    expect(breaks.map((b) => b.id)).toEqual(['pre', 'mid']);
    expect(breaks[0]).toMatchObject({ offset: { kind: 'start' }, source: 'https://ads.test/pre' });
    expect(breaks[1]!.source).toContain('<VAST');
    expect(parseVmap('garbage')).toEqual([]);
  });

  it('places breaks in content time', () => {
    expect(breakTime({ kind: 'percent', percent: 50 }, 200)).toBe(100);
    expect(breakTime({ kind: 'percent', percent: 50 }, 0)).toBeNull();
    expect(breakTime({ kind: 'end' }, 200)).toBe(200);
    expect(breakTime({ kind: 'position', index: 1 }, 200, [42])).toBe(42);
  });

  it('says which linear breaks are due, once each', () => {
    const specs = [
      { id: 'pre', type: 'linear' as const, offset: { kind: 'start' as const }, source: 'a' },
      { id: 'mid', type: 'linear' as const, offset: { kind: 'time' as const, seconds: 30 }, source: 'b' },
      { id: 'tag', type: 'nonlinear' as const, offset: { kind: 'time' as const, seconds: 10 }, source: 'c' },
    ];
    expect(dueBreaks(specs, 0, 100, new Set()).map((b) => b.id)).toEqual(['pre']);
    expect(dueBreaks(specs, 31, 100, new Set()).map((b) => b.id)).toEqual(['pre', 'mid']);   // a seek past both
    expect(dueBreaks(specs, 31, 100, new Set(['pre'])).map((b) => b.id)).toEqual(['mid']);
    expect(dueBreaks(specs, 99, 100, new Set(['pre', 'mid']))).toEqual([]);
  });
});

const NONLINEAR = (extra = '', tracking = '<Tracking event="creativeView">https://t.test/nl/view</Tracking>') => `<VAST version="4.2"><Ad id="nl"><InLine>
  <AdTitle>Banner</AdTitle>
  <Impression>https://t.test/nl/imp</Impression>
  <Creatives><Creative><NonLinearAds>
    <TrackingEvents>${tracking}</TrackingEvents>
    ${extra || `<NonLinear width="300" height="50" minSuggestedDuration="00:00:07">
      <StaticResource creativeType="image/png"><![CDATA[https://cdn.test/banner.png]]></StaticResource>
      <NonLinearClickThrough>https://brand.test/nl</NonLinearClickThrough>
      <NonLinearClickTracking>https://t.test/nl/click</NonLinearClickTracking>
    </NonLinear>`}
  </NonLinearAds></Creative></Creatives>
</InLine></Ad></VAST>`;

describe('non-linear VAST', () => {
  it('parses a static image overlay with size, duration, click-through and tracking', () => {
    const ad = parseVast(NONLINEAR()).ads[0]!;
    expect(ad.creative).toBeNull();
    expect(ad.nonLinear!.items).toEqual([{
      imageUrl: 'https://cdn.test/banner.png', imageType: 'image/png', width: 300, height: 50, minSuggestedDuration: 7,
      clickThrough: 'https://brand.test/nl', clickTracking: ['https://t.test/nl/click'],
    }]);
    expect(ad.nonLinear!.tracking.creativeView).toEqual(['https://t.test/nl/view']);
  });

  it('ignores IFrameResource and HTMLResource: no third-party markup or script is ever kept', () => {
    const only = NONLINEAR(`<NonLinear width="300" height="50">
      <IFrameResource>https://evil.test/frame.html</IFrameResource>
      <HTMLResource><![CDATA[<script>alert(1)</script>]]></HTMLResource>
    </NonLinear>`);
    expect(parseVast(only).ads[0]!.nonLinear!.items).toEqual([]);
    const mixed = NONLINEAR(`<NonLinear><HTMLResource><![CDATA[<b>x</b>]]></HTMLResource></NonLinear>
      <NonLinear><StaticResource creativeType="image/gif">https://cdn.test/ok.gif</StaticResource></NonLinear>`);
    expect(parseVast(mixed).ads[0]!.nonLinear!.items.map((i) => i.imageUrl)).toEqual(['https://cdn.test/ok.gif']);
  });

  it('refuses non-image static resources and non-http image URLs', () => {
    const bad = NONLINEAR(`<NonLinear><StaticResource creativeType="application/x-javascript">https://cdn.test/a.js</StaticResource></NonLinear>
      <NonLinear><StaticResource creativeType="text/html">https://cdn.test/a.html</StaticResource></NonLinear>
      <NonLinear><StaticResource creativeType="image/png">javascript:alert(1)</StaticResource></NonLinear>
      <NonLinear><StaticResource creativeType="image/png">data:image/png;base64,AAAA</StaticResource></NonLinear>`);
    expect(parseVast(bad).ads[0]!.nonLinear!.items).toEqual([]);
  });

  it('drops unsafe click-through and click-tracking URLs but keeps the image', () => {
    const xml = NONLINEAR(`<NonLinear><StaticResource creativeType="image/jpeg">https://cdn.test/a.jpg</StaticResource>
      <NonLinearClickThrough>javascript:alert(document.cookie)</NonLinearClickThrough>
      <NonLinearClickTracking>data:text/html,x</NonLinearClickTracking>
      <NonLinearClickTracking>https://t.test/ok</NonLinearClickTracking></NonLinear>`);
    const [item] = parseVast(xml).ads[0]!.nonLinear!.items;
    expect(item).toMatchObject({ imageUrl: 'https://cdn.test/a.jpg', clickThrough: null, clickTracking: ['https://t.test/ok'], minSuggestedDuration: null });
  });

  it('knows which URLs are safe to open', () => {
    expect(isSafeHttpUrl('https://a.test/x')).toBe(true);
    expect(isSafeHttpUrl('http://a.test/x')).toBe(true);
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '//a.test', 'not a url', '', null]) expect(isSafeHttpUrl(u)).toBe(false);
  });

  it('merges NonLinearClickTracking from wrappers, dropping unsafe URLs', async () => {
    const wrapper = `<VAST version="4.0"><Ad id="w"><Wrapper>
      <VASTAdTagURI>https://ads.test/nl</VASTAdTagURI>
      <Creatives><Creative><NonLinearAds><NonLinear>
        <NonLinearClickTracking>https://t.test/wrapper-click</NonLinearClickTracking>
        <NonLinearClickTracking>javascript:alert(1)</NonLinearClickTracking>
      </NonLinear></NonLinearAds></Creative></Creatives>
    </Wrapper></Ad></VAST>`;
    const { nonLinear } = await resolveVast(wrapper, async () => NONLINEAR());
    expect(nonLinear[0]!.item.clickTracking).toEqual(['https://t.test/wrapper-click', 'https://t.test/nl/click']);
  });

  it('resolves through a wrapper, keeping wrapper impressions and creativeView tracking', async () => {
    const wrapper = `<VAST version="4.0"><Ad id="w"><Wrapper>
      <Impression>https://t.test/wrapper-imp</Impression>
      <VASTAdTagURI>https://ads.test/nl</VASTAdTagURI>
      <Creatives><Creative><NonLinearAds><TrackingEvents><Tracking event="creativeView">https://t.test/wrapper-view</Tracking></TrackingEvents></NonLinearAds></Creative></Creatives>
    </Wrapper></Ad></VAST>`;
    const { ads, nonLinear } = await resolveVast(wrapper, async () => NONLINEAR());
    expect(ads).toEqual([]);
    expect(nonLinear).toHaveLength(1);
    expect(nonLinear[0]!.impressions).toEqual(['https://t.test/wrapper-imp', 'https://t.test/nl/imp']);
    expect(nonLinear[0]!.tracking.creativeView).toEqual(['https://t.test/wrapper-view', 'https://t.test/nl/view']);
  });

  it('schedules non-linear breaks separately from linear ones', () => {
    const specs = [
      { id: 'pre', type: 'linear' as const, offset: { kind: 'start' as const }, source: 'a' },
      { id: 'nl', type: 'nonlinear' as const, offset: { kind: 'time' as const, seconds: 10 }, source: 'c' },
    ];
    expect(dueBreaks(specs, 12, 100, new Set(), 'nonlinear').map((b) => b.id)).toEqual(['nl']);
    expect(dueBreaks(specs, 5, 100, new Set(), 'nonlinear')).toEqual([]);
    expect(dueBreaks(specs, 12, 100, new Set(['nl']), 'nonlinear')).toEqual([]);
  });
});
