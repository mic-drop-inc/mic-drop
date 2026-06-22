// Ballot persistence over a sql.js in-memory database. The DB is serialized to
// bytes and written back to the user's chosen .sqlite file by fileStore.ts.
//
// Design: the app BUNDLES all event criteria + sample comments (see
// src/data/events.ts), so the .sqlite file only needs to store the judge's
// ballots — ratings reference bundled criterion keys, selected comments
// reference bundled comment ids. This keeps the file tiny and portable, and
// lets us update guide content without migrating saved ballots.
import type { Database, SqlJsStatic } from 'sql.js';

export type Level = 'excellent' | 'good' | 'needs_work';

export interface Ballot {
  id?: number;
  eventKey: string;
  round: string;
  room: string;
  competitorCode: string;
  competitorName: string;
  speakingOrder: number | null;
  rank: number | null;
  points: number | null;
  timeSeconds: number | null; // speech duration
  ratings: Record<string, Level>; // criterionKey -> level
  comments: string[]; // selected comment ids from bundled data
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS ballots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key       TEXT    NOT NULL,
  round           TEXT    NOT NULL DEFAULT '',
  room            TEXT    NOT NULL DEFAULT '',
  competitor_code TEXT    NOT NULL DEFAULT '',
  competitor_name TEXT    NOT NULL DEFAULT '',
  speaking_order  INTEGER,
  rank            INTEGER,
  points          INTEGER,
  time_seconds    INTEGER,
  ratings_json    TEXT    NOT NULL DEFAULT '{}',
  comments_json   TEXT    NOT NULL DEFAULT '[]',
  notes           TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ballots_event ON ballots(event_key);
`;

/** Open a database from existing file bytes, or create a fresh one. Always
 * ensures the schema exists (CREATE TABLE IF NOT EXISTS), so opening an
 * empty/new file and an existing file follow the same path. */
export function openDatabase(SQL: SqlJsStatic, bytes?: Uint8Array | null): Database {
  const db = bytes && bytes.length > 0 ? new SQL.Database(bytes) : new SQL.Database();
  db.run(SCHEMA);
  migrate(db);
  return db;
}

/** Add columns introduced after a file may have been created. Idempotent. */
function migrate(db: Database): void {
  const info = db.exec('PRAGMA table_info(ballots)');
  const cols = info.length ? info[0].values.map((r) => r[1] as string) : [];
  if (!cols.includes('time_seconds')) db.run('ALTER TABLE ballots ADD COLUMN time_seconds INTEGER');
}

function rowToBallot(r: Record<string, unknown>): Ballot {
  return {
    id: r.id as number,
    eventKey: r.event_key as string,
    round: r.round as string,
    room: r.room as string,
    competitorCode: r.competitor_code as string,
    competitorName: r.competitor_name as string,
    speakingOrder: (r.speaking_order as number) ?? null,
    rank: (r.rank as number) ?? null,
    points: (r.points as number) ?? null,
    timeSeconds: (r.time_seconds as number) ?? null,
    ratings: JSON.parse((r.ratings_json as string) || '{}'),
    comments: JSON.parse((r.comments_json as string) || '[]'),
    notes: r.notes as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Insert a new ballot or update an existing one (when b.id is set). Returns the
 * row id. Mutates nothing on disk — caller serializes + writes back. */
export function saveBallot(db: Database, b: Ballot): number {
  const ratings = JSON.stringify(b.ratings ?? {});
  const comments = JSON.stringify(b.comments ?? []);
  if (b.id != null) {
    db.run(
      `UPDATE ballots SET event_key=?, round=?, room=?, competitor_code=?,
        competitor_name=?, speaking_order=?, rank=?, points=?, time_seconds=?,
        ratings_json=?, comments_json=?, notes=?, updated_at=? WHERE id=?`,
      [b.eventKey, b.round, b.room, b.competitorCode, b.competitorName,
       b.speakingOrder, b.rank, b.points, b.timeSeconds, ratings, comments, b.notes,
       b.updatedAt, b.id],
    );
    return b.id;
  }
  db.run(
    `INSERT INTO ballots (event_key, round, room, competitor_code,
      competitor_name, speaking_order, rank, points, time_seconds, ratings_json,
      comments_json, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.eventKey, b.round, b.room, b.competitorCode, b.competitorName,
     b.speakingOrder, b.rank, b.points, b.timeSeconds, ratings, comments, b.notes,
     b.createdAt, b.updatedAt],
  );
  const res = db.exec('SELECT last_insert_rowid() AS id');
  return res[0].values[0][0] as number;
}

export function getBallot(db: Database, id: number): Ballot | null {
  const stmt = db.prepare('SELECT * FROM ballots WHERE id = ?');
  stmt.bind([id]);
  const out = stmt.step() ? rowToBallot(stmt.getAsObject()) : null;
  stmt.free();
  return out;
}

export function listBallots(db: Database, eventKey?: string): Ballot[] {
  const sql = eventKey
    ? 'SELECT * FROM ballots WHERE event_key = ? ORDER BY round, rank, speaking_order, id'
    : 'SELECT * FROM ballots ORDER BY created_at DESC';
  const stmt = db.prepare(sql);
  if (eventKey) stmt.bind([eventKey]);
  const rows: Ballot[] = [];
  while (stmt.step()) rows.push(rowToBallot(stmt.getAsObject()));
  stmt.free();
  return rows;
}

export function deleteBallot(db: Database, id: number): void {
  db.run('DELETE FROM ballots WHERE id = ?', [id]);
}

/** Distinct event keys that have at least one ballot. Drives one-program-per-file:
 * a fresh file returns []; a normal file returns one; a legacy multi-event file
 * returns several (the UI then lets the judge pick which to work in). */
export function distinctEventKeys(db: Database): string[] {
  const res = db.exec('SELECT DISTINCT event_key FROM ballots ORDER BY event_key');
  return res.length ? res[0].values.map((r) => r[0] as string) : [];
}

/** Round and Room are shared across the candidates of ONE event. Scoped by
 * event_key so a legacy file holding several events never has one event's
 * round/room stomp another's (data-loss guard). */
export function setRoundRoomAll(db: Database, eventKey: string, round: string, room: string): void {
  db.run('UPDATE ballots SET round = ?, room = ? WHERE event_key = ?', [round, room, eventKey]);
}

/** Read back the round/room already stored for an event (to seed the shared
 * fields on open without blanking what an existing file holds). */
export function firstRoundRoom(db: Database, eventKey: string): { round: string; room: string } {
  const res = db.exec(
    "SELECT round, room FROM ballots WHERE event_key = ? AND (round <> '' OR room <> '') LIMIT 1",
    [eventKey],
  );
  if (res.length && res[0].values.length) {
    const [round, room] = res[0].values[0];
    return { round: (round as string) ?? '', room: (room as string) ?? '' };
  }
  return { round: '', room: '' };
}

/** Serialize the whole DB to bytes for writing back to the file handle. */
export function exportBytes(db: Database): Uint8Array {
  return db.export();
}
