# Implementation notes — NSDA judging prep

Running log of decisions made building (a) the per-event judge guides and (b) the
local judging app, including choices not specified up front.

## Scope decisions (confirmed with the judge)

- **All 16 event PDFs covered**, with Extemp split into **US Extemp** and
  **International Extemp** as separate app events. The generic
  `Extemporaneous_Speaking_Judge_Guide.md` is kept on disk as a shared reference
  but **excluded from the app** (it is superseded by the US/Int split) — yields 15
  distinct competitive events in the app.
- **Storage:** SQLite WASM (sql.js) + the File System Access API. Chosen over the
  official `@sqlite.org/sqlite-wasm` because the official build persists to OPFS and
  requires COOP/COEP headers + `SharedArrayBuffer` — i.e. a configured server, which
  contradicts the "no server" requirement. sql.js is pure in-memory: load bytes →
  operate → serialize → write bytes back to the user's chosen file. (Advisor flag.)
- **Rating model:** per-criterion Excellent / Good / Needs work, plus overall room
  Rank and rating Points — mirrors a real ballot.

## Guides

- 8 guides pre-existed; 8 were drafted from the source PDFs (parent folder) by
  parallel subagents, each handed the Declamation guide as the exact format
  template and told to extract rules from the PDF rather than invent them.
- The International Extemp subagent died once on a socket error and was re-run.
- **The parser is the source of truth bridge.** `judge-app/scripts/build-data.ts`
  parses every guide's "Judging Criteria", "Sample Judge Comments", and "Things to
  Watch For" sections into structured data, and **fails loud** on any format drift.
  This caught three real defects, since fixed:
  - Informative: missing "Physical Delivery" sample-comment group + a missing
    "Average" in the Informative-vs-Persuasive group.
  - Humorous: missing "Vocal Performance" sample-comment group.
  - Expository: a rating-table label written `**Needs Work:**` (stray colon).
- Decision: keep the prose guides as the human-readable reference; the app data is
  **derived** from them by the parser, never hand-edited. Edit guide → re-run
  `bun run build:data`.

## App architecture

- **No backend.** React + Vite static SPA. `base: './'` so a build works from any
  localhost path. Dev/preview both serve over `http://localhost` (secure context
  required by the file API; `file://` will not work).
- **Bundled vs saved data (advisor):** the app bundles all criteria + comments
  (`src/data/events.ts`); the user's `.sqlite` stores **only ballots** — ratings
  reference bundled criterion keys, selected comments reference bundled comment ids.
  Keeps the file tiny/portable and lets guide content change without migrating saved
  ballots.
- **Ballot schema:** a single `ballots` table; `ratings` and selected `comments`
  are JSON columns (small scale, simpler than extra tables, survives JSON
  roundtrip — covered by `test/db.test.ts`).
- **Live-use safety (advisor):** autosave writes the whole DB back to the file on a
  400ms debounce after each edit, and the in-progress draft is mirrored
  synchronously to `localStorage` so a crash/navigation before the first disk write
  never loses the active ballot. A new ballot is auto-inserted as soon as it has any
  content, so edits flow to disk immediately rather than only on a Save click.
- **Reload re-permission (advisor):** the file handle is stored in IndexedDB; after
  a reload the browser downgrades it to "prompt", so `ensurePermission()` runs
  inside the user gesture on the **Resume** button.

## Design system

- The UI follows the user-provided `DESIGN.md` ("Plumb"): warm Sand neutrals (no
  pure grays), one amber accent (near-black text on amber, never white), one azure
  cool note, status as colored dots, cards = surface + 1px border + radius, no
  header bar (sidebar is the only chrome), calm 180ms motion, system fonts, sentence
  case. Implemented as semantic tokens in
  `src/styles/colors_and_type.css` (the "one-edit" file); components reference tokens
  only. `DESIGN.md` referenced a `colors_and_type.css` that did not ship, so it was
  authored to spec.

## Quick reference integration

- `00_NSDA_Judge_Quick_Reference.md` (author: the user) supplies event **codes**
  (OO, DI, USX…), category grouping (Public Address / Interpretation / Limited Prep
  / Spoken Word), and a per-category "ask yourself" judging-mindset prompt. These
  live in the hand-authored `src/data/eventMeta.ts` and drive the grouped event
  picker, code badges, and the mindset line on each ballot.

## Verified

- `bun test` — ballot save → serialize → reopen → read-back roundtrip (the sql.js
  half of disk persistence). Green.
- `bun run build` — `tsc` typecheck + Vite production build. Clean.
- Dev server serves index, `sql-wasm.wasm` (`application/wasm`), and transformed
  modules.

## Rules verification (vs the source PDFs)

Cross-checked every guide's rule-critical facts (time/grace, prep, memorized vs
manuscript, props, genre, quote limits, eligibility) against the NSDA source PDFs
via 4 read-only agents. The PDFs are the "Introduction to…" coaching guides — they
state some facts and are silent on others (notably eligibility level and grace for
several events).

**PDF-contradicted → fixed:**
- **DI:** added the 30-second grace period the PDF grants (guide had said "over 10
  minutes is penalized"); removed "No physical contact with other competitors" (DI
  is a solo event — a copy-paste from Duo).
- **Informative:** added "delivered from memory" (PDF states it; guide omitted it).
- **Quick reference:** Storytelling "MS only" → "MS & HS" (PDF confirms both levels;
  the Storytelling guide was already correct — the quick ref was the wrong one).

**Verified correct:** all time limits; manuscript-required (POE/PRO/POI) vs
memorized (DI/HI/DUO/STO/OSWP/OO/INFO); props rules; POI 2-of-3 genres; genre
exclusivity (POE/PRO); 150-word quote limits (OO/INFO); Extemp 30-min prep / 7-min /
draw-3-pick-1 / internet-allowed-at-Nationals; Impromptu 7-min combined, freely
split, no notes.

**Could NOT confirm from these PDFs (verify against the official NSDA Unified
Manual):** eligibility labels — especially **Expository "Middle School"** (the EXP
PDF states no level; don't infer MS from Declamation) — and the HS/MS labels on OO,
INFO, Extemp, DI, HI, DUO, POI, IMP; OO's 30-sec grace + no-props (not in PDF, added
in guide, consistent with standard rules); Declamation's "ethnicity-specific
delivery" phrasing and 9:30/10:00 signal times; Impromptu's "1–2 min prep" figure
(split is actually free) and its omission of the unannotated-published-materials
prep rule.

## NOT yet verified (needs a human in Chrome)

The File System Access flow (native file picker, write-to-disk, reload + re-grant)
cannot be exercised headlessly. Manual check needed: create file → rate a
competitor → confirm the `.sqlite` file appears and grows → reload → Resume → data
is still there. (User confirmed this works as of first retest.)
