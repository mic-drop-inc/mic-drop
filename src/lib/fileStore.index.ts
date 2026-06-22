// Picks the persistence backend at runtime: the Electrobun native bridge when
// running inside the desktop window, otherwise the browser File System Access
// API. The Handle is opaque to callers (a FileSystemFileHandle in the browser,
// an absolute path string on desktop) — store.ts never inspects it directly.
import { isDesktop } from './desktop';
import * as browser from './fileStore';
import * as rpc from './fileStore.rpc';

export type Handle = unknown;

const desktop = isDesktop();

export const isSupported = (): boolean =>
  desktop ? rpc.isSupported() : browser.isFileSystemAccessSupported();

export const pickExistingFile = (): Promise<Handle> =>
  desktop ? rpc.pickExistingFile() : browser.pickExistingFile();

export const pickNewFile = (name?: string): Promise<Handle> =>
  desktop ? rpc.pickNewFile(name) : browser.pickNewFile(name);

export const restoreHandle = (): Promise<Handle | undefined> =>
  desktop ? rpc.restoreHandle() : browser.restoreHandle();

export const forgetHandle = (): Promise<void> =>
  desktop ? rpc.forgetHandle() : browser.forgetHandle();

export const ensurePermission = (h: Handle): Promise<boolean> =>
  desktop ? rpc.ensurePermission(h as string) : browser.ensurePermission(h as FileSystemFileHandle);

export const readBytes = (h: Handle): Promise<Uint8Array> =>
  desktop ? rpc.readBytes(h as string) : browser.readBytes(h as FileSystemFileHandle);

export const writeBytes = (h: Handle, b: Uint8Array): Promise<void> =>
  desktop ? rpc.writeBytes(h as string, b) : browser.writeBytes(h as FileSystemFileHandle, b);

export const handleName = (h: Handle): Promise<string> =>
  desktop ? rpc.handleName(h as string) : browser.handleName(h as FileSystemFileHandle);
