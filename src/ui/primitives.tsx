import { forwardRef, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { RatingLevel } from '../data/types';
import type { SaveStatus } from '../lib/store';
import { IconSun, IconMoon } from './icons';
import { initialsFor } from './ballotModel';

/** A textarea that grows with its content (no inner scrollbar) so long notes
 * stay fully visible while editing. Forwards a ref so callers can focus it. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}>(function AutoTextarea({ value, onChange, className = '', placeholder, minRows = 3, onKeyDown }, ref) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  function setRef(el: HTMLTextAreaElement | null) {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  }
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea ref={setRef} className={`textarea textarea-auto ${className}`} value={value}
      rows={minRows} placeholder={placeholder} onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)} />
  );
});

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'azure' }) {
  return <span className={`pill pill-${tone} mono`}>{children}</span>;
}

const DOT_TONE: Record<RatingLevel, string> = { excellent: 'good', good: 'avg', needs_work: 'bad' };

export function StatusDot({ level }: { level: RatingLevel }) {
  return <span className={`dot dot-${DOT_TONE[level]}`} aria-hidden />;
}

const LEVELS: { key: RatingLevel; label: string }[] = [
  { key: 'excellent', label: 'Excellent' },
  { key: 'good', label: 'Good' },
  { key: 'needs_work', label: 'Needs work' },
];

/** Three-level rating control. Each segment maps to the guide's rating tier and
 * carries the status-dot color. */
export function RatingSegment({
  value, onChange,
}: { value: RatingLevel | undefined; onChange: (l: RatingLevel) => void }) {
  return (
    <div className="segment" role="group" aria-label="Rating">
      {LEVELS.map((l) => (
        <button
          key={l.key}
          type="button"
          className={`segment-btn ${value === l.key ? 'is-active seg-' + DOT_TONE[l.key] : ''}`}
          aria-pressed={value === l.key}
          onClick={() => onChange(l.key)}
        >
          <span className={`dot dot-${DOT_TONE[l.key]}`} aria-hidden />
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: string; onToggle: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
}

/** Round initials badge for a competitor. */
export function Avatar({ label }: { label: string }) {
  return <span className="avatar mono" aria-hidden>{initialsFor(label)}</span>;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: 'Ready', saving: 'Saving…', saved: 'Saved', error: 'Save failed',
};
const STATUS_DOT: Record<SaveStatus, string> = {
  idle: 'good', saving: 'avg', saved: 'good', error: 'bad',
};

export function SaveIndicator({ status, at }: { status: SaveStatus; at?: number }) {
  const time = at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  return (
    <span className="save-indicator mono" title={status === 'error' ? 'Could not write to the file — check permissions' : ''}>
      <span className={`dot dot-${STATUS_DOT[status]}`} aria-hidden />
      {STATUS_TEXT[status]}{status === 'saved' && time ? ` ${time}` : ''}
    </span>
  );
}
