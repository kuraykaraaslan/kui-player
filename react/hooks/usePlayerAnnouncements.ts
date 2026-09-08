import { useEffect, useRef, useState } from 'react';
import { useFormatTime, useTranslate } from '../i18n/index.js';
import { useVideoPlayerStoreApi } from './useVideoPlayerStore.js';
import type { AudioTrackOption, QualityOption, SubtitleTrack } from '../../modules/videoplayer/videoplayer.types.js';

type Options = {
  qualities?: QualityOption[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackOption[];
};

/**
 * Text for the player's polite live region. Screen-reader users get no feedback
 * from a chrome that only changes colour, so every state change a sighted user
 * can see gets announced once, in words.
 *
 * Deliberately silent about `currentTime`: a running clock in a live region is
 * unusable noise.
 */
export function usePlayerAnnouncements({ qualities, subtitles, audioTracks }: Options): string {
  const storeApi = useVideoPlayerStoreApi();
  const t = useTranslate();
  const formatTime = useFormatTime();
  const [message, setMessage] = useState('');
  // The subscription is created once; this keeps the labels it reads current
  // without tearing it down every time a prop identity changes.
  const meta = useRef({ qualities, subtitles, audioTracks, t, formatTime });
  useEffect(() => {
    meta.current = { qualities, subtitles, audioTracks, t, formatTime };
  }, [qualities, subtitles, audioTracks, t, formatTime]);

  useEffect(() => {
    let previous = storeApi.getState();

    return storeApi.subscribe((state) => {
      const { qualities: q, subtitles: subs, audioTracks: tracks, t: say, formatTime: time } = meta.current;

      const out: string[] = [];
      if (state.error && state.error !== previous.error) {
        out.push(say('state.error', { message: state.error.message }));
      } else if (!state.error && previous.error) out.push(say('state.recovered'));

      if (state.playing !== previous.playing) out.push(say(state.playing ? 'state.playing' : 'state.paused'));
      if (state.muted !== previous.muted) out.push(say(state.muted ? 'state.muted' : 'state.unmuted'));
      else if (Math.abs(state.volume - previous.volume) >= 0.05 && !state.muted) {
        out.push(say('state.volume', { percent: Math.round(state.volume * 100) }));
      }
      if (state.speed !== previous.speed) {
        out.push(state.speed === 1 ? say('state.normalSpeed') : say('state.speed', { rate: state.speed }));
      }
      if (state.selectedQuality !== previous.selectedQuality) {
        const label = state.adaptiveQualities.find((x) => x.value === state.selectedQuality)?.label
          ?? q?.find((x) => x.value === state.selectedQuality)?.label
          ?? (state.selectedQuality === 'auto' ? 'Auto' : state.selectedQuality);
        if (label) out.push(say('state.quality', { label }));
      }
      if (state.selectedSubtitle !== previous.selectedSubtitle) {
        const label = state.selectedSubtitle === null
          ? say('off')
          : subs?.[state.selectedSubtitle]?.label ?? '';
        out.push(say('state.subtitles', { label }));
      }
      if (state.selectedAudioTrack !== previous.selectedAudioTrack) {
        const list = state.adaptiveAudioTracks.length > 0 ? state.adaptiveAudioTracks : tracks;
        const label = list?.[state.selectedAudioTrack]?.label;
        if (label) out.push(say('state.audio', { label }));
      }
      if (state.isFullscreen !== previous.isFullscreen) {
        out.push(say(state.isFullscreen ? 'state.fullscreen' : 'state.exitedFullscreen'));
      }
      if (state.isPip !== previous.isPip) out.push(say(state.isPip ? 'state.pip' : 'state.exitedPip'));
      if (state.castState !== previous.castState && state.castState === 'connected') {
        out.push(state.castDeviceName
          ? say('castingTo', { device: state.castDeviceName })
          : say('castingToDevice'));
      }
      if (state.duration !== previous.duration && state.duration > 0 && previous.duration === 0) {
        out.push(say('state.duration', { time: time(state.duration) }));
      }

      previous = state;
      if (out.length > 0) setMessage(out.join('. '));
    });
  }, [storeApi]);

  return message;
}
