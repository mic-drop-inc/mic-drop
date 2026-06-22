# Electrobun packaging — implementation notes

Goal: run Mic Drop as a native desktop window (no browser), keeping the existing
Vite/React app and the `.sqlite` file format unchanged.

## Why a refactor was needed (not just a wrapper)

Electrobun uses the **system webview** — WKWebView on macOS, WebKit2GTK on Linux
(WebView2/Chromium on Windows). The browser build's persistence relies on the
**File System Access API** (`showSaveFilePicker`, writable streams, IndexedDB
handle) which is **Chromium-only** → absent in WKWebView. So file I/O had to move
to the **Bun main process** and cross to the webview over Electrobun's typed RPC.

## What was built (all additive — browser path is unchanged & default)

- `electrobun.config.ts` — bundles `electrobun/index.ts`; copies the Vite `dist/`
  into `views/mainview`; native renderer (WKWebView).
- `electrobun/index.ts` — opens the window at `views://mainview/index.html`;
  exposes RPC handlers: `ping`, `openExisting` (native open dialog),
  `createNew` (folder dialog + filename → empty file), `readFile`, `writeFile`.
  Bytes cross as base64.
- `electrobun/rpc.ts` — shared typed RPC contract. (Imports `RPCSchema` from
  `electrobun/view`, NOT `electrobun/bun` — the bun entry drags in `three`/node
  and would make the app's `tsc` typecheck the whole native API.)
- `src/lib/desktop.ts` — `isDesktop()` (detects the preload globals) + lazy
  `Electroview` init (dynamic import → code-split, never in the browser chunk).
- `src/lib/fileStore.rpc.ts` — fileStore over RPC; the "handle" is the file path.
- `src/lib/fileStore.index.ts` — picks rpc vs browser at runtime; opaque `Handle`.
- `store.ts` now imports `fileStore.index`; `handle.name` → `fs.handleName()`.

`db.ts` / sql.js / the `.sqlite` schema are untouched → existing files still open.
`bun run build` + `bun test` (6) stay green.

## OPEN QUESTION — verify on the Mac first (gates the architecture)

Electrobun's intended model bundles each webview from a TS `entrypoint`; we instead
load a **copied Vite bundle**. The RPC bridge needs the preload (`window.__electrobun`,
`ws://localhost:<port>`) injected into THAT webview. Unverified whether the preload
reaches a copied (non-`build.views`) bundle. The `ping` handler is the probe.

If `ping` fails: declare the view in `build.views` and/or load the app through an
Electrobun-bundled entrypoint instead of `build.copy`.

## Mac test checklist (run these, report back)

```
bun install            # electrobun already in devDependencies
bun run desktop:dev    # = bun run build && bunx electrobun dev
```
1. Window opens, app renders (Setup screen).             [ ]
2. sql.js wasm loads (no "magic word" error in console). [ ]  ← known risk over views://
3. In console: bridge present? `window.__electrobunWebviewId`.
4. Create new file → folder dialog → app reaches Score.  [ ]  ← proves RPC write
5. Add a candidate, reload/relaunch, Open that file.     [ ]  ← proves RPC read
6. Open a file made by the **browser** version.          [ ]  ← format compat

## Known follow-ups (deferred)

- Across-launch "Resume" is off on desktop (`restoreHandle` returns undefined) —
  persist last path in app data once the bridge is confirmed.
- New-file naming uses a default + auto-dedup (no native Save dialog exists in
  Electrobun). Better: a filename input in Setup when `isDesktop()`.
- Fallback if WKWebView proves too limiting: `renderer: 'cef'` + `bundleCEF`
  bundles Chromium (File System Access API works as-is) at a larger binary.
```
