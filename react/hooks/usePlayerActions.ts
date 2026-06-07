import { useCallback, type RefObject } from 'react';
import type { RemotePlayer, RemotePlayerController } from '../../modules/videoplayer/videoplayer.types';

type Options = {
  isCasting: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  progressRef: RefObject<HTMLDivElement | null>;
  remotePlayerRef: RefObject<RemotePlayer | null>;
  remoteControllerRef: RefObject<RemotePlayerController | null>;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
};

export function usePlayerActions({
  isCasting, videoRef, progressRef, remotePlayerRef, remoteControllerRef, setVolume, setMuted,
}: Options) {
  const togglePlay = useCallback(() => {
    if (isCasting && remoteControllerRef.current) { remoteControllerRef.current.playOrPause(); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  }, [isCasting, remoteControllerRef, videoRef]);

  const seekBy = useCallback((delta: number) => {
    if (isCasting && remotePlayerRef.current && remoteControllerRef.current) {
      const rp = remotePlayerRef.current;
      rp.currentTime = Math.max(0, Math.min(rp.duration || 0, rp.currentTime + delta));
      remoteControllerRef.current.seek();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, [isCasting, remotePlayerRef, remoteControllerRef, videoRef]);

  const toggleMute = useCallback(() => {
    if (isCasting && remoteControllerRef.current) { remoteControllerRef.current.muteOrUnmute(); return; }
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, [isCasting, remoteControllerRef, videoRef, setMuted]);

  const handleVolumeChange = useCallback((val: number) => {
    const c = Math.max(0, Math.min(1, val));
    if (isCasting && remotePlayerRef.current && remoteControllerRef.current) {
      remotePlayerRef.current.volumeLevel = c;
      remoteControllerRef.current.setVolumeLevel();
      setVolume(c); setMuted(c === 0);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.volume = c; v.muted = c === 0;
    setVolume(c); setMuted(c === 0);
  }, [isCasting, remotePlayerRef, remoteControllerRef, videoRef, setVolume, setMuted]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (isCasting && remotePlayerRef.current && remoteControllerRef.current) {
      const rp = remotePlayerRef.current;
      if (!rp.duration) return;
      rp.currentTime = ratio * rp.duration;
      remoteControllerRef.current.seek();
      return;
    }
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = ratio * v.duration;
  }, [isCasting, remotePlayerRef, remoteControllerRef, videoRef, progressRef]);

  return { togglePlay, seekBy, toggleMute, handleVolumeChange, handleSeek };
}
