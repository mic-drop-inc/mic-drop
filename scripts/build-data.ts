// Derives the app's structured event data from the markdown judge guides.
// Guides are the single source of truth; this regenerates src/data/events.ts.
// Fails loud (throws) if any guide deviates from the expected section schema,
// so format drift is caught at build time rather than silently dropping data.
//
// Run: bun run build:data
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EventDef, CriterionDef, CommentDef, CommentTone } from '../src/data/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = resolve(here, '../guides'); // scripts/ -> repo/guides/
const OUT = resolve(here, '../src/data/events.ts');
// Raw guides are copied here so the app can fetch + render them as the "View
// guide" reference. Editing a guide + re-running build:data refreshes these.
const GUIDES_PUBLIC = resolve(here, '../public/guides');
mkdirSync(GUIDES_PUBLIC, { recursive: true });

// Ordered registry of guides that become app events. The generic
// Extemporaneous_Speaking guide is intentionally excluded — it is superseded by
// the US/International split per the judge's request (kept on disk as reference).
const REGISTRY: { file: string; key: string }[] = [
  { file: 'Original_Oratory_Judge_Guide.md', key: 'original_oratory' },
  { file: 'Informative_Speaking_Judge_Guide.md', key: 'informative_speaking' },
  { file: 'Expository_Speaking_Judge_Guide.md', key: 'expository_speaking' },
  { file: 'Original_Spoken_Word_Poetry_Judge_Guide.md', key: 'original_spoken_word_poetry' },
  { file: 'Dramatic_Interpretation_Judge_Guide.md', key: 'dramatic_interpretation' },
  { file: 'Humorous_Interpretation_Judge_Guide.md', key: 'humorous_interpretation' },
  { file: 'Duo_Interpretation_Judge_Guide.md', key: 'duo_interpretation' },
  { file: 'Program_Oral_Interpretation_Judge_Guide.md', key: 'program_oral_interpretation' },
  { file: 'Poetry_Judge_Guide.md', key: 'poetry' },
  { file: 'Prose_Judge_Guide.md', key: 'prose' },
  { file: 'Storytelling_Judge_Guide.md', key: 'storytelling' },
  { file: 'Declamation_Judge_Guide.md', key: 'declamation' },
  { file: 'United_States_Extemporaneous_Speaking_Judge_Guide.md', key: 'united_states_extemp' },
  { file: 'International_Extemporaneous_Speaking_Judge_Guide.md', key: 'international_extemp' },
  { file: 'Impromptu_Judge_Guide.md', key: 'impromptu' },
];

const slug = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const stripQuotes = (s: string) => s.trim().replace(/^["“](.*)["”]$/s, '$1').trim();
const stripBold = (s: string) => s.replace(/\*\*/g, '').trim();

interface Section { title: string; lines: string[]; }

function sections(md: string): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      cur = { title: m[1].trim(), lines: [] };
      out.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return out;
}

function findSection(secs: Section[], needle: string): Section {
  const s = secs.find((x) => x.title.toLowerCase().includes(needle));
  if (!s) throw new Error(`missing "## ...${needle}..." section`);
  return s;
}

function parseCriteria(sec: Section, eventKey: string): CriterionDef[] {
  const crits: CriterionDef[] = [];
  let cur: CriterionDef | null = null;
  const usedKeys = new Set<string>();
  for (const line of sec.lines) {
    const head = line.match(/^###\s+\d+\.\s+(.*)$/);
    if (head) {
      const name = stripBold(head[1]);
      let key = slug(name);
      while (usedKeys.has(key)) key += '_x';
      usedKeys.add(key);
      cur = { key, name, whatToEvaluate: '', levels: { excellent: '', good: '', needs_work: '' } };
      crits.push(cur);
      continue;
    }
    if (!cur) continue;
    const wte = line.match(/^\*\*What to evaluate:\*\*\s*(.*)$/i);
    if (wte) { cur.whatToEvaluate = wte[1].trim(); continue; }
    const row = line.match(/^\|\s*\*\*(Excellent|Good|Needs Work)\*\*\s*\|\s*(.*?)\s*\|\s*$/i);
    if (row) {
      const lvl = row[1].toLowerCase() === 'excellent' ? 'excellent'
        : row[1].toLowerCase() === 'good' ? 'good' : 'needs_work';
      cur.levels[lvl] = row[2].trim();
    }
  }
  if (!crits.length) throw new Error(`${eventKey}: no criteria parsed`);
  for (const c of crits) {
    if (!c.whatToEvaluate) throw new Error(`${eventKey}/${c.key}: missing "What to evaluate"`);
    for (const lvl of ['excellent', 'good', 'needs_work'] as const) {
      if (!c.levels[lvl]) throw new Error(`${eventKey}/${c.key}: missing ${lvl} indicator row`);
    }
  }
  return crits;
}

// Each tone holds an ordered list of short comment FRAGMENTS (the guide lists
// them as `- ` bullets under each `**Strong/Average/Needs Work:**` label). An
// inline fragment on the label line itself is also accepted for back-compat.
interface CommentGroup { heading: string; strong: string[]; average: string[]; needs_work: string[]; }

function parseCommentGroups(sec: Section): CommentGroup[] {
  const groups: CommentGroup[] = [];
  let cur: CommentGroup | null = null;
  let tone: 'strong' | 'average' | 'needs_work' | null = null;
  for (const line of sec.lines) {
    const head = line.match(/^###\s+(.*)$/);
    if (head) {
      cur = { heading: stripBold(head[1]).trim(), strong: [], average: [], needs_work: [] };
      groups.push(cur);
      tone = null;
      continue;
    }
    if (!cur) continue;
    const label = line.match(/^\*\*(Strong|Average|Needs Work):\*\*\s*(.*)$/i);
    if (label) {
      tone = label[1].toLowerCase() === 'strong' ? 'strong'
        : label[1].toLowerCase() === 'average' ? 'average' : 'needs_work';
      const inline = label[2].trim();
      if (inline) cur[tone].push(stripQuotes(inline)); // legacy single-line form
      continue;
    }
    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet && tone) cur[tone].push(stripQuotes(bullet[1].trim()));
  }
  return groups;
}

function parseWatchFor(sec: Section): string[] {
  return sec.lines
    .filter((l) => /^-\s+/.test(l))
    .map((l) => stripBold(l.replace(/^-\s+/, '')).trim())
    .filter(Boolean);
}

function parseGuide(file: string, key: string): EventDef {
  const md = readFileSync(resolve(GUIDES_DIR, file), 'utf8');
  writeFileSync(resolve(GUIDES_PUBLIC, `${key}.md`), md); // raw copy for the in-app viewer
  const h1 = md.match(/^#\s+(.*)$/m);
  if (!h1) throw new Error(`${file}: no H1 title`);
  const name = h1[1].split('—')[0].split(' - ')[0].trim();
  const metaLine = md.match(/^>\s+(.*)$/m);
  const meta = metaLine ? stripBold(metaLine[1]).replace(/\s*\|\s*/g, ' · ').trim() : '';

  const secs = sections(md);
  const criteria = parseCriteria(findSection(secs, 'judging criteria'), key);
  const groups = parseCommentGroups(findSection(secs, 'sample judge comment'));
  const watchFor = parseWatchFor(findSection(secs, 'watch for'));

  if (groups.length !== criteria.length) {
    throw new Error(
      `${key}: ${criteria.length} criteria but ${groups.length} sample-comment groups — they must align 1:1`,
    );
  }

  // Comments are zipped to criteria BY POSITION. Guard against a reordered guide
  // silently misattributing every comment: the i-th comment-group heading must
  // share a meaningful word with the i-th criterion name (headings are
  // shortened, so we check token overlap, not equality). Zero overlap = reorder.
  const STOP = new Set(['and', 'the', 'of', 'a', 'to', 'vs', 'for', 'in', 'on', 'work', 'use']);
  const tokens = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)));
  criteria.forEach((c, i) => {
    const ct = tokens(c.name), gt = tokens(groups[i].heading);
    if (![...ct].some((t) => gt.has(t))) {
      throw new Error(
        `${key}: comment group ${i} "${groups[i].heading}" does not match criterion ${i} "${c.name}" ` +
        `(no shared word) — sample-comment groups must be in the same order as the criteria`,
      );
    }
  });

  const comments: CommentDef[] = [];
  criteria.forEach((c, i) => {
    const g = groups[i];
    (['strong', 'average', 'needs_work'] as CommentTone[]).forEach((tone) => {
      if (!g[tone].length) throw new Error(`${key}/${c.key}: missing ${tone} sample comment fragments`);
      g[tone].forEach((text, n) => {
        comments.push({ id: `${key}.${c.key}.${tone}.${n}`, criterionKey: c.key, tone, text });
      });
    });
  });

  return { key, name, meta, guideFile: file, criteria, comments, watchFor } as EventDef & { watchFor: string[] };
}

const events = REGISTRY.map((r) => parseGuide(r.file, r.key));

// Cross-event quick reference, also exposed in the app's guide viewer.
writeFileSync(
  resolve(GUIDES_PUBLIC, 'quick-reference.md'),
  readFileSync(resolve(GUIDES_DIR, '00_NSDA_Judge_Quick_Reference.md'), 'utf8'),
);

const banner = `// AUTO-GENERATED by scripts/build-data.ts from the judge guide .md files.
// DO NOT EDIT BY HAND. Edit the guides, then run: bun run build:data\n`;
const body = `import type { EventDef } from './types';\n\nexport const EVENTS: EventDef[] = ${JSON.stringify(events, null, 2)};\n\nexport const EVENTS_BY_KEY: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.key, e]));\n`;
writeFileSync(OUT, banner + body);

const totalComments = events.reduce((n, e) => n + e.comments.length, 0);
const totalCriteria = events.reduce((n, e) => n + e.criteria.length, 0);
console.log(`Wrote ${events.length} events, ${totalCriteria} criteria, ${totalComments} comments -> ${OUT}`);
console.log('Excluded from app (kept as reference): Extemporaneous_Speaking_Judge_Guide.md');
