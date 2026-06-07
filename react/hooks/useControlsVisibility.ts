import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  controlsVisible?: boolean;
  autoHideControls: boolean;
  isCasting: boolean;
  playing: boolean;
  onChange?: (visible: boolean) => void;
};

export function useControlsVisibility({
  controlsVisible,
  autoHideControls,
  isCasting,
  playing,
  onChange,
}: Options) {
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = controlsVisible !== undefined;
  const effectiveControls = isCasting
    ? true
    : isControlled
      ? (controlsVisible as boolean)
      : showControls;

  useEffect(() => {
    onChange?.(effectiveControls);
  }, [effectiveControls, onChange]);

  const scheduleHide = useCallback(
    (isPlaying: boolean) => {
      if (isControlled) return;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowControls(true);
      if (isCasting) return;
      if (isPlaying && autoHideControls) {
        hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    },
    [isControlled, autoHideControls, isCasting],
  );

  const resetHideTimer = useCallback(() => {
    scheduleHide(playing);
  }, [playing, scheduleHide]);

  const forceShow = useCallback(() => {
    if (!isControlled) setShowControls(true);
  }, [isControlled]);

  const hideIfPlaying = useCallback(() => {
    if (!isControlled && autoHideControls && playing) setShowControls(false);
  }, [isControlled, autoHideControls, playing]);

  return {
    showControls,
    setShowControls,
    effectiveControls,
    isControlled,
    scheduleHide,
    resetHideTimer,
    forceShow,
    hideIfPlaying,
  };
}
