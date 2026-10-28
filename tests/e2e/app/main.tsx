import { createRoot } from 'react-dom/client';
import { VideoPlayerFacade } from '../../../react/facade';
import { tr } from '../../../react/i18n/locales/tr';
import { ar } from '../../../react/i18n/locales/ar';
import type { MediaAdapter } from '../../../modules/videoplayer/adapters/adapter.types';
import { createHlsAdapter } from '../../../modules/videoplayer/adapters/hls.adapter';
import { FetchHlsCtor } from './fetch-hls';

/*
 * A single page the end-to-end specs drive through query parameters, so each
 * spec can set up the player it needs without a rebuild:
 *
 *   ?src=…        media URL (default: the generated fixture clip)
 *   ?broken=1     a URL that 404s, for the error path
 *   ?adapter=1    register a stub streaming adapter for an ".stream" source
 *   ?autohide=0   keep the controls pinned
 *   ?cast=1       enable the Cast button
 *   ?chapters=1   load the chapters and storyboard sidecars
 *   ?srt=1        use an SRT subtitle track instead of WebVTT
 *   ?locale=tr    switch language (tr, ar)
 *   ?persist=1    remember position and preferences
 *   ?playlist=1   play through a two-item playlist
 *   ?theme=cinema apply a theme preset
 *   ?mini=1       float the player into a corner when scrolled away while playing
 *   ?docpip=1     Document Picture-in-Picture for the PiP button
 *   ?audio=1      podcast layout with a waveform and a transcript button
 *   ?facade=1     show only a poster and a play button until clicked
 *   ?video=1      play the generated picture (/media/test.webm, 25 fps, 10 s) — see fixtures/video.ts
 *   ?learning=1   study mode: notes, transcript, and the watched strip on the seek bar
 *   ?frames=1     frame tools (frame-number box, timecode, A-B loop); ?fps=N fixes the rate
 *   ?nl=1         a non-linear banner ad at 1 s (needs ?video=1 or the clip)
 *   ?live=1       a live stream from the /live fixture origin (vite.config.e2e.ts) through the real HLS adapter;
 *                 ?src= picks the address (cam | dies | refused | gone), ?ttl= ends the session after N ms,
 *                 ?dvr=1 keeps the seek bar, ?spacer=1 makes the page scrollable, ?retries=N / ?base=ms the back-off
 *   ?wall=N       N players in one presence group; ?pe= the interval and ?pg= the grace period, in ms
 *   ?sources=1    two addresses (Standard / High) in the quality menu; ?prefer=1 plays High in fullscreen
 */
const params = new URLSearchParams(location.search);

const liveAdapter = createHlsAdapter({ Hls: FetchHlsCtor, preferNative: false });

const stubAdapter: MediaAdapter = {
  name: 'stub',
  canPlay: (src) => src.endsWith('.stream'),
  async attach(video, src, host) {
    // Stand in for hls.js: take over the element, then publish renditions the
    // way a real streaming engine does once its manifest is parsed.
    video.src = '/media/clip.wav';
    video.load();
    host.updateQualities([{ label: '1080p', value: '0' }, { label: '720p', value: '1' }], 1, true);
    host.updateAudioTracks([{ label: 'English', language: 'en' }, { label: 'Türkçe', language: 'tr' }], 0);
    (window as unknown as { __adapterAttached: string }).__adapterAttached = src;
  },
  getQualities: () => [],
  setQuality: (index) => {
    (window as unknown as { __adapterQuality: number }).__adapterQuality = index;
  },
  setAudioTrack: (index) => {
    (window as unknown as { __adapterAudio: number }).__adapterAudio = index;
  },
  detach: () => {},
};

const nonLinearVmap = `<vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0">
  <vmap:AdBreak timeOffset="00:00:01.000" breakType="nonlinear" breakId="nl"><vmap:AdSource><vmap:VASTAdData>
  <VAST version="4.2"><Ad id="nl"><InLine><Creatives><Creative><NonLinearAds>
    <NonLinear width="300" height="50" minSuggestedDuration="00:00:30">
      <StaticResource creativeType="image/png">${location.origin}/media/banner.png</StaticResource>
    </NonLinear>
  </NonLinearAds></Creative></Creatives></InLine></Ad></VAST>
  </vmap:VASTAdData></vmap:AdSource></vmap:AdBreak></vmap:VMAP>`;

const live = params.get('live') === '1';
const ttl = params.get('ttl');
const liveSrc = `/live/${params.get('src') ?? 'cam'}.m3u8${ttl ? `?ttl=${ttl}` : ''}`;

const src = live
  ? liveSrc
  : params.get('broken')
    ? '/media/missing.wav'
    : params.get('adapter')
      ? 'https://example.com/live.stream'
      : params.get('src') ?? (params.get('video') ? '/media/test.webm' : '/media/clip.wav');

const locales = { tr, ar } as const;
const locale = params.get('locale');

const playlist = params.get('playlist')
  ? [
      { src: '/media/clip.wav', title: 'First item', poster: '/media/poster.svg' },
      { src: '/media/clip.wav', title: 'Second item', poster: '/media/poster.svg' },
    ]
  : undefined;

// Imported on demand so that facade mode really does start without the player.
const AdsOverlay = params.get('nl') ? (await import('../../../react/ads')).AdsOverlay : null;
(window as unknown as { __adEvents: unknown[] }).__adEvents = [];
const Component = params.get('facade') ? VideoPlayerFacade : (await import('../../../react')).VideoPlayer;
const facadeProps = params.get('facade') ? { prefetch: params.get('prefetch') !== '0' } : {};

// Room to scroll away from the player.
if (params.get('mini') || params.get('spacer')) {
  const spacer = document.createElement('div');
  spacer.style.height = '300vh';
  document.body.appendChild(spacer);
}

const wallSize = Number(params.get('wall') ?? 0);
const sources = params.get('sources')
  ? [{ label: 'Standard', src: '/media/clip.wav' }, { label: 'High', src: '/media/clip.wav?hd=1' }]
  : undefined;

if (wallSize > 0) {
  const { PresenceGroupProvider, VideoPlayer } = await import('../../../react');
  createRoot(document.getElementById('stage')!).render(
    <PresenceGroupProvider everyMs={Number(params.get('pe') ?? 2000)} graceMs={Number(params.get('pg') ?? 3000)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {Array.from({ length: wallSize }, (_, i) => (
          <VideoPlayer key={i} src="/media/clip.wav" title={`Tile ${i + 1}`} poster="/media/poster.svg" enableCast={false} autoHideControls={false} />
        ))}
      </div>
    </PresenceGroupProvider>,
  );
} else createRoot(document.getElementById('stage')!).render(
  <Component
    {...facadeProps}
    src={playlist ? undefined : src}
    playlist={playlist}
    playlistCountdown={params.get('countdown') ? Number(params.get('countdown')) : 3}
    title="Test clip"
    poster="/media/poster.svg"
    enableCast={params.get('cast') === '1'}
    autoHideControls={params.get('autohide') !== '0'}
    adapters={live ? [liveAdapter] : params.get('adapter') ? [stubAdapter] : undefined}
    live={live ? { dvr: params.get('dvr') === '1', reauth: { maxAttempts: Number(params.get('retries') ?? 3), baseDelayMs: Number(params.get('base') ?? 300) } } : undefined}
    sources={sources}
    preferAlternateInFullscreen={params.get('prefer') === '1'}
    theme={(params.get('theme') as 'cinema' | undefined) ?? undefined}
    chapters={params.get('chapters') ? '/media/chapters.vtt' : undefined}
    thumbnails={params.get('chapters') ? '/media/storyboard.vtt' : undefined}
    persist={params.get('persist') === '1'}
    miniPlayer={params.get('mini') === 'touch' ? { touch: true } : params.get('mini') === '1'}
    audioOnly={params.get('audio') === '1'}
    waveform={params.get('audio') === '1'
      ? Array.from({ length: 120 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i / 7) * Math.cos(i / 17)))
      : undefined}
    learning={params.get('learning') === '1'}
    frameTools={params.get('frames') === '1' ? (params.get('fps') ? { fps: Number(params.get('fps')) } : true) : false}
    slots={AdsOverlay ? { top: <AdsOverlay vmap={nonLinearVmap} onEvent={(e) => (window as unknown as { __adEvents: unknown[] }).__adEvents.push(e)} /> } : undefined}
    documentPictureInPicture={params.get('docpip') === '1'}
    locale={locale && locale in locales ? locales[locale as keyof typeof locales] : undefined}
    qualities={params.get('adapter') || live || sources ? undefined : [
      { label: '1080p', value: '1080' },
      { label: '720p', value: '720' },
    ]}
    subtitles={params.get('srt')
      ? [{ label: 'English', srclang: 'en', src: '/media/en.srt' }]
      : [{ label: 'English', srclang: 'en', src: '/media/en.vtt' }]}
  />,
);
