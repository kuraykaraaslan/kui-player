import { useEffect, useRef, useState } from 'react';
import { useMiniDrag } from '../hooks/useMiniDrag.js';
import { useTranslate } from '../i18n/index.js';
import type { MiniCorner } from '../../modules/videoplayer/videoplayer.mini.js';

type Props = {
  container: HTMLElement | null;
  corner: MiniCorner;
  onCorner: (corner: MiniCorner) => void;
  label: string;
};

const NAMES = {
  'top-left': 'miniCornerTopLeft',
  'top-right': 'miniCornerTopRight',
  'bottom-left': 'miniCornerBottomLeft',
  'bottom-right': 'miniCornerBottomRight',
} as const;

/** The mini player's move handle. Lazy: the drag logic is only fetched once the player floats. */
export function MiniDragHandle({ container, corner, onCorner, label }: Props) {
  const { handleProps } = useMiniDrag(container, corner, onCorner);
  const t = useTranslate();
  const [message, setMessage] = useState('');
  const previous = useRef(corner);

  // Announce where the player landed (drag or keys). Corners are logical; speak the physical side.
  useEffect(() => {
    if (previous.current === corner) return;
    previous.current = corner;
    const rtl = container ? getComputedStyle(container).direction === 'rtl' : false;
    const physical = rtl ? (corner.replace(/left|right/, (m) => (m === 'left' ? 'right' : 'left')) as MiniCorner) : corner;
    setMessage(t('miniMoved', { corner: t(NAMES[physical]) }));
  }, [corner, container, t]);

  return (
    <>
      <button
        type="button"
        className="kui-mini-handle"
        aria-label={label}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        onClick={(e) => e.stopPropagation()}
        {...handleProps}
      />
      <div className="kui-sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>
    </>
  );
}
