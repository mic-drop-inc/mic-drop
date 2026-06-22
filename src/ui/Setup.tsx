import { useEffect, useRef, useState } from 'react';
import * as store from '../lib/store';
import { ThemeToggle } from './primitives';
import { isDesktop } from '../lib/desktop';

// First screen: connect a .sqlite file. The File System Access API needs a user
// gesture and a Chromium browser over localhost; we surface both clearly.
export function Setup({ onReady, theme, onToggleTheme }: { onReady: () => void; theme: string; onToggleTheme: () => void }) {
  const supported = store.isSupported();
  const desktop = isDesktop();
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [manualResume, setManualResume] = useState<string | null>(null);
  const [fileName, setFileName] = useState('nsda-ballots.sqlite');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    store.restorableName().then(setResumeName);
    store.manualResumeName().then(setManualResume);
  }, []);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); onReady(); }
    catch (e) {
      if ((e as DOMException)?.name === 'AbortError') { /* user cancelled */ }
      else setError((e as Error).message || 'Something went wrong');
    } finally { setBusy(false); }
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-head">
          <span className="overline">NSDA speech judging</span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <h1 className="setup-title wordmark">Mic Drop</h1>
        <p className="setup-tagline">Drop in, score the round, drop the mic.</p>
        <p className="setup-sub">
          Rate each competitor against the criteria for your event, pick comments, and keep notes —
          all saved to a SQLite file you choose. Nothing leaves this machine.
        </p>

        {supported && (
          <div className="setup-actions">
            {resumeName && (
              <button className="btn btn-primary" disabled={busy} onClick={() => run(store.resume)}>
                Resume <span className="mono">{resumeName}</span>
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => run(store.openExistingFile)}>
              Open existing file…
            </button>
            {desktop && (
              <label className="setup-filename">
                <span className="field-label overline">New file name</span>
                <input className="input mono" value={fileName} placeholder="nsda-ballots.sqlite"
                  onChange={(e) => setFileName(e.target.value)} />
              </label>
            )}
            <button className="btn" disabled={busy} onClick={() => run(() => store.createNewFile(fileName))}>
              {desktop ? 'Choose folder & create…' : 'Create new file…'}
            </button>
          </div>
        )}

        {/* In-browser fallback: the only path when File System Access is absent
            (Safari/Firefox/mobile); also offered as an alternative elsewhere. */}
        {!desktop && (
          <div className="setup-manual">
            <div className="overline setup-or">
              {supported ? 'Or work in this browser' : 'Work in this browser'}
            </div>
            {!supported && (
              <p className="setup-sub">
                This browser can’t save directly to a file. You can still judge here — your data is kept
                in the browser, and you Download a <span className="mono">.sqlite</span> to save or back it up.
              </p>
            )}
            <div className="setup-actions">
              {manualResume && (
                <button className="btn btn-primary" disabled={busy} onClick={() => run(store.resumeManual)}>
                  Resume <span className="mono">{manualResume}</span>
                </button>
              )}
              <button className="btn" disabled={busy} onClick={() => uploadRef.current?.click()}>
                Upload a <span className="mono">.sqlite</span>…
              </button>
              <input ref={uploadRef} type="file" accept=".sqlite,.db" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => store.importFile(f)); }} />
              <button className="btn" disabled={busy} onClick={() => run(() => store.createManualFile(fileName))}>
                New in-browser file
              </button>
            </div>
          </div>
        )}

        {error && <div className="callout callout-bad">{error}</div>}

        <p className="setup-foot mono">
          Tip: keep one file per tournament. In-browser mode autosaves to this browser — use Download
          to save the <span className="mono">.sqlite</span> or move it to another machine.
        </p>
      </div>
    </div>
  );
}
