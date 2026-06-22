// Webview side of the Electrobun bridge. Present ONLY when the app runs inside
// the Electrobun window (the preload sets these globals); in a normal browser
// isDesktop() is false and none of this loads.
import type { FileRPC } from '../../electrobun/rpc';

export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.__electrobunWebviewId !== 'undefined' || typeof w.__electrobun !== 'undefined';
}

export interface DesktopRequests {
  ping: (p: { msg: string }) => Promise<string>;
  openExisting: (p: { startingFolder?: string }) => Promise<{ path: string } | null>;
  createNew: (p: { name: string; startingFolder?: string }) => Promise<{ path: string } | null>;
  readFile: (p: { path: string }) => Promise<string>;
  writeFile: (p: { path: string; bytesB64: string }) => Promise<boolean>;
}

let reqPromise: Promise<{ request: DesktopRequests }> | null = null;

// Construct Electroview once. Dynamic import keeps electrobun/view out of the
// normal browser bundle (only fetched when the bridge is actually present).
//
// IMPORTANT: rpc.request is a Proxy that turns ANY property access into an RPC
// call. Never resolve a promise directly to it — the promise machinery probes
// `.then`, which the proxy would dispatch as an RPC method ("no handler: then").
// So we wrap it in a plain { request } object.
export function desktopRpc(): Promise<{ request: DesktopRequests }> {
  if (!reqPromise) {
    reqPromise = import('electrobun/view').then(({ Electroview }) => {
      // The webview-side default request timeout is only 1s — far too short for
      // calls that block on a native dialog (openExisting/createNew). 5 minutes
      // covers human dialog interaction while still failing a truly stuck call.
      const rpc = Electroview.defineRPC<FileRPC>({
        maxRequestTime: 300000,
        handlers: { requests: {}, messages: {} },
      });
      const view = new Electroview({ rpc });
      return { request: (view.rpc!.request as unknown) as DesktopRequests };
    });
  }
  return reqPromise;
}
