import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Ballot } from '../lib/db';
import { competitorLabel } from './ballotModel';
import { Avatar } from './primitives';

type Col = 'ranked' | 'unranked';

// Two-column interactive ranking. Both columns reorder; the right column also
// reranks (rank = position), the left column persists speaking order.
//
// Drag is implemented with POINTER events (not native HTML5 drag-and-drop),
// because the macOS/Linux system webview (Electrobun) does not reliably fire
// dragstart/drop. Pointer events + elementFromPoint work everywhere. Chips are
// not click-to-open (that caused stray navigation); use the score table below to
// open a ballot.
export function RankBoard({
  ballots, onApply, onAdd,
}: {
  ballots: Ballot[];
  onApply: (rankedIds: number[], unrankedIds: number[]) => void;
  onAdd: (label: string) => void;
}) {
  const ranked = ballots.filter((b) => b.rank != null).sort((a, b) => a.rank! - b.rank!);
  const unranked = ballots.filter((b) => b.rank == null).sort((a, b) =>
    ((a.speakingOrder ?? Infinity) - (b.speakingOrder ?? Infinity)) || ((a.id ?? 0) - (b.id ?? 0)));
  const rankedIds = ranked.map((b) => b.id!);
  const unrankedIds = unranked.map((b) => b.id!);

  const [addText, setAddText] = useState('');
  const [drag, setDrag] = useState<{ id: number; label: string } | null>(null);
  const [ghost, setGhost] = useState({ x: 0, y: 0 });
  const [over, setOver] = useState<{ col: Col; idx: number } | null>(null);

  // Latest values for the window-level pointer handlers (avoid stale closures).
  const dragRef = useRef(drag); dragRef.current = drag;
  const overRef = useRef(over); overRef.current = over;
  const listsRef = useRef({ rankedIds, unrankedIds }); listsRef.current = { rankedIds, unrankedIds };

  function startDrag(e: RPointerEvent, b: Ballot) {
    e.preventDefault();
    setDrag({ id: b.id!, label: competitorLabel(b) });
    setGhost({ x: e.clientX, y: e.clientY });
    setOver(null);
  }

  useEffect(() => {
    if (!drag) return;
    function move(e: PointerEvent) {
      setGhost({ x: e.clientX, y: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const slot = el?.closest('[data-rankslot]') as HTMLElement | null;
      if (slot) {
        const col = slot.dataset.col as Col;
        const idx = Number(slot.dataset.idx);
        const r = slot.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        setOver({ col, idx: idx + (after ? 1 : 0) });
        return;
      }
      const colEl = el?.closest('[data-rankcol]') as HTMLElement | null;
      if (colEl) {
        const col = colEl.dataset.col as Col;
        const len = col === 'ranked' ? listsRef.current.rankedIds.length : listsRef.current.unrankedIds.length;
        setOver({ col, idx: len });
      }
    }
    function up() {
      const d = dragRef.current, o = overRef.current;
      if (d && o) {
        const r = listsRef.current.rankedIds.filter((x) => x !== d.id);
        const u = listsRef.current.unrankedIds.filter((x) => x !== d.id);
        const target = o.col === 'ranked' ? listsRef.current.rankedIds : listsRef.current.unrankedIds;
        // Insertion index is measured against the pre-removal list. When moving
        // DOWN within the same column, removing the dragged item shifts targets
        // up by one — compensate.
        const fromIdx = target.indexOf(d.id);
        let idx = o.idx;
        if (fromIdx !== -1 && fromIdx < idx) idx -= 1;
        if (o.col === 'ranked') r.splice(Math.max(0, Math.min(idx, r.length)), 0, d.id);
        else u.splice(Math.max(0, Math.min(idx, u.length)), 0, d.id);
        onApply(r, u);
      }
      setDrag(null); setOver(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // → / × buttons: move a candidate to the end of the other column.
  function moveTo(id: number, col: Col) {
    const r = rankedIds.filter((x) => x !== id);
    const u = unrankedIds.filter((x) => x !== id);
    if (col === 'ranked') r.push(id); else u.push(id);
    onApply(r, u);
  }

  function Chip({ b, col, idx, rank }: { b: Ballot; col: Col; idx: number; rank?: number }) {
    const isOver = over != null && over.col === col && over.idx === idx;
    return (
      <div data-rankslot data-col={col} data-idx={idx} className={`rank-slot ${isOver ? 'is-over' : ''}`}>
        <div className={`rank-chip ${drag?.id === b.id ? 'is-dragging' : ''}`} onPointerDown={(e) => startDrag(e, b)}>
          {rank != null ? <span className="rank-chip-num mono">{rank}</span> : <span className="rank-grip" aria-hidden>⋮⋮</span>}
          <Avatar label={competitorLabel(b)} />
          <span className="rank-chip-label">{competitorLabel(b)}</span>
          {col === 'unranked'
            ? <button className="rank-chip-btn" title="Add to ranks" onPointerDown={(e) => e.stopPropagation()} onClick={() => moveTo(b.id!, 'ranked')}>→</button>
            : <button className="rank-chip-btn" title="Unrank" onPointerDown={(e) => e.stopPropagation()} onClick={() => moveTo(b.id!, 'unranked')}>×</button>}
        </div>
      </div>
    );
  }

  const endOver = (col: Col, len: number) => over != null && over.col === col && over.idx >= len;

  return (
    <div className={`rank-board ${drag ? 'is-dragging' : ''}`}>
      <section className="rank-col" data-rankcol data-col="unranked">
        <div className="rank-col-head overline">Unranked ({unranked.length}) — speaking order</div>
        <form className="rank-add" onSubmit={(e) => { e.preventDefault(); if (addText.trim()) { onAdd(addText); setAddText(''); } }}>
          <input className="input" value={addText} placeholder="Add candidate — code or name"
            onChange={(e) => setAddText(e.target.value)} />
          <button className="btn btn-sm" type="submit" disabled={!addText.trim()}>Add</button>
        </form>
        <div className="rank-col-body">
          {unranked.map((b, i) => <Chip key={b.id} b={b} col="unranked" idx={i} />)}
          <div className={`rank-end ${endOver('unranked', unranked.length) ? 'is-over' : ''}`}
            data-rankslot data-col="unranked" data-idx={unranked.length} />
          {ballots.length === 0 && <p className="rank-empty">Add candidates to begin.</p>}
        </div>
      </section>

      <section className="rank-col rank-col-ranked" data-rankcol data-col="ranked">
        <div className="rank-col-head overline">Ranked ({ranked.length}) — best at top</div>
        <div className="rank-col-body">
          {ranked.map((b, i) => <Chip key={b.id} b={b} col="ranked" idx={i} rank={i + 1} />)}
          <div className={`rank-end ${endOver('ranked', ranked.length) ? 'is-over' : ''}`}
            data-rankslot data-col="ranked" data-idx={ranked.length} />
          {ranked.length === 0 && <p className="rank-empty">Drag candidates here, or click →</p>}
        </div>
      </section>

      {drag && (
        <div className="rank-ghost mono" style={{ left: ghost.x, top: ghost.y }}>{drag.label}</div>
      )}
    </div>
  );
}
