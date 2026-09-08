import { createRoot } from 'react-dom/client';
import { VideoPlayer } from '../../../react';
import { tr } from '../../../react/i18n/locales/tr';
import { ar } from '../../../react/i18n/locales/ar';
import type { MediaAdapter } from '../../../modules/videoplayer/adapters/adapter.types';

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
 */
const params = new URLSearchParams(location.search);

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

const src = params.get('broken')
  ? '/media/missing.wav'
  : params.get('adapter')
    ? 'https://example.com/live.stream'
    : params.get('src') ?? '/media/clip.wav';

const locales = { tr, ar } as const;
const locale = params.get('locale');

const playlist = params.get('playlist')
  ? [
      { src: '/media/clip.wav', title: 'First item', poster: '/media/poster.svg' },
      { src: '/media/clip.wav', title: 'Second item', poster: '/media/poster.svg' },
    ]
  : undefined;

createRoot(document.getElementById('stage')!).render(
  <VideoPlayer
    src={playlist ? undefined : src}
    playlist={playlist}
    playlistCountdown={params.get('countdown') ? Number(params.get('countdown')) : 3}
    title="Test clip"
    poster="/media/poster.svg"
    enableCast={params.get('cast') === '1'}
    autoHideControls={params.get('autohide') !== '0'}
    adapters={params.get('adapter') ? [stubAdapter] : undefined}
    theme={(params.get('theme') as 'cinema' | undefined) ?? undefined}
    chapters={params.get('chapters') ? '/media/chapters.vtt' : undefined}
    thumbnails={params.get('chapters') ? '/media/storyboard.vtt' : undefined}
    persist={params.get('persist') === '1'}
    locale={locale && locale in locales ? locales[locale as keyof typeof locales] : undefined}
    qualities={params.get('adapter') ? undefined : [
      { label: '1080p', value: '1080' },
      { label: '720p', value: '720' },
    ]}
    subtitles={params.get('srt')
      ? [{ label: 'English', srclang: 'en', src: '/media/en.srt' }]
      : [{ label: 'English', srclang: 'en', src: '/media/en.vtt' }]}
  />,
);
