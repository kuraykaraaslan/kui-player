import { createRoot } from 'react-dom/client';
import { VideoPlayer } from '../../../react';
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

createRoot(document.getElementById('stage')!).render(
  <VideoPlayer
    src={src}
    title="Test clip"
    poster="/media/poster.svg"
    enableCast={params.get('cast') === '1'}
    autoHideControls={params.get('autohide') !== '0'}
    adapters={params.get('adapter') ? [stubAdapter] : undefined}
    qualities={params.get('adapter') ? undefined : [
      { label: '1080p', value: '1080' },
      { label: '720p', value: '720' },
    ]}
    subtitles={[{ label: 'English', srclang: 'en', src: '/media/en.vtt' }]}
  />,
);
