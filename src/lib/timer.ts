// One live speech timer shared across the whole app, kept in module scope so it
// keeps running when the Ballot unmounts — e.g. switching to the Summary view
// while a candidate is still performing. Keyed by a stable per-candidate id (the
// ballot's createdAt, which doesn't change when a new draft gets its row id).
//
// Only the START state lives here; the displayed elapsed is always derived from
// (now - startEpoch), so it's correct even after the component remounts.
type Listener = () => void;

let runningKey: string | null = null;
let startEpoch = 0; // ms; virtual zero so elapsed = (now - startEpoch) / 1000
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((f) => f());

export function timerStart(key: string, fromSec = 0): void {
  runningKey = key;
  startEpoch = Date.now() - fromSec * 1000;
  emit();
}

/** Stop the timer and return the elapsed seconds (to record onto the ballot). */
export function timerStop(): number {
  const elapsed = timerElapsed();
  runningKey = null;
  emit();
  return elapsed;
}

export function timerReset(): void {
  runningKey = null;
  startEpoch = 0;
  emit();
}

export function timerIsRunning(key: string): boolean {
  return runningKey !== null && runningKey === key;
}

/** The key of the candidate currently being timed, or null. */
export function timerRunningKey(): string | null {
  return runningKey;
}

export function timerElapsed(): number {
  if (runningKey === null) return 0;
  return Math.max(0, Math.round((Date.now() - startEpoch) / 1000));
}

export function timerSubscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
