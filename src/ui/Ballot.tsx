import { useEffect, useRef, useState } from 'react';
import type { Ballot as BallotT } from '../lib/db';
import type { EventDef, CommentTone, RatingLevel } from '../data/types';
import { EVENT_META, CATEGORY_LABEL, CATEGORY_MINDSET } from '../data/eventMeta';
import { RatingSegment, AutoTextarea } from './primitives';
import { Stopwatch } from './Stopwatch';
import { IconTrash, IconCopy, IconCheck } from './icons';

// Comment tones map to the three matrix columns (rating tiers).
const TONES: CommentTone[] = ['strong', 'average', 'needs_work'];
const COL_LABEL: Record<CommentTone, string> = { strong: 'Excellent', average: 'Good', needs_work: 'Needs work' };
const TONE_CLASS: Record<CommentTone, string> = { strong: 'good', average: 'avg', needs_work: 'bad' };
const LEVEL_TONE: Record<RatingLevel, CommentTone> = { excellent: 'strong', good: 'average', needs_work: 'needs_work' };
const LEVEL_DOT: Record<RatingLevel, string> = { excellent: 'good', good: 'avg', needs_work: 'bad' };
const LEVEL_LABEL: Record<RatingLevel, string> = { excellent: 'Excellent', good: 'Good', needs_work: 'Needs work' };

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function Ballot({
  event, ballot, onChange, onDelete,
}: {
  event: EventDef;
  ballot: BallotT;
  onChange: (patch: Partial<BallotT>) => void;
  onDelete: () => void;
}) {
  const meta = EVENT_META[event.key];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Append a bullet line to the notes — the single place everything consolidates
  // (quick notes + picked comment fragments). Never edits what's already there.
  function appendNote(text: string) {
    const line = `• ${text.trim()}`;
    onChange({ notes: ballot.notes.trim() ? `${ballot.notes}\n${line}` : line });
  }

  function addQuickNote() {
    if (!quickText.trim()) return;
    appendNote(quickText);
    setQuickText('');
    quickRef.current?.focus();
  }

  // Adding a comment fragment drops it into the notes for consolidation.
  function addComment(id: string, text: string) {
    appendNote(text);
    setAddedId(id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), 1100);
  }

  async function copyNotes() {
    try { await navigator.clipboard.writeText(ballot.notes); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  }

  function setRating(critKey: string, level: RatingLevel) {
    const next = { ...ballot.ratings };
    if (next[critKey] === level) delete next[critKey]; else next[critKey] = level;
    onChange({ ratings: next });
  }

  function focusCriterion(i: number) {
    setFocusedIdx(i);
    const key = event.criteria[i].key;
    setExpanded((e) => ({ ...e, [key]: true }));
    requestAnimationFrame(() => scrollTo(`sec-${key}`));
  }

  // Keyboard scoring: j/k move the focused criterion, 1/2/3 rate it, a jumps to
  // the quick-note field. Latest state is read via a ref so the listener binds once.
  const kbd = useRef<{ idx: number; rate: (i: number, l: RatingLevel) => void }>({ idx: 0, rate: () => {} });
  kbd.current = { idx: focusedIdx, rate: (i, l) => setRating(event.criteria[i].key, l) };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = event.criteria.length;
      const { idx, rate } = kbd.current;
      if (e.key === 'j') { e.preventDefault(); focusCriterion(Math.min(idx + 1, n - 1)); }
      else if (e.key === 'k') { e.preventDefault(); focusCriterion(Math.max(idx - 1, 0)); }
      else if (e.key === '1') { e.preventDefault(); rate(idx, 'excellent'); }
      else if (e.key === '2') { e.preventDefault(); rate(idx, 'good'); }
      else if (e.key === '3') { e.preventDefault(); rate(idx, 'needs_work'); }
      else if (e.key === 'a') { e.preventDefault(); scrollTo('sec-notes'); quickRef.current?.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.key]);

  function openAndScroll(critKey: string) {
    setExpanded((e) => ({ ...e, [critKey]: true }));
    requestAnimationFrame(() => scrollTo(`sec-${critKey}`));
  }
  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(event.criteria.map((c) => [c.key, open])));

  const ratedCount = Object.keys(ballot.ratings).length;

  return (
    <div className="ballot">
      <header className="page-head">
        <div>
          <span className="overline">{meta.code} · {CATEGORY_LABEL[meta.category]}</span>
          <h1 className="page-title">{event.name}</h1>
          <p className="page-sub">{event.meta}</p>
        </div>
        <div className="page-head-right">
          <button className="btn btn-sm btn-primary" onClick={copyNotes} disabled={!ballot.notes.trim()}
            title="Copy this candidate's consolidated notes">
            {copied ? <><IconCheck /> Copied</> : <><IconCopy /> Copy notes</>}
          </button>
          {ballot.id != null && <button className="btn btn-sm btn-danger" onClick={onDelete}><IconTrash /> Delete</button>}
        </div>
      </header>

      <p className="mindset"><span className="overline">Ask yourself</span> {CATEGORY_MINDSET[meta.category]}</p>

      {/* In-page criterion jump bar (in normal flow — no longer floating) */}
      <nav className="ballot-nav">
        <span className="ballot-nav-progress mono">{ratedCount}/{event.criteria.length} rated</span>
        <div className="ballot-nav-dots">
          {event.criteria.map((c, i) => {
            const lvl = ballot.ratings[c.key];
            return (
              <button key={c.key} className="nav-dot-btn" title={c.name} onClick={() => openAndScroll(c.key)}>
                <span className={`dot ${lvl ? 'dot-' + LEVEL_DOT[lvl] : 'dot-empty'}`} aria-hidden />
                <span className="nav-dot-num mono">{i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="ballot-nav-right">
          <span className="kbd-hint mono" title="j / k move focus · 1 · 2 · 3 rate · a quick note">j/k · 1·2·3 · a</span>
          <button className="link-btn" onClick={() => setAll(true)}>Expand all</button>
          <button className="link-btn" onClick={() => setAll(false)}>Collapse all</button>
          <button className="link-btn" onClick={() => scrollTo('sec-notes')}>Notes</button>
        </div>
      </nav>

      {/* Competitor identity — Round/Room are file-level (set in the sidebar) */}
      <section className="card" id="sec-competitor">
        <div className="field-grid">
          <Field label="Competitor (name or code)"><input className="input" value={ballot.competitorName}
            onChange={(e) => onChange({ competitorName: e.target.value })} placeholder="e.g. Jordan Lee or AB123" /></Field>
          <Field label="Speaking order"><input className="input mono" type="number" min={1} value={ballot.speakingOrder ?? ''}
            onChange={(e) => onChange({ speakingOrder: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        </div>
      </section>

      {/* Criteria — collapsed by default; rate from the header, expand for the comment matrix */}
      {event.criteria.map((c, i) => {
        const level = ballot.ratings[c.key];
        const isOpen = expanded[c.key] ?? false;
        const groupComments = event.comments.filter((cm) => cm.criterionKey === c.key);
        return (
          <section className={`card crit ${isOpen ? 'is-open' : ''} ${focusedIdx === i ? 'is-focused' : ''}`}
            key={c.key} id={`sec-${c.key}`}>
            <div className="crit-head">
              <button className="crit-toggle" onClick={() => { setFocusedIdx(i); setExpanded((e) => ({ ...e, [c.key]: !isOpen })); }}
                aria-expanded={isOpen}>
                <span className="crit-num mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="crit-name">{c.name}</span>
                <span className="crit-summary">
                  {level && <span className={`tag tag-${TONE_CLASS[LEVEL_TONE[level]]}`}>{LEVEL_LABEL[level]}</span>}
                  <span className="crit-chevron mono">{isOpen ? '−' : '+'}</span>
                </span>
              </button>
              <RatingSegment value={level} onChange={(l) => setRating(c.key, l)} />
            </div>

            {isOpen && (
              <div className="crit-body">
                <p className="crit-hint">{c.whatToEvaluate}</p>
                {level && <p className="crit-indicator">
                  <span className={`tag tag-${TONE_CLASS[LEVEL_TONE[level]]}`}>{LEVEL_LABEL[level]}</span>{c.levels[level]}</p>}
                <div className="overline comments-label">Click a fragment to drop it into your notes</div>
                <div className="comment-matrix">
                  {TONES.map((tone) => {
                    const suggested = level != null && LEVEL_TONE[level] === tone;
                    const frags = groupComments.filter((cm) => cm.tone === tone);
                    return (
                      <div key={tone} className={`cm-col cm-${TONE_CLASS[tone]} ${suggested ? 'is-suggested' : ''}`}>
                        <div className="cm-col-head overline">
                          <span className={`dot dot-${TONE_CLASS[tone]}`} aria-hidden /> {COL_LABEL[tone]}
                          {suggested ? ' · suggested' : ''}
                        </div>
                        <div className="cm-frags">
                          {frags.map((cm) => {
                            const added = addedId === cm.id;
                            return (
                              <button key={cm.id} type="button"
                                className={`cm-frag ${added ? 'is-added' : ''}`}
                                onClick={() => addComment(cm.id, cm.text)} title="Add to notes">
                                <span className="cm-plus" aria-hidden>{added ? '✓' : '+'}</span>
                                <span>{cm.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {/* Speech time + stopwatch. Keyed by createdAt (stable per candidate) so the
          manual field resets between candidates; the running clock itself lives in
          the module-level timer and survives view changes. */}
      <section className="card" id="sec-time">
        <label className="overline">Speech time</label>
        <Stopwatch key={ballot.createdAt} id={ballot.createdAt} value={ballot.timeSeconds}
          onChange={(s) => onChange({ timeSeconds: s })}
          limitSec={meta.timeLimitSec} graceSec={meta.graceSec} />
      </section>

      {/* Notes — the single consolidation surface. Quick-add lives here (no floating bar). */}
      <section className="card" id="sec-notes">
        <div className="notes-head">
          <label className="overline">Ballot notes <span className="label-note">— quick notes + picked fragments; edit freely, then Copy notes</span></label>
        </div>
        <div className="quick-add">
          <span className="quick-add-label overline">Quick add <kbd>a</kbd></span>
          <input ref={quickRef} className="input" value={quickText}
            placeholder="Jot a note, Enter to append a bullet"
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addQuickNote(); }
              else if (e.key === 'Escape') { e.preventDefault(); quickRef.current?.blur(); }
            }} />
          <button className="btn btn-sm" onClick={addQuickNote} disabled={!quickText.trim()}>Add</button>
        </div>
        <AutoTextarea className="mono" value={ballot.notes} minRows={6}
          onChange={(v) => onChange({ notes: v })}
          placeholder="Press a to jot quick notes; click fragments above to drop them in. Consolidate here, then Copy notes." />
      </section>

      {/* Result */}
      <section className="card result-card" id="sec-result">
        <div className="field-grid">
          <Field label="Rank in room (1 = best)"><input className="input mono" type="number" min={1} value={ballot.rank ?? ''}
            onChange={(e) => onChange({ rank: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
          <Field label="Rating points"><input className="input mono" type="number" value={ballot.points ?? ''}
            onChange={(e) => onChange({ points: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        </div>
      </section>

      {/* Watch-for reminders */}
      <WatchFor items={event.watchFor} />
    </div>
  );
}

function WatchFor({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card watch">
      <button className="watch-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="overline">Things to watch for ({items.length})</span>
        <span className="mono">{open ? '−' : '+'}</span>
      </button>
      {open && <ul className="watch-list">{items.map((w, i) => <li key={i}>{w}</li>)}</ul>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label overline">{label}</span>
      {children}
    </label>
  );
}
