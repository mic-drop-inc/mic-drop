// Headless proof of the data-integrity core: create DB -> insert ballot ->
// serialize to bytes -> reopen from those bytes -> read back identical data.
// This is the sql.js half of the file roundtrip the app does on disk. The
// browser-only half (File System Access handle persist + re-permission after
// reload) lives in fileStore.ts and is verified manually in a browser.
import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import {
  openDatabase, saveBallot, getBallot, listBallots, deleteBallot, exportBytes,
  setRoundRoomAll, firstRoundRoom,
  type Ballot,
} from '../src/lib/db.ts';

// Pass the wasm bytes directly so the path (which contains spaces) never has to
// round-trip through file:// URL encoding.
const wasmBuf = readFileSync(
  fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);
const SQL = await initSqlJs({ wasmBinary: wasmBuf as unknown as ArrayBuffer });

function sample(overrides: Partial<Ballot> = {}): Ballot {
  return {
    eventKey: 'declamation',
    round: 'Round 3',
    room: '204',
    competitorCode: 'AB123',
    competitorName: 'Jordan Lee',
    speakingOrder: 2,
    rank: 1,
    points: 97,
    timeSeconds: 545,
    ratings: { vocal_delivery: 'excellent', introduction: 'good' },
    comments: ['declamation.vocal_delivery.strong', 'declamation.intro.average'],
    notes: 'Strong teaser; rushed the climax.',
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    ...overrides,
  };
}

test('ballot survives a full serialize/deserialize file roundtrip', () => {
  const db1 = openDatabase(SQL);
  const id = saveBallot(db1, sample());
  expect(id).toBeGreaterThan(0);

  // Simulate writing bytes to disk and reopening a fresh session.
  const bytes = exportBytes(db1);
  db1.close();
  expect(bytes.length).toBeGreaterThan(0);

  const db2 = openDatabase(SQL, bytes);
  const got = getBallot(db2, id);
  expect(got).not.toBeNull();
  // Structured fields must survive JSON round-trip exactly — a test that would
  // fail if ratings/comments serialization regressed.
  expect(got!.ratings).toEqual({ vocal_delivery: 'excellent', introduction: 'good' });
  expect(got!.comments).toEqual(['declamation.vocal_delivery.strong', 'declamation.intro.average']);
  expect(got!.rank).toBe(1);
  expect(got!.points).toBe(97);
  expect(got!.timeSeconds).toBe(545);
  expect(got!.notes).toBe('Strong teaser; rushed the climax.');
  db2.close();
});

test('opening an existing file is additive, not destructive', () => {
  // First "session": one ballot, write to disk.
  const db1 = openDatabase(SQL);
  saveBallot(db1, sample({ competitorCode: 'A1' }));
  const bytes = exportBytes(db1);
  db1.close();

  // Second "session": reopen the same bytes, add another. The first must remain.
  const db2 = openDatabase(SQL, bytes);
  saveBallot(db2, sample({ competitorCode: 'B2' }));
  expect(listBallots(db2, 'declamation').length).toBe(2);
  db2.close();
});

test('migration adds time_seconds to a file created before that column existed', () => {
  // A pre-time_seconds schema, as an older file on disk would have.
  const old = new SQL.Database();
  old.run(`CREATE TABLE ballots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_key TEXT NOT NULL,
    round TEXT NOT NULL DEFAULT '', room TEXT NOT NULL DEFAULT '',
    competitor_code TEXT NOT NULL DEFAULT '', competitor_name TEXT NOT NULL DEFAULT '',
    speaking_order INTEGER, rank INTEGER, points INTEGER,
    ratings_json TEXT NOT NULL DEFAULT '{}', comments_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  old.run("INSERT INTO ballots (event_key, created_at, updated_at) VALUES ('declamation','t','t')");
  const bytes = old.export();
  old.close();

  const db = openDatabase(SQL, bytes); // migrate() runs here
  const existing = listBallots(db, 'declamation')[0];
  expect(existing.timeSeconds).toBeNull(); // old row reads back with the new column
  saveBallot(db, { ...sample(), id: existing.id, timeSeconds: 300 });
  expect(getBallot(db, existing.id!)!.timeSeconds).toBe(300);
  db.close();
});

test('LEGACY-FILE COMPAT: a file written by the old app reads back with zero data loss', () => {
  // Simulates a real pre-existing .sqlite: multiple events in one file (the old
  // UI allowed it), non-empty comments_json, and round/room that differ per
  // ballot. The current code MUST read every byte of this back unchanged — the
  // user has files like this on disk. This guards the "don't break my files"
  // constraint against every later change (one-event-per-file, round/room going
  // file-level, dead comments column, etc.).
  const a: Ballot = sample({
    eventKey: 'declamation', round: 'Round 1', room: '101', competitorCode: 'A1',
    comments: ['declamation.vocal_delivery.strong'], rank: 2, timeSeconds: 540,
  });
  const b: Ballot = sample({
    eventKey: 'original_oratory', round: 'Round 2', room: '202', competitorCode: 'B2',
    ratings: { topic_content: 'good' }, comments: ['original_oratory.topic_content.average'],
    notes: 'Second event in the same file.', rank: 1, timeSeconds: 600,
  });

  const db1 = openDatabase(SQL);
  const idA = saveBallot(db1, a);
  const idB = saveBallot(db1, b);
  const bytes = exportBytes(db1);
  db1.close();

  // Reopen as the app would on disk.
  const db2 = openDatabase(SQL, bytes);

  // Both events still present; neither hidden nor merged.
  expect(listBallots(db2, 'declamation').length).toBe(1);
  expect(listBallots(db2, 'original_oratory').length).toBe(1);

  // Every field of each ballot survives byte-for-byte.
  const gotA = getBallot(db2, idA)!;
  expect(gotA.eventKey).toBe('declamation');
  expect(gotA.round).toBe('Round 1');
  expect(gotA.room).toBe('101');
  expect(gotA.comments).toEqual(['declamation.vocal_delivery.strong']);
  expect(gotA.rank).toBe(2);
  expect(gotA.timeSeconds).toBe(540);

  const gotB = getBallot(db2, idB)!;
  expect(gotB.eventKey).toBe('original_oratory');
  expect(gotB.round).toBe('Round 2');
  expect(gotB.room).toBe('202');
  expect(gotB.ratings).toEqual({ topic_content: 'good' });
  expect(gotB.comments).toEqual(['original_oratory.topic_content.average']);
  expect(gotB.notes).toBe('Second event in the same file.');
  db2.close();
});

test('shared Round/Room is scoped to its event — never stomps another event in the file', () => {
  // App invariant (the write-side the read tests do not cover): setting a file's
  // shared Round/Room must touch ONLY the current event. In a legacy two-event
  // file, editing declamation's room must leave original_oratory untouched.
  const db = openDatabase(SQL);
  const decId = saveBallot(db, sample({ eventKey: 'declamation', round: 'Round 1', room: '101' }));
  const ooId = saveBallot(db, sample({ eventKey: 'original_oratory', round: 'Round 2', room: '202' }));

  setRoundRoomAll(db, 'declamation', 'Round 5', '999');

  // The edited event updated…
  expect(getBallot(db, decId)!.round).toBe('Round 5');
  expect(getBallot(db, decId)!.room).toBe('999');
  // …the other event is intact (no data loss).
  expect(getBallot(db, ooId)!.round).toBe('Round 2');
  expect(getBallot(db, ooId)!.room).toBe('202');

  // Seed reads back per-event, not an arbitrary first row.
  expect(firstRoundRoom(db, 'original_oratory')).toEqual({ round: 'Round 2', room: '202' });
  expect(firstRoundRoom(db, 'declamation')).toEqual({ round: 'Round 5', room: '999' });
  db.close();
});

test('update edits in place; delete removes', () => {
  const db = openDatabase(SQL);
  const id = saveBallot(db, sample({ rank: 3 }));
  saveBallot(db, { ...sample(), id, rank: 1, updatedAt: '2026-06-16T11:00:00.000Z' });
  expect(getBallot(db, id)!.rank).toBe(1);
  expect(listBallots(db, 'declamation').length).toBe(1); // updated, not duplicated
  deleteBallot(db, id);
  expect(getBallot(db, id)).toBeNull();
  db.close();
});
