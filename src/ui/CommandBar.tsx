import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch } from './icons';

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

// ⌘K / Ctrl-K palette: fuzzy-ish filter over all app actions (switch event, jump
// to a candidate, change view, open a guide, toggle theme…). Keyboard-driven.
export function CommandBar({ open, commands, onClose }: { open: boolean; commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQuery(''); setActive(0); requestAnimationFrame(() => inputRef.current?.focus()); } }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector('.cmd-item.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  function run(i: number) { const c = filtered[i]; if (c) { onClose(); c.run(); } }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  // Render with group headers, tracking a flat index for keyboard selection.
  let idx = -1;
  let lastGroup = '';
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command bar">
        <div className="cmd-input-row">
          <IconSearch />
          <input ref={inputRef} className="cmd-input" placeholder="Type a command or search…"
            value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
          <span className="cmd-esc mono">esc</span>
        </div>
        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmd-empty">No matches</div>}
          {filtered.map((c) => {
            idx++;
            const i = idx;
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {showGroup && <div className="cmd-group overline">{c.group}</div>}
                <button className={`cmd-item ${i === active ? 'is-active' : ''}`}
                  onMouseMove={() => setActive(i)} onClick={() => run(i)}>
                  <span className="cmd-label">{c.label}</span>
                  {c.hint && <span className="cmd-hint mono">{c.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
