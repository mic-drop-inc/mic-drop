# Mic Drop

*Drop in, score the round, drop the mic.*

A local-only, browser-based tool for judging NSDA Nationals speech events. Pick
your event, rate each competitor against that event's criteria, choose preset
comments, take notes, and save everything to a SQLite file **you** control.

No server, no network, no accounts. Your ballots live in a `.sqlite` file on your
own disk.

## Requirements

- **Chrome or Edge on desktop.** The app saves to your chosen file via the
  [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API),
  which Safari and Firefox do not support.
- [Bun](https://bun.sh) installed.

## Run it

```bash
bun install
bun run dev          # opens http://localhost:5173
```

`bun run dev` serves the app over `http://localhost:5173` — a secure context, which
the file API requires. (Opening the HTML by double-clicking a `file://` path will
**not** work.) Serving static files over localhost is not a backend; nothing is
processed or stored off your machine.

To run the built version instead:

```bash
bun run build
bun run preview
```

## Using it during a round

1. **Create new file…** the first time (e.g. `nationals-2026.sqlite`), or **Open
   existing file…** to continue. One file per tournament works well.
2. Pick your event from the left when you're assigned it.
3. For each competitor: enter their code, rate each criterion
   (Excellent / Good / Needs work), tap the preset comments you want to give them,
   add private notes, and set rank + points.
4. **Copy** assembles your selected comments + notes into ballot-ready text.
5. **New candidate** starts the next speaker. Everything autosaves to your file as
   you go (and a local backup guards against a crash mid-ballot).

After a page reload the browser asks once to re-confirm access to your file — click
**Resume**, then allow.

## How it's built

- **No backend.** React + Vite static SPA. SQLite runs in the browser via
  [sql.js](https://sql.js.org) (WebAssembly); the whole DB is serialized and written
  back to your file on each save.
- **The judge guides are the source of truth.** The event criteria and sample
  comments are parsed from the markdown guides one folder up by
  `scripts/build-data.ts` into `src/data/events.ts`. To change wording, edit the
  guide and re-run `bun run build:data`.

```bash
bun run build:data   # regenerate src/data/events.ts from the guide .md files
bun test             # ballot save/load roundtrip tests
```

See `implementation-notes.md` (repo root) for design decisions.

## License

[MIT](LICENSE) — see the [repo root](README.md) for the whole project.
