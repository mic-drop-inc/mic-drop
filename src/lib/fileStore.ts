// Browser half of disk persistence: the File System Access API. The user picks
// (or creates) a .sqlite file; we hold a FileSystemFileHandle and read/write its
// bytes. The handle is stashed in IndexedDB so it survives a page reload — but
// the browser STILL requires re-granting permission after a reload, so callers
// must run ensurePermission() before reading/writing on a restored handle.
//
// Supported in Chromium browsers (Chrome/Edge) over a secure context
// (https or http://localhost). Safari/Firefox do not implement this API.

const DB_NAME = 'nsda-judge';
const STORE = 'handles';
const HANDLE_KEY = 'sqlite-file';

export function isFileSystemAccessSupported(): boolean {
  return typeof (globalThis as any).showSaveFilePicker === 'function';
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

type Handle = FileSystemFileHandle;

/** Prompt the user to open an existing .sqlite file. */
export async function pickExistingFile(): Promise<Handle> {
  const [handle] = await (globalThis as any).showOpenFilePicker({
    types: [{ description: 'SQLite database', accept: { 'application/x-sqlite3': ['.sqlite', '.db'] } }],
    multiple: false,
  });
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

/** Prompt the user to create a new .sqlite file. */
export async function pickNewFile(suggestedName = 'nsda-ballots.sqlite'): Promise<Handle> {
  const handle = await (globalThis as any).showSaveFilePicker({
    suggestedName,
    types: [{ description: 'SQLite database', accept: { 'application/x-sqlite3': ['.sqlite', '.db'] } }],
  });
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

/** The handle from a previous session, if any. Needs ensurePermission() before use. */
export function restoreHandle(): Promise<Handle | undefined> {
  return idbGet<Handle>(HANDLE_KEY);
}

export async function forgetHandle(): Promise<void> {
  await idbSet(HANDLE_KEY, undefined);
}

/** Re-acquire read/write permission. After a reload the browser downgrades a
 * restored handle to "prompt", so this must run (inside a user gesture if it
 * actually prompts) before the first read/write of a session. */
export async function ensurePermission(handle: Handle): Promise<boolean> {
  const opts = { mode: 'readwrite' } as const;
  // @ts-expect-error queryPermission is part of the FS Access API, not yet in lib.dom
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  // @ts-expect-error requestPermission is part of the FS Access API
  return (await handle.requestPermission(opts)) === 'granted';
}

export async function readBytes(handle: Handle): Promise<Uint8Array> {
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

export async function writeBytes(handle: Handle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  // createWritable() truncates+replaces; the cast sidesteps the typed-array
  // backing-buffer (Shared vs not) variance that fights the DOM lib types.
  await writable.write(bytes as unknown as BufferSource);
  await writable.close();
}

export async function handleName(handle: Handle): Promise<string> {
  return handle.name;
}
