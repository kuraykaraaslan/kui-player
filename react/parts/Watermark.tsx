import { useEffect, useRef, useState } from 'react';
import {
  clampOpacity, isHiddenStyle, nextWatermarkSlot, type WatermarkOptions, type WatermarkSlot,
} from '../../modules/videoplayer/videoplayer.watermark.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';

/**
 * A visible, moving mark inside the player container — so it survives
 * fullscreen. It deters; it does not prevent recording. With `pauseOnTamper`,
 * removing or hiding it pauses playback and the mark is rebuilt.
 */
export default function Watermark({ options }: Readonly<{ options: WatermarkOptions }>) {
  const engine = useVideoPlayerEngine();
  const ref = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<WatermarkSlot>(() => nextWatermarkSlot(null));
  // Bumping the key remounts the node, which undoes any DOM edit made behind React's back.
  const [generation, setGeneration] = useState(0);
  const { intervalMs = 15_000, pauseOnTamper = false } = options;

  useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => setSlot((prev) => nextWatermarkSlot(prev)), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  useEffect(() => {
    const node = ref.current;
    const parent = node?.parentElement;
    if (!pauseOnTamper || !node || !parent) return;
    const tampered = () => {
      engine.pause();
      // React still believes it owns the node; unmounting one that was torn out
      // behind its back throws, so put it back before the key swap replaces it.
      if (!node.isConnected) parent.appendChild(node);
      setGeneration((g) => g + 1);
    };
    const check = () => {
      if (!node.isConnected) { tampered(); return; }
      if (isHiddenStyle(getComputedStyle(node))) tampered();
    };
    const observer = new MutationObserver(check);
    observer.observe(parent, { childList: true });
    observer.observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    // Stylesheet edits do not fire mutations on the node, so also poll cheaply.
    const poll = window.setInterval(check, 2000);
    return () => { observer.disconnect(); window.clearInterval(poll); };
  }, [engine, pauseOnTamper, generation]);

  return (
    <div
      key={generation}
      ref={ref}
      className="kui-watermark"
      aria-hidden="true"
      style={{ top: `${slot.top}%`, insetInlineStart: `${slot.left}%`, opacity: clampOpacity(options.opacity) }}
    >
      {options.text}
    </div>
  );
}
