import { useEffect, useRef, useState, type FormEvent } from 'react';
import { markLoop, RangeSpeeds, stepLoop } from '../../modules/videoplayer/videoplayer.loop.js';
import {
  frameAt, parseFrameInput, snapFps, timeOfFrame, toTimecode,
} from '../../modules/videoplayer/videoplayer.timecode.js';
import { useVideoPlayerEngine } from '../hooks/useVideoPlayerEngine.js';
import { useVideoPlayerStore } from '../hooks/useVideoPlayerStore.js';
import { useTranslate } from '../i18n/index.js';

export type FrameToolsOptions = {
  /** Frame rate. Omitted: measured from the video and snapped to a standard rate. */
  fps?: number;
  /** Drop-frame timecode (29.97 / 59.94). Default `false`. */
  dropFrame?: boolean;
  /** Show the A-B loop controls (default `true`). */
  loop?: boolean;
};

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const REPEAT_CHOICES = [0, 1, 2, 3, 5, 10];
const FPS_SAMPLES = 30;
/** Shared by the two go-to boxes: select on focus, no spellcheck, numeric keypad. */
const INPUT = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select(),
  spellCheck: false,
  inputMode: 'numeric',
} as const;

/**
 * Review tools, opt-in and loaded on demand: a SMPTE timecode that follows the
 * presented frame, go-to-frame, copy-timecode, and an A-B loop with a repeat
 * count and a remembered speed per range. Frame stepping itself is the
 * existing `,` / `.` keys, which this makes exact by supplying the frame rate.
 */
export default function FrameTools({ options }: Readonly<{ options: FrameToolsOptions }>) {
  const engine = useVideoPlayerEngine();
  const t = useTranslate();
  const rootRef = useRef<HTMLDivElement>(null);
  const clock = useVideoPlayerStore((s) => s.currentTime);
  const range = useVideoPlayerStore((s) => s.loopRange);
  const [exactTime, setExactTime] = useState<number | null>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  const [repeat, setRepeat] = useState(0);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [frameDraft, setFrameDraft] = useState<string | null>(null);

  const fps = options.fps ?? measured ?? 30;
  const dropFrame = options.dropFrame ?? false;
  const loopEnabled = options.loop !== false;
  const time = exactTime ?? clock;

  // The engine steps frames with whatever rate we settle on.
  useEffect(() => { engine.setFrameRate(fps); }, [engine, fps]);

  const passes = useRef(0);
  const finished = useRef(false);
  const speeds = useRef(new RangeSpeeds());
  const live = useRef({ range, repeat });
  useEffect(() => { live.current = { range, repeat }; });

  // A new range starts counting afresh and takes the speed remembered for it.
  const rangeId = range?.b == null ? '' : `${range.a}-${range.b}`;
  useEffect(() => {
    passes.current = 0;
    finished.current = false;
    if (range && range.b !== null) {
      const remembered = speeds.current.get(range);
      if (remembered !== undefined) engine.setSpeed(remembered);
    }
    // Only a different range matters here, not each render of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, rangeId]);

  useEffect(() => engine.store.subscribe((state, previous) => {
    const r = state.loopRange;
    if (r && r.b !== null && state.speed !== previous.speed) speeds.current.set(r, state.speed);
  }), [engine]);

  // Follow the presented frame (precise) and apply the loop on every frame.
  useEffect(() => {
    const video = rootRef.current?.closest('.kui-player')?.querySelector('video') as FrameCallbackVideo | null | undefined;
    if (!video) return;
    const deltas: number[] = [];
    let previousTime = -1;
    let handle = 0;

    const step = (mediaTime: number) => {
      if (finished.current) return;
      const { range: r, repeat: n } = live.current;
      const next = stepLoop(r, mediaTime, passes.current, n);
      if (!next) return;
      if ('finished' in next) { finished.current = true; return; }
      passes.current += 1;
      engine.seek(next.seekTo);
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = (_now: number, meta: { mediaTime: number }) => {
        setExactTime(meta.mediaTime);
        step(meta.mediaTime);
        const dt = meta.mediaTime - previousTime;
        if (previousTime >= 0 && dt > 0.004 && dt < 0.2) {
          deltas.push(dt);
          if (deltas.length >= FPS_SAMPLES) {
            const sorted = [...deltas].sort((a, b) => a - b);
            setMeasured(snapFps(1 / sorted[Math.floor(sorted.length / 2)]!));
            deltas.length = 0;
          }
        }
        previousTime = meta.mediaTime;
        handle = video.requestVideoFrameCallback!(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
      return () => video.cancelVideoFrameCallback?.(handle);
    }
    // No frame callbacks (older Firefox/Safari): the coarser `timeupdate` clock will do.
    const onTime = () => { setExactTime(null); step(video.currentTime); };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [engine]);

  // `a` marks A, then B, then clears. Listening on the player keeps it scoped
  // to the focused player and working inside a PiP window.
  useEffect(() => {
    if (!loopEnabled) return;
    const player = rootRef.current?.closest('.kui-player');
    if (!player) return;
    const onKey = (e: Event) => {
      const k = e as KeyboardEvent;
      if (k.key.toLowerCase() !== 'a' || k.ctrlKey || k.metaKey || k.altKey) return;
      if ((k.target as HTMLElement | null)?.closest('input, textarea, select, [role="slider"]')) return;
      k.preventDefault();
      engine.store.getState().setLoopRange(markLoop(engine.store.getState().loopRange, engine.store.getState().currentTime));
    };
    player.addEventListener('keydown', onKey);
    return () => player.removeEventListener('keydown', onKey);
  }, [engine, loopEnabled]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seconds = parseFrameInput(draft ?? '', fps, dropFrame);
    if (seconds !== null) engine.seek(seconds);
    else setMessage(t('invalidFrame'));
    setDraft(null);
  };

  const submitFrame = (e: FormEvent) => {
    e.preventDefault();
    if (/^\d+$/.test(frameDraft ?? '')) engine.seek(timeOfFrame(Number(frameDraft), fps));
    else setMessage(t('invalidFrame'));
    setFrameDraft(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTimecode(time, fps, dropFrame));
      setMessage(t('copied'));
      window.setTimeout(() => setMessage(''), 2000);
    } catch { setMessage(''); }
  };

  const markLabel = !range ? t('loopA') : range.b === null ? t('loopB') : t('loopClear');
  const timecode = toTimecode(time, fps, dropFrame);

  return (
    <div ref={rootRef} className="kui-frametools" role="group" aria-label={t('frameTools')}>
      <form className="kui-frametools-row" onSubmit={submit}>
        <input
          className="kui-frametools-input"
          value={draft ?? timecode}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setDraft(null)}
          aria-label={t('goToFrame')}
          {...INPUT}
        />
      </form>
      <form className="kui-frametools-row" onSubmit={submitFrame}>
        <label className="kui-frametools-frame" title={t('goToFrameNumber')}>
          #
          <input
            className="kui-frametools-input kui-frametools-input-frame"
            value={frameDraft ?? String(frameAt(time, fps))}
            onChange={(e) => setFrameDraft(e.target.value)}
            onBlur={() => setFrameDraft(null)}
            aria-label={t('goToFrameNumber')}
            {...INPUT}
          />
        </label>
        <button type="button" className="kui-btn-outline" onClick={() => { void copy(); }}>{t('copyTimecode')}</button>
      </form>
      {loopEnabled && (
        <div className="kui-frametools-row">
          <button
            type="button"
            className="kui-btn-outline"
            onClick={() => engine.store.getState().setLoopRange(markLoop(range, engine.store.getState().currentTime))}
          >
            {markLabel}
          </button>
          <select
            className="kui-frametools-select"
            aria-label={t('loopRepeat')}
            value={repeat}
            onChange={(e) => { setRepeat(Number(e.target.value)); passes.current = 0; finished.current = false; }}
          >
            {REPEAT_CHOICES.map((n) => (
              <option key={n} value={n}>{n === 0 ? t('loopForever') : t('loopTimes', { n })}</option>
            ))}
          </select>
        </div>
      )}
      <span className="kui-sr-only" role="status" aria-live="polite">{message}</span>
    </div>
  );
}
