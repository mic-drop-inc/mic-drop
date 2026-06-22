// Typed RPC contract between the Bun main process (real filesystem I/O) and the
// webview (sql.js in memory). Bytes cross the boundary as base64 strings so the
// JSON transport stays clean. Imported type-only by the webview side, so it
// pulls no Bun runtime into the browser bundle.
// Pull RPCSchema from the browser entry (not 'electrobun/bun'): both re-export
// the same type, but the bun entry's module graph drags in node/three and would
// make the app's `tsc` typecheck the whole native API.
import type { RPCSchema } from 'electrobun/view';

export type FileRPC = {
  bun: RPCSchema<{
    requests: {
      // Liveness probe — the first thing to confirm the bridge actually reaches
      // the (Vite-built) webview. If this resolves, real file I/O will too.
      ping: { params: { msg: string }; response: string };
      // Open a native picker for an existing .sqlite; return its path (read via readFile).
      openExisting: { params: { startingFolder?: string }; response: { path: string } | null };
      // Pick a folder + create a fresh (empty) .sqlite there with the given name.
      createNew: { params: { name: string; startingFolder?: string }; response: { path: string } | null };
      readFile: { params: { path: string }; response: string };          // -> base64
      writeFile: { params: { path: string; bytesB64: string }; response: boolean };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: Record<string, never>;
  }>;
};
