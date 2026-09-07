import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../../modules/videoplayer/videoplayer.format.js';
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
  const [message, setMessage] = useState('');
  // The subscription is created once; this keeps the labels it reads current
  // without tearing it down every time a prop identity changes.
  const meta = useRef({ qualities, subtitles, audioTracks });
  useEffect(() => { meta.current = { qualities, subtitles, audioTracks }; }, [qualities, subtitles, audioTracks]);

  useEffect(() => {
    let previous = storeApi.getState();

    return storeApi.subscribe((state) => {
      const { qualities: q, subtitles: subs, audioTracks: tracks } = meta.current;
      const say: string[] = [];

      if (state.error && state.error !== previous.error) say.push(`Error: ${state.error.message}`);
      else if (!state.error && previous.error) say.push('Playback recovered');

      if (state.playing !== previous.playing) say.push(state.playing ? 'Playing' : 'Paused');
      if (state.muted !== previous.muted) say.push(state.muted ? 'Muted' : 'Unmuted');
      else if (Math.abs(state.volume - previous.volume) >= 0.05 && !state.muted) {
        say.push(`Volume ${Math.round(state.volume * 100)} percent`);
      }
      if (state.speed !== previous.speed) {
        say.push(state.speed === 1 ? 'Normal speed' : `Speed ${state.speed} times`);
      }
      if (state.selectedQuality !== previous.selectedQuality) {
        const label = state.adaptiveQualities.find((x) => x.value === state.selectedQuality)?.label
          ?? q?.find((x) => x.value === state.selectedQuality)?.label
          ?? (state.selectedQuality === 'auto' ? 'Auto' : state.selectedQuality);
        if (label) say.push(`Quality ${label}`);
      }
      if (state.selectedSubtitle !== previous.selectedSubtitle) {
        const label = state.selectedSubtitle === null ? 'off' : subs?.[state.selectedSubtitle]?.label ?? 'on';
        say.push(`Subtitles ${label}`);
      }
      if (state.selectedAudioTrack !== previous.selectedAudioTrack) {
        const list = state.adaptiveAudioTracks.length > 0 ? state.adaptiveAudioTracks : tracks;
        const label = list?.[state.selectedAudioTrack]?.label;
        if (label) say.push(`Audio ${label}`);
      }
      if (state.isFullscreen !== previous.isFullscreen) say.push(state.isFullscreen ? 'Fullscreen' : 'Exited fullscreen');
      if (state.isPip !== previous.isPip) say.push(state.isPip ? 'Picture in picture' : 'Left picture in picture');
      if (state.castState !== previous.castState && state.castState === 'connected') {
        say.push(`Casting to ${state.castDeviceName ?? 'device'}`);
      }
      if (state.duration !== previous.duration && state.duration > 0 && previous.duration === 0) {
        say.push(`Duration ${formatTime(state.duration)}`);
      }

      previous = state;
      if (say.length > 0) setMessage(say.join('. '));
    });
  }, [storeApi]);

  return message;
}
