import { useEffect, useState } from 'react';
import type { Ballot } from '../lib/db';
import { competitorLabel, fmtTime } from './ballotModel';
import { timerSubscribe, timerRunningKey, timerElapsed } from '../lib/timer';

// Re-renders on timer changes and ticks ~2x/sec while a timer is running.
function useRunningTimer(): { key: string | null; elapsed: number } {
  const [, force] = useState(0);
  useEffect(() => timerSubscribe(() => force((n) => n + 1)), []);
  const running = timerRunningKey() !== null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);
  return { key: timerRunningKey(), elapsed: timerElapsed() };
}

// Live "a candidate is being timed" indicator, shown wherever the Stopwatch
// itself isn't visible (Summary view, sidebar, collapsed rail). Click to jump to
// that candidate. Renders nothing when no timer is running.
export function RunningTimer({
  ballots, onOpen, limitSec, graceSec, variant,
}: {
  ballots: Ballot[];
  onOpen: (id: number) => void;
  limitSec: number;
  graceSec: number;
  variant: 'bar' | 'rail';
}) {
  const { key, elapsed } = useRunningTimer();
  if (!key) return null;
  const b = ballots.find((x) => x.createdAt === key);
  const state = elapsed > limitSec + graceSec ? 'bad' : elapsed > limitSec ? 'avg' : 'good';
  const open = () => { if (b?.id != null) onOpen(b.id); };
  const label = b ? competitorLabel(b) : 'Candidate';

  if (variant === 'rail') {
    return (
      <button className={`running-rail running-${state}`} onClick={open}
        title={`Timing ${label} · ${fmtTime(elapsed)}`} aria-label={`Timing ${label}`}>
        <span className="running-dot" aria-hidden />
        <span className="mono">{fmtTime(elapsed)}</span>
      </button>
    );
  }
  return (
    <button className={`running-bar running-${state}`} onClick={open}>
      <span className="running-dot" aria-hidden />
      <span className="running-bar-label">Timing · {label}</span>
      <span className="mono running-bar-time">{fmtTime(elapsed)}</span>
    </button>
  );
}
