import { useEffect, useState } from 'react';
import { fmtTime, parseTime } from './ballotModel';
import { IconPlay, IconStop, IconReset } from './icons';
import { timerStart, timerStop, timerReset, timerIsRunning, timerElapsed, timerSubscribe } from '../lib/timer';

// Live speech timer. Start when the competitor begins, Stop to record the
// duration onto the ballot. The running state lives in the module-level timer
// (src/lib/timer.ts), NOT in this component — so navigating to the Summary view
// mid-speech does not stop the clock, and returning resumes the live display.
// The recorded time can also be typed in directly (m:ss).
export function Stopwatch({
  id, value, onChange, limitSec, graceSec,
}: {
  id: string; // stable per-candidate key (ballot.createdAt)
  value: number | null;
  onChange: (seconds: number | null) => void;
  limitSec: number;
  graceSec: number;
}) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  // Local text while editing the manual field, so reformatting never fights the
  // cursor mid-entry. Committed on blur / Enter.
  const [manual, setManual] = useState<string | null>(null);
  const manualText = manual ?? (value == null ? '' : fmtTime(value));
  function commitManual() {
    if (manual == null) return;
    onChange(parseTime(manual));
    setManual(null);
  }

  const running = timerIsRunning(id);

  // Re-render on any global timer change; tick while running for live display.
  // The tick effect re-arms on remount, so the display resumes automatically.
  useEffect(() => timerSubscribe(rerender), []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(rerender, 200);
    return () => clearInterval(t);
  }, [running]);

  const shown = running ? timerElapsed() : (value ?? 0);
  const over = shown > limitSec;
  const overGrace = shown > limitSec + graceSec;
  const state = overGrace ? 'bad' : over ? 'avg' : 'good';

  function start() { timerStart(id, value ?? 0); rerender(); }
  function stop() { onChange(timerStop()); rerender(); }
  function reset() { timerReset(); onChange(null); setManual(null); rerender(); }

  return (
    <div className="stopwatch">
      <div className={`sw-display mono sw-${running ? state : value != null ? state : 'idle'}`}>
        {fmtTime(shown)}
        {running && <span className="sw-live overline">live</span>}
      </div>
      <div className="sw-controls">
        {!running
          ? <button className="btn btn-sm btn-primary" onClick={start}><IconPlay /> {value != null && value > 0 ? 'Resume' : 'Start'}</button>
          : <button className="btn btn-sm" onClick={stop}><IconStop /> Stop &amp; record</button>}
        <button className="btn btn-sm" onClick={reset}><IconReset /> Reset</button>
      </div>
      <label className="sw-manual">
        <span className="field-label overline">Recorded time — type m:ss</span>
        <input className="input mono" value={manualText} placeholder="m:ss" inputMode="numeric"
          onChange={(e) => setManual(e.target.value)}
          onBlur={commitManual}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitManual(); (e.target as HTMLInputElement).blur(); } }} />
      </label>
      <p className="sw-limit overline">
        Limit {fmtTime(limitSec)}{graceSec > 0 ? ` (+${fmtTime(graceSec)} grace)` : ' (no grace)'}
        {value != null && over && <span className={`tag tag-${state}`}>{overGrace ? 'over grace' : 'over time'}</span>}
      </p>
    </div>
  );
}
