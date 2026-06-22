// Desktop (Electrobun) half of disk persistence. Mirrors fileStore.ts's shape,
// but the "handle" is just the file's absolute path and all I/O goes to the Bun
// main process over RPC (the system webview has no File System Access API).
import { desktopRpc } from './desktop';

type Handle = string; // absolute path

const LAST_FOLDER = 'nsda-desktop-folder';
const dirOf = (path: string) => path.replace(/[\\/][^\\/]*$/, '') || path;
const lastFolder = (): string | undefined => localStorage.getItem(LAST_FOLDER) || undefined;
function rememberFolder(path: string) {
  try { localStorage.setItem(LAST_FOLDER, dirOf(path)); } catch { /* quota */ }
}

function aborted(): Error {
  // Setup treats AbortError as "user cancelled" and shows no error.
  const e = new Error('cancelled');
  e.name = 'AbortError';
  return e;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000; // chunk to avoid arg-count limits on fromCharCode
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function isSupported(): boolean { return true; }

export async function pickExistingFile(): Promise<Handle> {
  const { request } = await desktopRpc();
  const res = await request.openExisting({ startingFolder: lastFolder() });
  if (!res) throw aborted();
  rememberFolder(res.path);
  return res.path;
}

export async function pickNewFile(suggestedName = 'nsda-ballots.sqlite'): Promise<Handle> {
  const { request } = await desktopRpc();
  const res = await request.createNew({ name: suggestedName, startingFolder: lastFolder() });
  if (!res) throw aborted();
  rememberFolder(res.path);
  return res.path;
}

// Across-launch resume isn't wired yet on desktop (no persisted path); Setup
// just shows Open / Create. (Follow-up: persist last path in app data.)
export async function restoreHandle(): Promise<Handle | undefined> { return undefined; }
export async function forgetHandle(): Promise<void> { /* no-op */ }

export async function ensurePermission(_handle: Handle): Promise<boolean> { return true; }

export async function readBytes(handle: Handle): Promise<Uint8Array> {
  const { request } = await desktopRpc();
  return b64ToBytes(await request.readFile({ path: handle }));
}

export async function writeBytes(handle: Handle, bytes: Uint8Array): Promise<void> {
  const { request } = await desktopRpc();
  await request.writeFile({ path: handle, bytesB64: bytesToB64(bytes) });
}

export async function handleName(handle: Handle): Promise<string> {
  return handle.split(/[\\/]/).pop() || handle;
}
