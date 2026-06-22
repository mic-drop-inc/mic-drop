// sql.js loader. SQLite compiled to WebAssembly, runs fully in the browser —
// no server, no COOP/COEP headers, no SharedArrayBuffer. The whole DB lives in
// memory; we serialize it to bytes and write those bytes back to the user's
// chosen .sqlite file on disk (see fileStore.ts).
import initSqlJs, { type SqlJsStatic } from 'sql.js';
// Let Vite fingerprint + emit the wasm and hand us its real URL. This resolves
// correctly in dev and in the built bundle regardless of base path — unlike a
// hardcoded "/sql-wasm.wasm", which can hit the SPA fallback and return
// index.html (CompileError: expected magic word 00 61 73 6d).
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlPromise: Promise<SqlJsStatic> | null = null;

// Browser-only. Bun tests pass an explicit wasmBinary (see test/db.test.ts).
//
// We fetch the wasm bytes ourselves and pass them as `wasmBinary` rather than
// letting emscripten stream from a URL. Streaming requires the server to send
// `Content-Type: application/wasm`; the Electrobun `views://` protocol does not,
// so WebAssembly.instantiateStreaming fails ("Unexpected response MIME type").
// Fetching to an ArrayBuffer is MIME-agnostic and works in both the browser dev
// server and the desktop webview.
export function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    // NB: don't gate on response.ok — the Electrobun `views://` scheme returns
    // status 0 (not 200) even on success, which is fine; the body is still
    // readable. We only fail if the bytes come back empty.
    sqlPromise = fetch(wasmUrl)
      .then((r) => r.arrayBuffer())
      .then((wasmBinary) => {
        if (!wasmBinary || wasmBinary.byteLength === 0) {
          throw new Error(`sql.js wasm fetched empty from ${wasmUrl}`);
        }
        return initSqlJs({ wasmBinary });
      });
  }
  return sqlPromise;
}
