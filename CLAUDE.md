# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two coupled deliverables for judging NSDA Nationals speech events:

1. **Judge prep guides** — one markdown file per event (`*_Judge_Guide.md`) plus
   `00_NSDA_Judge_Quick_Reference.md`. Each guide has a fixed section schema (see
   below). These are the human-readable reference **and** the data source for the app.
2. **`judge-app/`** — a local-only, browser-based React app for scoring competitors
   live during a round, saving ballots to a user-chosen SQLite file.

Source PDFs for the guides live one folder up (`../*.pdf`). The
`Hitesh-Ashar-Level-*.pdf` files (folder above that) are NSDA judge-training
certificates, not source material.

## The guide → app data contract (read before editing either)

The guides are the **single source of truth**. The app does not duplicate their
content — `judge-app/scripts/build-data.ts` parses every guide into
`judge-app/src/data/events.ts`. So:

- **To change criteria or sample comments, edit the guide `.md`, then run
  `cd judge-app && bun run build:data`.** Never hand-edit `src/data/events.ts` (it is
  generated and overwritten). `build:data` also copies each guide's raw markdown to
  `judge-app/public/guides/<key>.md`, which the in-app "View guide" drawer fetches and
  renders — so editing a guide + re-running `build:data` refreshes both.
- The parser **fails loud** if a guide deviates from the expected schema. Every guide
  must have, in order: an `# H1`, a `> ` blockquote meta line, `## Judging Criteria`
  with `### N. Name` subsections (each a `**What to evaluate:**` line + a 3-row table
  of `**Excellent**` / `**Good**` / `**Needs Work**`), `## Things to Watch For…`, and
  `## Sample Judge Comments` with one `### Name` group per criterion, each having
  `**Strong:**` / `**Average:**` / `**Needs Work:**`, and **under each of those a
  bullet list of short comment fragments** (`- fragment` lines; ≥1 per tone — an
  inline fragment on the label line is also tolerated for back-compat). Each fragment
  becomes one addable chip in the app's comment matrix (id
  `${event}.${criterion}.${tone}.${index}`). **Criteria count must equal
  sample-comment-group count** — they are zipped by position.
- The generic `Extemporaneous_Speaking_Judge_Guide.md` is intentionally **excluded**
  from the app (superseded by the US/International split); the app's event registry is
  the explicit `REGISTRY` list in `build-data.ts` (15 events).
- Event codes, category grouping, and judging-mindset prompts are **not** in the
  guides — they are hand-authored in `judge-app/src/data/eventMeta.ts` (sourced from
  the quick reference). Adding an event means updating both `REGISTRY` and `EVENT_META`.

## App architecture (judge-app/)

No backend by design. Key constraint: it must write to a real `.sqlite` file on disk
with **no server**.

- **Persistence is two halves.** `src/lib/db.ts` is sql.js (SQLite-in-WASM): the DB
  lives in memory and is serialized to bytes. `src/lib/fileStore.ts` is the File
  System Access API: it writes those bytes to the user's chosen file and stashes the
  file handle in IndexedDB so it survives reloads. `src/lib/store.ts` ties them
  together and owns autosave. This split is why sql.js was chosen over the official
  `@sqlite.org/sqlite-wasm` (which needs OPFS + COOP/COEP headers = a server).
- **The user's file holds only ballots.** All criteria/comments are bundled in the
  app; saved ballots reference bundled criterion keys + comment ids. Don't put guide
  content in the SQLite schema.
- **Adding a ballot column needs a migration.** `SCHEMA` uses `CREATE TABLE IF NOT
  EXISTS`, so existing files won't gain new columns. Add the column to `SCHEMA` *and*
  to `migrate()` in `db.ts` (an idempotent `ALTER TABLE … ADD COLUMN` guarded by a
  `PRAGMA table_info` check), then thread it through `Ballot`, `rowToBallot`,
  `saveBallot`, and `emptyBallot`. See the `time_seconds` column for the pattern.
- **Autosave + reload gotchas (don't regress these):**
  - Edits debounce-write the whole DB to disk (400ms) and mirror the live draft to
    `localStorage` as a crash backup. New ballots auto-insert once they have content.
  - After a page reload, file permission must be re-granted **inside a user gesture**
    (`ensurePermission()` on the Resume button) — the browser downgrades restored
    handles to "prompt".
- **UI** (`src/ui/`): `App.tsx` is the orchestrator (draft state, autosave wiring);
  `Sidebar.tsx` event picker + ballot list; `Ballot.tsx` the scoring form;
  `Setup.tsx` the file-open screen; `primitives.tsx` shared Plumb components.
- **Design system is token-driven.** `src/styles/colors_and_type.css` implements the
  "Plumb" spec in `DESIGN.md`. Style via the semantic tokens there — never hard-code
  hex in components.

## Commands

```bash
bun install
bun run dev          # http://localhost:5173 (Chrome/Edge only — needs File System Access API)
bun run build:data   # regenerate src/data/events.ts from the guide .md files
bun test             # ballot save/serialize/reopen roundtrip (test/db.test.ts)
bun test test/db.test.ts -t "roundtrip"   # single test by name
bun run build        # tsc typecheck + Vite production build
bun run preview      # serve the production build
```

The app **requires Chrome or Edge over `http://localhost`** (the File System Access
API needs a secure context and isn't in Safari/Firefox). `file://` will not work.

## Gotchas

- `bun run build:data` reads guides from `guides/`. Run it from the repo root.
- After editing a guide, the app won't reflect it until you re-run `build:data`.
- TypeScript is split: `tsconfig.json` checks `src/` (DOM/Vite); `tsconfig.node.json`
  covers `scripts/` + `test/` (Bun types). The `build` script only typechecks `src/`.
- File paths in this repo contain spaces — quote them in shell commands.

## Development workflow

For every non-trivial change (feature, fix, infrastructure update):

1. **Open a GitHub issue first** (`gh issue create --repo mic-drop-inc/mic-drop`) — document what's changing and why.
2. Work on a branch, commit changes.
3. **Open a PR** (`gh pr create`) and reference the issue in the body (`Closes #N`) so it auto-closes on merge.
