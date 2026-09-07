import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { VideoPlayerEngine } from '../../modules/videoplayer/videoplayer.engine.js';
import type { GestureOptions } from '../../modules/videoplayer/videoplayer.types.js';

/** What the on-screen gesture hint is currently reporting. */
export type GestureFeedback =
  | { kind: 'seek'; side: 'left' | 'right'; seconds: number }
  | { kind: 'rate'; rate: number }
  | { kind: 'volume'; value: number }
  | { kind: 'brightness'; value: number }
  | { kind: 'scrub'; time: number; delta: number }
  | null;

type Options = {
  containerRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  engine: VideoPlayerEngine;
  gestures?: boolean | GestureOptions;
  enabled?: boolean;
};

const DEFAULTS: Required<GestureOptions> = {
  doubleTapSeek: true,
  seekStep: 10,
  longPressSpeed: true,
  longPressRate: 2,
  verticalVolume: true,
  verticalBrightness: false,
  horizontalScrub: true,
};

const LONG_PRESS_MS = 400;
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 12;
const AXIS_LOCK_PX = 16;
/** Full-width drag scrubs at most this much, so long videos stay controllable. */
const MAX_SCRUB_WINDOW_S = 300;
const FEEDBACK_MS = 700;

type Axis = 'none' | 'horizontal' | 'vertical';

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  axis: Axis;
  startTime: number;
  startVolume: number;
  startBrightness: number;
  rateHeld: boolean;
  previousRate: number;
  scrubTarget: number | null;
  moved: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Touch gestures modelled on what mobile viewers already expect: double-tap a
 * side to skip, tap once to toggle the chrome (never to pause — that is the
 * single most misfired control on a phone), hold for 2×, drag to scrub or to
 * change volume.
 *
 * Only `pointerType === 'touch'` events are handled, so mouse and pen input
 * keep the desktop behaviour untouched.
 */
export function useTouchGestures({ containerRef, videoRef, engine, gestures = true, enabled = true }: Options) {
  const opts = useMemo<Required<GestureOptions>>(
    () => (gestures === true || gestures === undefined
      ? DEFAULTS
      : gestures === false
        ? { ...DEFAULTS, doubleTapSeek: false, longPressSpeed: false, verticalVolume: false, verticalBrightness: false, horizontalScrub: false }
        : { ...DEFAULTS, ...gestures }),
    [gestures],
  );
  const active = enabled && gestures !== false;

  const [feedback, setFeedback] = useState<GestureFeedback>(null);
  const brightnessRef = useRef(1);
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ at: number; x: number; side: 'left' | 'right' } | null>(null);
  const lastGestureAt = useRef(0);

  const showFeedback = useCallback((next: GestureFeedback, sticky = false) => {
    setFeedback(next);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (!sticky && next) feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }, []);

  const applyBrightness = useCallback((value: number) => {
    brightnessRef.current = value;
    const v = videoRef.current;
    if (v) v.style.filter = value >= 1 ? '' : `brightness(${value})`;
  }, [videoRef]);

  useEffect(() => () => {
    for (const t of [longPressTimer, singleTapTimer, feedbackTimer]) {
      if (t.current) clearTimeout(t.current);
    }
  }, []);

  /** True right after a touch gesture — lets click handlers ignore its echo. */
  const suppressClick = useCallback(() => Date.now() - lastGestureAt.current < 500, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if (!active || e.pointerType !== 'touch') return;
    // Never swallow input aimed at a real control.
    if ((e.target as HTMLElement).closest('button, input, [role="slider"]')) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = engine.store.getState();

    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startedAt: Date.now(),
      axis: 'none',
      startTime: s.currentTime,
      startVolume: s.muted ? 0 : s.volume,
      startBrightness: brightnessRef.current,
      rateHeld: false,
      previousRate: s.speed,
      scrubTarget: null,
      moved: false,
    };

    if (opts.longPressSpeed) {
      longPressTimer.current = setTimeout(() => {
        const g = gestureRef.current;
        if (!g || g.moved) return;
        g.rateHeld = true;
        engine.setSpeed(opts.longPressRate);
        lastGestureAt.current = Date.now();
        showFeedback({ kind: 'rate', rate: opts.longPressRate }, true);
      }, LONG_PRESS_MS);
    }
  }, [active, containerRef, engine, opts.longPressSpeed, opts.longPressRate, showFeedback]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const g = gestureRef.current;
    if (!active || !g || e.pointerId !== g.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP_PX) { g.moved = true; cancelLongPress(); }
    if (g.rateHeld) return;

    if (g.axis === 'none') {
      if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) g.axis = 'horizontal';
      else if (Math.abs(dy) > AXIS_LOCK_PX && Math.abs(dy) > Math.abs(dx)) g.axis = 'vertical';
      else return;
    }

    const s = engine.store.getState();

    if (g.axis === 'horizontal') {
      if (!opts.horizontalScrub || !s.duration) return;
      const window = Math.min(s.duration, MAX_SCRUB_WINDOW_S);
      const delta = (dx / rect.width) * window;
      const target = Math.max(0, Math.min(s.duration, g.startTime + delta));
      g.scrubTarget = target;
      showFeedback({ kind: 'scrub', time: target, delta }, true);
      return;
    }

    const onRightHalf = g.startX - rect.left > rect.width / 2;
    const ratio = -dy / rect.height;

    if (onRightHalf) {
      if (!opts.verticalVolume) return;
      const value = clamp01(g.startVolume + ratio);
      engine.setVolume(value);
      showFeedback({ kind: 'volume', value }, true);
    } else {
      if (!opts.verticalBrightness) return;
      const value = Math.max(0.2, Math.min(1, g.startBrightness + ratio));
      applyBrightness(value);
      showFeedback({ kind: 'brightness', value }, true);
    }
  }, [active, containerRef, engine, opts.horizontalScrub, opts.verticalVolume, opts.verticalBrightness, applyBrightness, cancelLongPress, showFeedback]);

  const endGesture = useCallback((e: PointerEvent) => {
    const g = gestureRef.current;
    if (!active || !g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    cancelLongPress();
    lastGestureAt.current = Date.now();

    if (g.rateHeld) {
      engine.setSpeed(g.previousRate);
      showFeedback(null);
      return;
    }

    if (g.axis === 'horizontal' && g.scrubTarget !== null) {
      engine.seek(g.scrubTarget);
      showFeedback(null);
      return;
    }
    if (g.axis === 'vertical') { showFeedback(feedback); return; }
    if (g.moved) return;

    // ── a plain tap ──
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const side: 'left' | 'right' = e.clientX - rect.left > rect.width / 2 ? 'right' : 'left';
    const now = Date.now();
    const previous = lastTap.current;
    const isDouble = !!previous
      && now - previous.at < DOUBLE_TAP_MS
      && Math.abs(e.clientX - previous.x) < rect.width / 2;

    if (isDouble && opts.doubleTapSeek) {
      lastTap.current = null;
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      const seconds = side === 'right' ? opts.seekStep : -opts.seekStep;
      engine.seekBy(seconds);
      showFeedback({ kind: 'seek', side, seconds });
      return;
    }

    lastTap.current = { at: now, x: e.clientX, side };
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      singleTapTimer.current = null;
      // A single tap reveals or hides the chrome — mobile players do not
      // pause on tap, and viewers reach for the controls far more often.
      engine.toggleControls();
    }, opts.doubleTapSeek ? DOUBLE_TAP_MS : 0);
  }, [active, cancelLongPress, containerRef, engine, feedback, opts.doubleTapSeek, opts.seekStep, showFeedback]);

  const onPointerCancel = useCallback((e: PointerEvent) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    cancelLongPress();
    if (g.rateHeld) engine.setSpeed(g.previousRate);
    showFeedback(null);
  }, [cancelLongPress, engine, showFeedback]);

  // Attach natively rather than through React props: this hook is loaded lazily
  // by a layer component that has no JSX of the container to spread onto.
  useEffect(() => {
    const el = containerRef.current;
    if (!active || !el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endGesture);
    el.addEventListener('pointercancel', onPointerCancel);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endGesture);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [active, containerRef, onPointerDown, onPointerMove, endGesture, onPointerCancel]);

  return { feedback, suppressClick };
}
