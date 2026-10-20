import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampOffset, nearestCorner, stepCorner, type Box, type MiniCorner } from '../../modules/videoplayer/videoplayer.mini.js';

type Drag = { id: number; startX: number; startY: number; box: Box; x: number; y: number };

const viewportSize = () => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.innerHeight || document.documentElement.clientHeight,
});
const isRtl = (node: Element) => getComputedStyle(node).direction === 'rtl';
const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/**
 * Lets the floating player be moved by a handle. While a pointer drags, only a
 * compositor `transform` changes (no layout, nothing re-renders); on release
 * the box snaps to the nearest logical corner, which CSS then positions, so the
 * layout stays predictable and RTL-correct. The `<video>` is never moved in the DOM.
 */
export function useMiniDrag(container: HTMLElement | null, corner: MiniCorner, onCorner: (corner: MiniCorner) => void) {
  const setCorner = onCorner;
  const drag = useRef<Drag | null>(null);
  const from = useRef<Box | null>(null);   // where the box was dropped, for the snap animation
  const [glide, setGlide] = useState(0);   // bumped on every drop so the glide runs even when the corner is unchanged
  const onKeyRef = useRef<((e: globalThis.KeyboardEvent) => void) | null>(null);

  // Handlers reach the element through a ref (kept in sync below), not through render-time state.
  const el = useRef<HTMLElement | null>(null);
  useEffect(() => { el.current = container; }, [container]);

  const clear = useCallback(() => {
    drag.current = null;
    if (onKeyRef.current) { document.removeEventListener('keydown', onKeyRef.current, true); onKeyRef.current = null; }
    const node = el.current;
    if (!node) return;
    node.style.transform = '';
    node.removeAttribute('data-kui-dragging');
  }, []);

  const apply = useCallback((d: Drag, dx: number, dy: number) => {
    const { x, y } = clampOffset(d.box, viewportSize(), dx, dy);
    d.x = x; d.y = y;
    if (el.current) el.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const finish = useCallback((cancel: boolean) => {
    const d = drag.current;
    if (!d || !el.current) return;
    const dropped: Box = { ...d.box, left: d.box.left + d.x, top: d.box.top + d.y };
    clear();
    if (cancel) return;
    from.current = dropped;
    setCorner(nearestCorner(dropped, viewportSize(), isRtl(el.current)));
    setGlide((n) => n + 1);
  }, [clear, setCorner]);

  // Glide from the dropped spot to the snapped corner (FLIP). Skipped under reduced motion.
  useLayoutEffect(() => {
    const start = from.current;
    from.current = null;
    if (!start || !container || typeof container.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const end = container.getBoundingClientRect();
    const dx = start.left - end.left;
    const dy = start.top - end.top;
    if (!dx && !dy) return;
    container.animate(
      [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: 'none' }],
      { duration: 180, easing: 'ease-out' },
    );
  }, [glide, container]);

  // A resized window re-clamps an active drag.
  useEffect(() => {
    const onResize = () => {
      const d = drag.current;
      const node = el.current;
      if (!d) return;
      if (node) {   // the box is CSS-anchored to a corner, so its untransformed rect moves with the window
        node.style.transform = '';
        d.box = toBox(node.getBoundingClientRect());
      }
      apply(d, d.x, d.y);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [apply]);

  // Unmounting (leaving mini mode) drops a half-finished drag.
  useEffect(() => clear, [clear]);

  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    const node = el.current;
    if (!node || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    node.getAnimations?.().forEach((a) => a.cancel());   // an entry / snap glide in flight would skew the measured box
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, box: toBox(node.getBoundingClientRect()), x: 0, y: 0 };
    node.setAttribute('data-kui-dragging', '');
    // preventDefault above keeps the handle unfocused, so Escape is heard on the document for the drag's duration.
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== 'Escape' || !drag.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      finishRef.current(true);
    };
    onKeyRef.current = onKey;
    document.addEventListener('keydown', onKey, true);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) apply(d, e.clientX - d.startX, e.clientY - d.startY);
  }, [apply]);

  const onPointerEnd = useCallback((e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    finish(false);
  }, [finish]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && drag.current) { e.preventDefault(); e.stopPropagation(); finish(true); return; }
    const node = el.current;
    if (!node || !e.key.startsWith('Arrow')) return;
    if (drag.current) { e.preventDefault(); e.stopPropagation(); return; }   // a pointer drag is in charge
    e.preventDefault();
    e.stopPropagation();   // not the player's volume / seek shortcuts
    const current = corner;
    const next = stepCorner(current, e.key, isRtl(node));
    if (next === current) return;
    from.current = toBox(node.getBoundingClientRect());
    setCorner(next);
    setGlide((n) => n + 1);
  }, [corner, finish, setCorner]);

  return { handleProps: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd, onKeyDown } };
}
