import { useEffect, useRef, useState } from 'react';
import * as store from '../lib/store';
import type { Ballot } from '../lib/db';
import { EVENTS, EVENTS_BY_KEY } from '../data/events';
import { EVENT_META } from '../data/eventMeta';
import { Setup } from './Setup';
import { Sidebar } from './Sidebar';
import { Ballot as BallotForm } from './Ballot';
import { SummaryTable } from './SummaryTable';
import { GuideDrawer } from './GuideDrawer';
import { CommandBar, type Command } from './CommandBar';
import { competitorLabel, emptyBallot, hasContent, exportMarkdown } from './ballotModel';
import { isDesktop } from '../lib/desktop';

const QR: [string, string, string] = ['quick-reference.md', 'NSDA Nationals — Judge Quick Reference', 'Quick reference'];
type View = 'score' | 'summary';

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

export function App() {
  const [ready, setReady] = useState(store.isOpen());
  const [eventKey, setEventKey] = useState<string | null>(null);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [draft, setDraft] = useState<Ballot | null>(null);
  const [round, setRound] = useState('');
  const [room, setRoom] = useState('');
  const [saveStatus, setSaveStatus] = useState<store.SaveStatus>('idle');
  const [saveAt, setSaveAt] = useState<number | undefined>(undefined);
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem('nsda-nav') === 'collapsed');
  const [view, setView] = useState<View>('score');
  const [theme, setTheme] = useState<string>(() => document.documentElement.getAttribute('data-theme') ?? 'light');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [guideView, setGuideView] = useState<{ file: string; title: string; label: string } | null>(null);

  const idRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    store.onSaveStatus((s, at) => { setSaveStatus(s); if (at) setSaveAt(at); });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nsda-theme', theme);
  }, [theme]);

  function refreshList(key: string) { setBallots(store.list(key)); }

  useEffect(() => {
    if (!eventKey || !draft || !dirtyRef.current) return;
    if (!hasContent(draft)) return;
    store.saveDraft(eventKey, draft);
    const id = store.save({ ...draft, id: idRef.current ?? undefined });
    if (idRef.current !== id) { idRef.current = id; setDraft((d) => (d ? { ...d, id } : d)); }
    store.scheduleSave();
    refreshList(eventKey);
    dirtyRef.current = false;
  }, [draft, eventKey]);

  // A new/loaded draft inherits the file-level Round/Room.
  function startNew(key: string, seedRound: string, seedRoom: string) {
    const restored = store.loadDraft<Ballot>(key);
    const base = restored && hasContent(restored) && restored.id == null ? restored : emptyBallot(key);
    const useDraft = { ...base, round: seedRound, room: seedRoom };
    idRef.current = useDraft.id ?? null;
    dirtyRef.current = false;
    setDraft(useDraft);
  }

  function pickEvent(key: string) {
    setEventKey(key);
    refreshList(key);
    const seed = store.roundRoomSeed(key);
    setRound(seed.round); setRoom(seed.room);
    startNew(key, seed.round, seed.room);
    setView('score');
  }

  // One program per file: on open, jump straight to the event that has ballots,
  // and land on the Summary (the file already has candidates to compare). A
  // freshly created/empty file has no event yet, so the user picks one → Score.
  useEffect(() => {
    if (!ready || eventKey) return;
    const present = store.eventsPresent();
    if (present.length === 1) { pickEvent(present[0]); setView('summary'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function pickBallot(id: number) {
    const b = store.get(id);
    if (!b) return;
    idRef.current = id; dirtyRef.current = false; setDraft(b); setView('score');
  }

  function editBallot(id: number, patch: Partial<Ballot>) {
    const b = store.get(id);
    if (!b) return;
    const next = { ...b, ...patch, updatedAt: new Date().toISOString() };
    store.save(next);
    store.scheduleSave();
    if (eventKey) refreshList(eventKey);
    if (idRef.current === id) setDraft(next);
  }

  function update(patch: Partial<Ballot>) {
    dirtyRef.current = true;
    setDraft((prev) => (prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev));
  }

  function newCandidate() {
    if (!eventKey) return;
    store.clearDraft(eventKey);
    idRef.current = null; dirtyRef.current = false;
    setDraft({ ...emptyBallot(eventKey), round, room });
    setView('score');
  }

  // Add a candidate from the Summary board: persist immediately so it appears
  // everywhere candidates are listed. The single field holds a name or a code;
  // it's stored in competitorName (the code column is legacy, kept for compat).
  function addCandidate(label: string) {
    if (!eventKey) return;
    const text = label.trim();
    if (!text) return;
    store.save({ ...emptyBallot(eventKey), competitorName: text, round, room });
    store.scheduleSave();
    refreshList(eventKey);
  }

  // Apply the ranking board: rankedIds (in order) get rank 1..n; unrankedIds get
  // rank null. Speaking order is never touched here — it reflects when each
  // competitor spoke and is set elsewhere.
  function applyBoard(rankedIds: number[], _unrankedIds: number[]) {
    if (!eventKey) return;
    const rankMap = new Map(rankedIds.map((id, i) => [id, i + 1] as const));
    for (const b of store.list(eventKey)) {
      const rank = rankMap.get(b.id!) ?? null;
      if (b.rank !== rank) {
        store.save({ ...b, rank, updatedAt: new Date().toISOString() });
      }
    }
    store.scheduleSave();
    refreshList(eventKey);
    setDraft((d) => {
      if (!d || d.id == null) return d;
      const rank = rankMap.get(d.id) ?? null;
      return d.rank === rank ? d : { ...d, rank };
    });
  }

  // Round/Room are file-level: apply to every existing ballot + the live draft.
  function changeRoundRoom(r: string, m: string) {
    if (!eventKey) return;
    setRound(r); setRoom(m);
    store.setRoundRoomAll(eventKey, r, m);
    store.scheduleSave();
    if (eventKey) refreshList(eventKey);
    setDraft((d) => (d ? { ...d, round: r, room: m } : d));
  }

  async function deleteCurrent() {
    if (idRef.current != null) {
      store.remove(idRef.current);
      await store.persistNow();
      if (eventKey) refreshList(eventKey);
    }
    newCandidate();
  }

  async function changeEvent() {
    await store.persistNow();
    setEventKey(null); setDraft(null); setBallots([]);
    idRef.current = null; dirtyRef.current = false;
  }

  async function changeFile() {
    await store.persistNow();
    await store.closeFile();
    setReady(false);
    setEventKey(null); setBallots([]); setDraft(null);
    setRound(''); setRoom('');
    idRef.current = null; dirtyRef.current = false;
  }

  function toggleNav() {
    setNavCollapsed((c) => { const next = !c; localStorage.setItem('nsda-nav', next ? 'collapsed' : 'open'); return next; });
  }
  function openGuide(file: string, title: string, label: string) { setGuideView({ file, title, label }); }
  function openEventGuide() { if (eventKey) openGuide(`${eventKey}.md`, EVENTS_BY_KEY[eventKey].name, 'Event guide'); }

  // Quick-reference links use the original guide filenames; resolve to <key>.md.
  function openGuideByFileName(fileName: string) {
    let ev = EVENTS.find((e) => e.guideFile === fileName);
    if (!ev && fileName.includes('Extemporaneous')) ev = EVENTS_BY_KEY['united_states_extemp'];
    if (ev) openGuide(`${ev.key}.md`, ev.name, 'Event guide');
  }

  // Export everything in the file as one markdown document: download + copy.
  function exportAll() {
    if (!eventKey) return;
    const md = exportMarkdown(EVENTS_BY_KEY[eventKey], ballots, round, room);
    const safeRound = round ? `-${round.replace(/\s+/g, '')}` : '';
    const name = `${EVENT_META[eventKey].code}${safeRound}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    navigator.clipboard?.writeText(md).catch(() => { /* clipboard blocked; download still saved */ });
  }

  // --- Browser history: back/forward move between event / view / candidate. ---
  const navRef = useRef({ eventKey, view, draftId: draft?.id ?? null });
  navRef.current = { eventKey, view, draftId: draft?.id ?? null };
  const skipPush = useRef(false);
  const lastNav = useRef<string | null>(null); // last hash we wrote, to decide push vs replace
  useEffect(() => {
    // Desktop (Electrobun) has no browser back/forward chrome, and pushing a
    // hashed views:// URL makes the native scheme handler log "empty response".
    // So URL-hash history is browser-only.
    if (!ready || !eventKey || isDesktop()) return;
    if (skipPush.current) { skipPush.current = false; lastNav.current = window.location.hash; return; }
    const id = draft?.id ?? null;
    const hash = `#/${eventKey}/${view}${id != null ? `/${id}` : ''}`;
    if (window.location.hash === hash) { lastNav.current = hash; return; }
    // A brand-new candidate first appears with no id, then gets one on its first
    // save. That id-appended-to-the-same-view step should COLLAPSE into the same
    // history entry (replace), not add a second — so back doesn't land on the
    // same candidate twice. Anything else (switching candidates, view, event)
    // is a real navigation: push.
    const base = `#/${eventKey}/${view}`;
    if (lastNav.current === base && id != null) window.history.replaceState(null, '', hash);
    else window.history.pushState(null, '', hash);
    lastNav.current = hash;
  }, [ready, eventKey, view, draft?.id]);
  useEffect(() => {
    if (isDesktop()) return; // browser-only history (see note above)
    function onPop() {
      const m = window.location.hash.match(/^#\/([^/]+)\/(score|summary)(?:\/(\d+))?$/);
      skipPush.current = true;
      if (!m) return;
      const [, ek, v, idStr] = m;
      if (EVENTS_BY_KEY[ek] && ek !== navRef.current.eventKey) pickEvent(ek);
      setView(v as View);
      if (idStr) { const id = Number(idStr); if (id !== navRef.current.draftId) pickBallot(id); }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global keyboard shortcuts. Reads latest state via a ref to avoid stale closures.
  const envRef = useRef<Record<string, unknown>>({});
  envRef.current = { cmdOpen, eventKey, toggleNav, newCandidate };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const env = envRef.current as { cmdOpen: boolean; eventKey: string | null; toggleNav: () => void; newCandidate: () => void };
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') { e.preventDefault(); setCmdOpen((o) => !o); return; }
      if (env.cmdOpen || isTyping()) return;
      if (k === 'b') { e.preventDefault(); env.toggleNav(); }
      else if (k === 'n' && env.eventKey) { e.preventDefault(); env.newCandidate(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return <Setup onReady={() => setReady(true)} theme={theme}
    onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />;

  const event = eventKey ? EVENTS_BY_KEY[eventKey] : null;
  // While on the picker, restrict to events already in the file if it has several.
  const present = !event ? store.eventsPresent() : [];
  const restrictKeys = present.length > 1 ? present : undefined;

  // Command palette entries, rebuilt each render from current state.
  const commands: Command[] = [];
  if (event) {
    commands.push({ id: 'v-score', group: 'Navigate', label: 'Go to Score', run: () => setView('score') });
    commands.push({ id: 'v-summary', group: 'Navigate', label: 'Go to Summary', run: () => setView('summary') });
    commands.push({ id: 'new', group: 'Candidate', label: 'New candidate', hint: 'n', run: newCandidate });
    ballots.forEach((b) => commands.push({
      id: `b-${b.id}`, group: 'Open candidate', label: competitorLabel(b),
      keywords: `${b.competitorCode} ${b.round}`, run: () => pickBallot(b.id!),
    }));
    commands.push({ id: 'guide', group: 'Reference', label: 'Open event guide', run: openEventGuide });
    commands.push({ id: 'export', group: 'File', label: 'Export / backup (markdown)', run: exportAll });
  }
  commands.push({ id: 'qr', group: 'Reference', label: 'Quick reference', run: () => openGuide(...QR) });
  EVENTS.forEach((e) => commands.push({
    id: `e-${e.key}`, group: 'Switch event', label: e.name,
    keywords: EVENT_META[e.key].code, hint: EVENT_META[e.key].code, run: () => pickEvent(e.key),
  }));
  commands.push({ id: 'theme', group: 'View', label: 'Toggle light / dark', run: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) });
  commands.push({ id: 'nav', group: 'View', label: navCollapsed ? 'Expand sidebar' : 'Collapse sidebar', hint: 'b', run: toggleNav });
  if (event) commands.push({ id: 'chg-event', group: 'View', label: 'Change event', run: changeEvent });
  commands.push({ id: 'chg-file', group: 'View', label: 'Change file', run: changeFile });

  return (
    <div className={`app ${navCollapsed ? 'nav-collapsed' : ''}`}>
      <Sidebar
        currentEventKey={eventKey}
        onPickEvent={pickEvent}
        onChangeEvent={changeEvent}
        ballots={ballots}
        currentBallotId={draft?.id ?? null}
        onPickBallot={pickBallot}
        onNewCandidate={newCandidate}
        fileName={store.fileName()}
        onChangeFile={changeFile}
        saveStatus={saveStatus}
        saveAt={saveAt}
        onToggleNav={toggleNav}
        collapsed={navCollapsed}
        onOpenGuide={openGuide}
        onOpenCommand={() => setCmdOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        view={view}
        onShowScore={() => setView('score')}
        onShowSummary={() => setView('summary')}
        onOpenEventGuide={openEventGuide}
        onExport={exportAll}
        round={round}
        room={room}
        onChangeRoundRoom={changeRoundRoom}
        restrictKeys={restrictKeys}
        isManual={store.isManual()}
        onDownloadDb={() => store.downloadDb()}
      />
      <main className="main">
        {event ? (
          view === 'summary'
            ? <SummaryTable event={event} ballots={ballots} onOpen={pickBallot} onEdit={editBallot}
                onAddCandidate={addCandidate} onApply={applyBoard} />
            : draft && <BallotForm event={event} ballot={draft} onChange={update}
                onDelete={deleteCurrent} />
        ) : (
          <EmptyState onCommand={() => setCmdOpen(true)} multi={!!restrictKeys} />
        )}
      </main>

      <CommandBar open={cmdOpen} commands={commands} onClose={() => setCmdOpen(false)} />
      {guideView && (
        <GuideDrawer file={guideView.file} title={guideView.title} label={guideView.label}
          open onClose={() => setGuideView(null)} onNavigate={openGuideByFileName} />
      )}
    </div>
  );
}

function EmptyState({ onCommand, multi }: { onCommand: () => void; multi: boolean }) {
  return (
    <div className="empty-state">
      <svg className="empty-art" viewBox="0 0 120 120" fill="none" aria-hidden>
        <circle cx="60" cy="54" r="40" fill="var(--brand-subtle)" />
        <path d="M48 70a14 14 0 0 0 24 0" stroke="var(--brand-strong)" strokeWidth="3" strokeLinecap="round" />
        <rect x="52" y="30" width="16" height="30" rx="8" fill="var(--brand)" />
        <path d="M60 70v12M52 82h16" stroke="var(--brand-strong)" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 48c-3 4-3 8 0 12M90 48c3 4 3 8 0 12M22 42c-5 7-5 15 0 24M98 42c5 7 5 15 0 24"
          stroke="var(--azure)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      </svg>
      <span className="overline">Ready to judge</span>
      <h1>Pick your event</h1>
      <p>{multi
        ? 'This file already holds more than one event. Pick which one to work in from the left.'
        : 'Choose your assigned event from the left — or press ⌘K to jump straight to it. One file holds one event.'}</p>
      <button className="btn" onClick={onCommand}>Open command bar</button>
    </div>
  );
}
