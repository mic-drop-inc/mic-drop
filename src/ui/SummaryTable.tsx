import { useState } from 'react';
import type { Ballot } from '../lib/db';
import type { EventDef, RatingLevel } from '../data/types';
import { EVENT_META } from '../data/eventMeta';
import { fmtTime, ratingScore, competitorLabel } from './ballotModel';
import { Avatar } from './primitives';
import { RunningTimer } from './RunningTimer';
import { RankBoard } from './RankBoard';
import { IconCopy, IconCheck } from './icons';

const LEVEL_DOT: Record<RatingLevel, string> = { excellent: 'good', good: 'avg', needs_work: 'bad' };
const LEVEL_CHAR: Record<RatingLevel, string> = { excellent: 'E', good: 'G', needs_work: 'N' };

type SortKey = 'order' | 'rank' | 'score' | 'time';

export function SummaryTable({
  event, ballots, onOpen, onEdit, onAddCandidate, onApply,
}: {
  event: EventDef;
  ballots: Ballot[];
  onOpen: (id: number) => void;
  onEdit: (id: number, patch: Partial<Ballot>) => void;
  onAddCandidate: (label: string) => void;
  onApply: (rankedIds: number[], unrankedIds: number[]) => void;
}) {
  const meta = EVENT_META[event.key];
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  async function copyNotes(id: number, notes: string) {
    try {
      await navigator.clipboard.writeText(notes);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch { /* clipboard blocked */ }
  }

  // nulls always sort last so unranked/untimed competitors fall to the bottom.
  const nl = (v: number | null) => (v == null ? Number.POSITIVE_INFINITY : v);
  const sorted = [...ballots].sort((a, b) => {
    if (sortKey === 'rank') return nl(a.rank) - nl(b.rank);
    if (sortKey === 'time') return nl(a.timeSeconds) - nl(b.timeSeconds);
    if (sortKey === 'score') return ratingScore(event, b).sum - ratingScore(event, a).sum; // high first
    return nl(a.speakingOrder) - nl(b.speakingOrder);
  });

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className={`sortable ${sortKey === k ? 'is-sorted' : ''}`} onClick={() => setSortKey(k)}>
      {children}{sortKey === k ? ' ↓' : ''}
    </th>
  );

  return (
    <div className="summary">
      <header className="page-head">
        <div>
          <span className="overline">{meta.code} · {ballots.length} competitors</span>
          <h1 className="page-title">Compare &amp; rank</h1>
          <p className="page-sub">Drag candidates into the Ranked column to set their rank, or click a name to open the full ballot.</p>
        </div>
      </header>

      <RunningTimer ballots={ballots} onOpen={onOpen} limitSec={meta.timeLimitSec} graceSec={meta.graceSec} variant="bar" />

      <RankBoard ballots={ballots} onApply={onApply} onAdd={onAddCandidate} />

      {ballots.length > 0 && <>
      <div className="overline summary-section">Scores</div>
      <div className="summary-scroll">
        <table className="summary-table">
          <thead>
            <tr>
              <Th k="order">#</Th>
              <th>Competitor</th>
              <Th k="time">Time</Th>
              <Th k="score">Score</Th>
              {event.criteria.map((c, i) => (
                <th key={c.key} className="crit-col" title={c.name}>{i + 1}</th>
              ))}
              <Th k="rank">Rank</Th>
              <th>Points</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const sc = ratingScore(event, b);
              const over = b.timeSeconds != null && b.timeSeconds > meta.timeLimitSec;
              const overGrace = b.timeSeconds != null && b.timeSeconds > meta.timeLimitSec + meta.graceSec;
              return (
                <tr key={b.id}>
                  <td className="mono num">{b.speakingOrder ?? '—'}</td>
                  <td><button className="link-name name-cell" onClick={() => onOpen(b.id!)}>
                    <Avatar label={competitorLabel(b)} />{competitorLabel(b)}</button></td>
                  <td className={`mono num ${overGrace ? 'over-grace' : over ? 'over-time' : ''}`}>
                    {fmtTime(b.timeSeconds)}</td>
                  <td className="mono num">{sc.rated > 0 ? `${sc.sum}/${sc.max}` : '—'}</td>
                  {event.criteria.map((c) => {
                    const lvl = b.ratings[c.key];
                    return (
                      <td key={c.key} className="crit-cell" title={`${c.name}: ${lvl ?? 'unrated'}`}>
                        {lvl
                          ? <span className={`rate-pip rate-${LEVEL_DOT[lvl]}`}>{LEVEL_CHAR[lvl]}</span>
                          : <span className="rate-empty">·</span>}
                      </td>
                    );
                  })}
                  <td>
                    <input className="input mono cell-input" type="number" min={1} value={b.rank ?? ''}
                      onChange={(e) => onEdit(b.id!, { rank: e.target.value === '' ? null : Number(e.target.value) })} />
                  </td>
                  <td>
                    <input className="input mono cell-input" type="number" value={b.points ?? ''}
                      onChange={(e) => onEdit(b.id!, { points: e.target.value === '' ? null : Number(e.target.value) })} />
                  </td>
                  <td>
                    <button className="btn btn-sm" disabled={!b.notes.trim()}
                      onClick={() => copyNotes(b.id!, b.notes)}
                      title={b.notes.trim() ? 'Copy this candidate’s notes' : 'No notes yet'}>
                      {copiedId === b.id ? <><IconCheck /> Copied</> : <><IconCopy /> Copy</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="summary-legend overline">
        Criteria: {event.criteria.map((c, i) => `${i + 1} ${c.name}`).join(' · ')}
        <br />Score = sum of rating weights (Excellent 3 · Good 2 · Needs work 1), aid only.
      </div>
      </>}
    </div>
  );
}
