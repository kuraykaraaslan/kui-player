import { useCallback, type RefObject } from 'react';

export function useFullscreen(containerRef: RefObject<HTMLDivElement | null>) {
  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) void c.requestFullscreen();
    else void document.exitFullscreen();
  }, [containerRef]);

  return { toggleFullscreen };
}
