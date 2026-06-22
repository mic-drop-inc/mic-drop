import type { Ballot, Level } from '../lib/db';
import type { EventDef } from '../data/types';
import { EVENT_META } from '../data/eventMeta';

const LEVEL_LABEL: Record<Level, string> = { excellent: 'Excellent', good: 'Good', needs_work: 'Needs work' };

/** Candidates in speaking order; insertion order (id) as the tiebreak. */
export function inSpeakingOrder(ballots: Ballot[]): Ballot[] {
  return [...ballots].sort((a, b) =>
    ((a.speakingOrder ?? Infinity) - (b.speakingOrder ?? Infinity)) || ((a.id ?? 0) - (b.id ?? 0)));
}

/** Format a duration in seconds as m:ss (e.g. 545 -> "9:05"). */
export function fmtTime(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.abs(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse "m:ss" or plain seconds into total seconds; null if blank/invalid. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const m = t.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

const WEIGHT: Record<Level, number> = { excellent: 3, good: 2, needs_work: 1 };

/** A simple comparison score: sum of rating weights. Higher = stronger. Returns
 * the sum and the max possible so the table can show "17/21". A judging aid for
 * ranking — not an official NSDA score. */
export function ratingScore(event: EventDef, b: Ballot): { sum: number; max: number; rated: number } {
  let sum = 0, rated = 0;
  for (const c of event.criteria) {
    const lvl = b.ratings[c.key];
    if (lvl) { sum += WEIGHT[lvl]; rated++; }
  }
  return { sum, max: event.criteria.length * 3, rated };
}

export function emptyBallot(eventKey: string): Ballot {
  const now = new Date().toISOString();
  return {
    eventKey,
    round: '',
    room: '',
    competitorCode: '',
    competitorName: '',
    speakingOrder: null,
    rank: null,
    points: null,
    timeSeconds: null,
    ratings: {},
    comments: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Has the judge entered anything worth persisting yet? Keeps empty ballots out
 * of the DB until there is real content. */
export function hasContent(b: Ballot): boolean {
  return (
    b.competitorCode.trim() !== '' ||
    b.competitorName.trim() !== '' ||
    b.notes.trim() !== '' ||
    Object.keys(b.ratings).length > 0 ||
    b.comments.length > 0 ||
    b.rank != null ||
    b.points != null
  );
}

/** Short badge text for a competitor. Prefers a code-like single token (has a
 * digit, or a short all-caps abbrev like "AB123" / "OO" / "DEC"); otherwise the
 * initials of the first couple of words ("Jordan Lee" -> "JL"). */
export function initialsFor(label: string): string {
  const text = label.trim();
  if (!text) return '?';
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const t = tokens[0];
    const codeLike = /^[A-Za-z0-9-]{1,6}$/.test(t) && (/\d/.test(t) || (t === t.toUpperCase() && /[A-Z]/.test(t)));
    if (codeLike) return t.toUpperCase().slice(0, 4);
  }
  return tokens.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function competitorLabel(b: Ballot): string {
  const name = b.competitorName.trim();
  const code = b.competitorCode.trim();
  if (name && code) return `${name} (${code})`;
  return name || code || 'Unnamed competitor';
}

/** One self-contained markdown document with everything in the file: the round's
 * metadata, a summary table, and every candidate's scores, rank, time, and notes.
 * Used for the "Copy everything / Backup" export. */
export function exportMarkdown(event: EventDef, ballots: Ballot[], round: string, room: string): string {
  const code = EVENT_META[event.key]?.code ?? '';
  const ordered = inSpeakingOrder(ballots);
  const out: string[] = [];

  out.push(`# ${event.name}${code ? ` (${code})` : ''} — Ballots`);
  out.push('');
  out.push(`- Round: ${round || '—'}`);
  out.push(`- Room: ${room || '—'}`);
  out.push(`- Candidates: ${ballots.length}`);
  out.push('');

  out.push('## Summary');
  out.push('');
  out.push('| # | Competitor | Time | Score | Rank | Points |');
  out.push('|---|------------|------|-------|------|--------|');
  for (const b of ordered) {
    const sc = ratingScore(event, b);
    out.push(`| ${b.speakingOrder ?? '—'} | ${competitorLabel(b)} | ${fmtTime(b.timeSeconds)} | `
      + `${sc.rated > 0 ? `${sc.sum}/${sc.max}` : '—'} | ${b.rank ?? '—'} | ${b.points ?? '—'} |`);
  }
  out.push('');

  out.push('## Candidates');
  for (const b of ordered) {
    out.push('');
    out.push(`### ${b.speakingOrder ?? '—'}. ${competitorLabel(b)}`);
    out.push(`- Code: ${b.competitorCode || '—'}`);
    out.push(`- Time: ${fmtTime(b.timeSeconds)}`);
    out.push(`- Rank: ${b.rank ?? '—'} · Points: ${b.points ?? '—'}`);
    out.push('- Ratings:');
    const rated = event.criteria.filter((c) => b.ratings[c.key]);
    if (rated.length) {
      for (const c of rated) out.push(`  - ${c.name}: ${LEVEL_LABEL[b.ratings[c.key]]}`);
    } else {
      out.push('  - (none)');
    }
    out.push('- Notes:');
    out.push('');
    out.push(b.notes.trim() ? b.notes.trim().split('\n').map((l) => `  ${l}`).join('\n') : '  (none)');
  }
  out.push('');
  return out.join('\n');
}
