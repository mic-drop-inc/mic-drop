// Fallback persistence for browsers without the File System Access API
// (Safari/Firefox/mobile). The sql.js DB lives in memory; we mirror its bytes to
// IndexedDB on every autosave so a reload doesn't lose data, and the user
// Downloads/Uploads the actual .sqlite file to move it on/off disk.
//
// Separate IndexedDB database from fileStore's (which stores file handles) to
// avoid version-coordination between the two stores.
const DB_NAME = 'nsda-manual';
const STORE = 'db';
const KEY = 'current';

export interface LocalDbRecord { name: string; bytes: Uint8Array }

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocal(name: string, bytes: Uint8Array): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ name, bytes } as LocalDbRecord, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadLocal(): Promise<LocalDbRecord | undefined> {
  const db = await idb();
  const out = await new Promise<LocalDbRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as LocalDbRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}

export async function clearLocal(): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
