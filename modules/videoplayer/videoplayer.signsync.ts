/**
 * Keeping a second video (sign-language interpreter) in step with the main one.
 * Pure: given both clocks, say what to do to the follower, so the drift logic
 * is testable with a fake timeline.
 */
export type SignSyncInput = {
  mainTime: number;
  mainPlaying: boolean;
  mainRate: number;
  /** The main video is buffering or seeking — hold the follower rather than let it run ahead. */
  mainWaiting: boolean;
  signTime: number;
  signPaused: boolean;
  signRate: number;
  /** Largest drift tolerated before a correction, seconds (default 0.3). */
  threshold?: number;
};

export type SignSyncPlan = {
  seekTo?: number;
  play?: boolean;
  pause?: boolean;
  rate?: number;
};

export const DEFAULT_SIGN_DRIFT_S = 0.3;

export function planSignSync(i: SignSyncInput): SignSyncPlan {
  const plan: SignSyncPlan = {};
  const threshold = i.threshold ?? DEFAULT_SIGN_DRIFT_S;
  const shouldRun = i.mainPlaying && !i.mainWaiting;

  if (Math.abs(i.signTime - i.mainTime) > threshold) plan.seekTo = i.mainTime;
  if (i.signRate !== i.mainRate) plan.rate = i.mainRate;
  if (shouldRun && i.signPaused) plan.play = true;
  if (!shouldRun && !i.signPaused) plan.pause = true;
  return plan;
}
