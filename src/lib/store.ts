// App data controller: owns the single sql.js Database + the file handle, and
// persists the whole DB back to the user's .sqlite on disk. Kept framework-free
// so the persistence logic is testable and the React layer stays thin.
import type { Database } from 'sql.js';
import { getSqlJs } from './sqljs';
import * as fs from './fileStore.index';
import * as local from './localDb';
import {
  openDatabase, saveBallot, listBallots, getBallot, deleteBallot, exportBytes,
  distinctEventKeys, setRoundRoomAll as setRoundRoomAllDb, firstRoundRoom,
  type Ballot,
} from './db';

export type { Ballot };

type Mode = 'file' | 'manual';
interface Conn { fileName: string; db: Database; handle: fs.Handle | null; mode: Mode; }
let conn: Conn | null = null;

export function isOpen(): boolean { return conn != null; }
export function fileName(): string { return conn?.fileName ?? ''; }
export function isSupported(): boolean { return fs.isSupported(); }
export function isManual(): boolean { return conn?.mode === 'manual'; }
/** Display name of a resumable file from a previous session, or null. */
export async function restorableName(): Promise<string | null> {
  const h = await fs.restoreHandle();
  return h ? await fs.handleName(h) : null;
}

async function connect(handle: fs.Handle): Promise<void> {
  const SQL = await getSqlJs();
  // A freshly created file is zero bytes -> start an empty DB; otherwise load it.
  let bytes: Uint8Array | null = null;
  try { bytes = await fs.readBytes(handle); } catch { bytes = null; }
  const db = openDatabase(SQL, bytes && bytes.length ? bytes : null);
  conn = { fileName: await fs.handleName(handle), db, handle, mode: 'file' };
  installExitFlush();
  await persistNow(); // materialize schema into a new file immediately
}

// --- Manual (download/upload) mode for browsers without File System Access. The
// DB lives in memory + mirrors to IndexedDB on autosave; the user downloads the
// .sqlite to keep a real file and uploads one to reopen. ---

async function connectManual(name: string, bytes: Uint8Array | null): Promise<void> {
  const SQL = await getSqlJs();
  const db = openDatabase(SQL, bytes && bytes.length ? bytes : null);
  conn = { fileName: name || 'ballots.sqlite', db, handle: null, mode: 'manual' };
  installExitFlush();
  await persistNow(); // mirror to IndexedDB immediately
}

export async function createManualFile(name?: string): Promise<void> {
  await connectManual(name?.trim() || 'ballots.sqlite', null);
}

/** Import an uploaded .sqlite File into a manual session. */
export async function importFile(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  await connectManual(file.name, bytes);
}

/** Name of an in-browser session saved last time, or null. */
export async function manualResumeName(): Promise<string | null> {
  const rec = await local.loadLocal();
  return rec?.name ?? null;
}

/** Resume the in-browser session from IndexedDB. */
export async function resumeManual(): Promise<boolean> {
  const rec = await local.loadLocal();
  if (!rec) return false;
  await connectManual(rec.name, rec.bytes);
  return true;
}

/** Download the current DB as a .sqlite file (the manual-mode "save"). */
export function downloadDb(): void {
  if (!conn) return;
  const bytes = exportBytes(conn.db);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = /\.(sqlite|db)$/i.test(conn.fileName) ? conn.fileName : `${conn.fileName}.sqlite`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Belt-and-suspenders for live use: flush any pending edit when the tab is hidden
// or closed, so an edit within the autosave debounce window isn't lost.
let exitFlushInstalled = false;
function installExitFlush(): void {
  if (exitFlushInstalled || typeof document === 'undefined') return;
  exitFlushInstalled = true;
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; } void persistNow(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}

export async function createNewFile(name?: string): Promise<void> { await connect(await fs.pickNewFile(name)); }
export async function openExistingFile(): Promise<void> { await connect(await fs.pickExistingFile()); }

/** Resume a handle from a previous session. Must be called from a user gesture
 * because re-granting permission after reload may prompt. Returns false if the
 * user declines permission. */
export async function resume(): Promise<boolean> {
  const handle = await fs.restoreHandle();
  if (!handle) return false;
  if (!(await fs.ensurePermission(handle))) return false;
  await connect(handle);
  return true;
}

export async function closeFile(): Promise<void> {
  const wasFile = conn?.mode === 'file';
  conn?.db.close();
  conn = null;
  if (wasFile) await fs.forgetHandle();
  // Manual-mode data is intentionally kept in IndexedDB so it can be resumed.
}

export function list(eventKey?: string): Ballot[] {
  if (!conn) return [];
  return listBallots(conn.db, eventKey);
}
export function get(id: number): Ballot | null { return conn ? getBallot(conn.db, id) : null; }

/** Write a ballot into the DB (in memory). Returns the row id. Does NOT touch
 * disk — call persistNow()/scheduleSave() to flush. */
export function save(b: Ballot): number {
  if (!conn) throw new Error('no file open');
  return saveBallot(conn.db, b);
}

export function remove(id: number): void { if (conn) deleteBallot(conn.db, id); }

/** Event keys with ballots in the open file (one-program-per-file logic). */
export function eventsPresent(): string[] { return conn ? distinctEventKeys(conn.db) : []; }

/** Apply shared Round/Room to every ballot of one event (scoped — never crosses
 * events in a legacy multi-event file). */
export function setRoundRoomAll(eventKey: string, round: string, room: string): void {
  if (conn) setRoundRoomAllDb(conn.db, eventKey, round, room);
}

/** Seed the shared Round/Room from what this event already holds in the file. */
export function roundRoomSeed(eventKey: string): { round: string; room: string } {
  return conn ? firstRoundRoom(conn.db, eventKey) : { round: '', room: '' };
}

/** Flush the whole DB now: to the chosen file (file mode) or to IndexedDB
 * (manual mode — the user downloads the .sqlite separately). */
export async function persistNow(): Promise<void> {
  if (!conn) return;
  if (conn.mode === 'manual') { await local.saveLocal(conn.fileName, exportBytes(conn.db)); return; }
  await fs.writeBytes(conn.handle, exportBytes(conn.db));
}

// --- Debounced autosave with status, for live use during a round ---
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
let timer: ReturnType<typeof setTimeout> | null = null;
let statusCb: ((s: SaveStatus, at?: number) => void) | null = null;

export function onSaveStatus(cb: (s: SaveStatus, at?: number) => void): void { statusCb = cb; }

/** Persist after a short quiet period; coalesces rapid edits during judging. */
export function scheduleSave(): void {
  if (timer) clearTimeout(timer);
  statusCb?.('saving');
  timer = setTimeout(async () => {
    try { await persistNow(); statusCb?.('saved', Date.now()); }
    catch { statusCb?.('error'); }
  }, 400);
}

// --- Belt-and-suspenders: mirror the in-progress draft to localStorage so a
// crash/navigation before the first disk write never loses the active ballot. ---
const draftKey = (file: string, eventKey: string) => `nsda-draft:${file}:${eventKey}`;

export function saveDraft(eventKey: string, draft: unknown): void {
  if (!conn) return;
  try { localStorage.setItem(draftKey(conn.fileName, eventKey), JSON.stringify(draft)); } catch { /* quota */ }
}
export function loadDraft<T>(eventKey: string): T | null {
  if (!conn) return null;
  const raw = localStorage.getItem(draftKey(conn.fileName, eventKey));
  return raw ? (JSON.parse(raw) as T) : null;
}
export function clearDraft(eventKey: string): void {
  if (!conn) return;
  localStorage.removeItem(draftKey(conn.fileName, eventKey));
}
