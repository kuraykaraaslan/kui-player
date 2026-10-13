/**
 * SMPTE timecode and frame arithmetic, including 29.97 / 59.94 drop-frame.
 * Pure number crunching: the player passes the frame rate in, because a
 * `<video>` element does not expose it.
 */
const NTSC: Record<string, number> = { '23.976': 24000 / 1001, '29.97': 30000 / 1001, '59.94': 60000 / 1001 };

/** `29.97` → 30000/1001 and friends; other rates pass through. */
export function normaliseFps(fps: number): number {
  for (const [label, exact] of Object.entries(NTSC)) {
    if (Math.abs(fps - Number(label)) < 0.01) return exact;
  }
  return Number.isFinite(fps) && fps > 0 ? fps : 30;
}

/** Frame rates a camera or encoder really produces; used to snap a measured rate. */
export const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60] as const;

/** The standard rate closest to a measurement (within 2 %), else the measurement rounded to 0.01. */
export function snapFps(measured: number): number {
  const nearest = COMMON_FPS.reduce((a, b) => (Math.abs(b - measured) < Math.abs(a - measured) ? b : a));
  return Math.abs(nearest - measured) / nearest < 0.02 ? nearest : Math.round(measured * 100) / 100;
}

const dropFramesFor = (fps: number): number => {
  const nominal = Math.round(fps);
  return nominal === 30 ? 2 : nominal === 60 ? 4 : 0;
};

/** Frame index (0-based) the playhead is on. */
export function frameAt(seconds: number, fps: number): number {
  return Math.max(0, Math.floor(seconds * normaliseFps(fps) + 1e-6));
}

/** Time at the middle of a frame — seeking to a frame's start can land on the previous one. */
export function timeOfFrame(frame: number, fps: number): number {
  return (Math.max(0, frame) + 0.5) / normaliseFps(fps);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `HH:MM:SS:FF`, or `HH:MM:SS;FF` for drop-frame. */
export function toTimecode(seconds: number, fps: number, dropFrame = false): string {
  const rate = normaliseFps(fps);
  const nominal = Math.round(rate);
  const drop = dropFrame ? dropFramesFor(rate) : 0;
  let frames = frameAt(seconds, rate);
  if (drop) {
    const per10Min = Math.round(rate * 600);
    const perMinute = nominal * 60 - drop;
    const tens = Math.floor(frames / per10Min);
    const rest = frames % per10Min;
    frames += drop * 9 * tens + (rest > drop ? drop * Math.floor((rest - drop) / perMinute) : 0);
  }
  const ff = frames % nominal;
  const ss = Math.floor(frames / nominal) % 60;
  const mm = Math.floor(frames / (nominal * 60)) % 60;
  const hh = Math.floor(frames / (nominal * 3600));
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${drop ? ';' : ':'}${pad(ff)}`;
}

/**
 * Parse a timecode (`01:02:03:04`, `01:02:03;04`, `1:02:03.04` is not valid) into
 * seconds. `null` when it is malformed or names a frame that does not exist.
 */
export function fromTimecode(text: string, fps: number, dropFrame = false): number | null {
  const m = /^\s*(\d+):(\d{1,2}):(\d{1,2})[:;](\d{1,3})\s*$/.exec(text);
  if (!m) return null;
  const [hh, mm, ss, ff] = m.slice(1).map(Number) as [number, number, number, number];
  const rate = normaliseFps(fps);
  const nominal = Math.round(rate);
  const drop = dropFrame ? dropFramesFor(rate) : 0;
  if (mm > 59 || ss > 59 || ff >= nominal) return null;
  if (drop && ss === 0 && mm % 10 !== 0 && ff < drop) return null;   // those frame numbers are skipped
  const totalMinutes = hh * 60 + mm;
  const frames = nominal * 3600 * hh + nominal * 60 * mm + nominal * ss + ff
    - drop * (totalMinutes - Math.floor(totalMinutes / 10));
  return frames / rate;
}

/** A frame number or a timecode → seconds; `null` if it is neither. */
export function parseFrameInput(text: string, fps: number, dropFrame = false): number | null {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) return timeOfFrame(Number(trimmed), fps);
  return fromTimecode(trimmed, fps, dropFrame);
}
