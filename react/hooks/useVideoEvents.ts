import { useEffect, type RefObject } from 'react';

type Options = {
  videoRef: RefObject<HTMLVideoElement | null>;
  setCurrentTime: (t: number) => void;
  setDuration: (t: number) => void;
  setBuffered: (pct: number) => void;
  setLoading: (loading: boolean) => void;
  setPlaying: (playing: boolean) => void;
  setIsFullscreen: (fs: boolean) => void;
  scheduleHide: (playing: boolean) => void;
  forceShow: () => void;
};

export function useVideoEvents({
  videoRef,
  setCurrentTime,
  setDuration,
  setBuffered,
  setLoading,
  setPlaying,
  setIsFullscreen,
  scheduleHide,
  forceShow,
}: Options) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0 && video.duration) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onPlay = () => { setPlaying(true); scheduleHide(true); };
    const onPause = () => { setPlaying(false); forceShow(); };
    const onEnded = () => { setPlaying(false); forceShow(); };
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('progress', onProgress);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    document.addEventListener('fullscreenchange', onFSChange);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, [
    videoRef, setCurrentTime, setDuration, setBuffered, setLoading,
    setPlaying, setIsFullscreen, scheduleHide, forceShow,
  ]);
}
