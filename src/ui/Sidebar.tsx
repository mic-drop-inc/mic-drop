import { type MouseEvent } from 'react';
import { EVENTS, EVENTS_BY_KEY } from '../data/events';
import { EVENT_META, CATEGORY_LABEL, CATEGORY_ORDER, type Category } from '../data/eventMeta';
import type { Ballot } from '../lib/db';
import type { SaveStatus } from '../lib/store';
import { competitorLabel, inSpeakingOrder, initialsFor } from './ballotModel';
import { SaveIndicator, ThemeToggle, Avatar } from './primitives';
import { RunningTimer } from './RunningTimer';
import {
  IconChevronsLeft, IconPlus, IconArrowUpRight, IconSearch, IconMic,
  IconGrid, IconClipboard, IconBook, IconDownload,
} from './icons';

const QR = ['quick-reference.md', 'NSDA Nationals — Judge Quick Reference', 'Quick reference'] as const;

const eventsByCategory: Record<Category, typeof EVENTS> = CATEGORY_ORDER.reduce((acc, cat) => {
  acc[cat] = EVENTS.filter((e) => EVENT_META[e.key].category === cat);
  return acc;
}, {} as Record<Category, typeof EVENTS>);

type View = 'score' | 'summary';

export function Sidebar({
  currentEventKey, onPickEvent, onChangeEvent, ballots, currentBallotId, onPickBallot,
  onNewCandidate, fileName, onChangeFile, saveStatus, saveAt, onToggleNav, collapsed,
  onOpenGuide, onOpenCommand, theme, onToggleTheme,
  view, onShowScore, onShowSummary, onOpenEventGuide, onExport,
  round, room, onChangeRoundRoom, restrictKeys, isManual, onDownloadDb,
}: {
  currentEventKey: string | null;
  onPickEvent: (key: string) => void;
  onChangeEvent: () => void;
  ballots: Ballot[];
  currentBallotId: number | null;
  onPickBallot: (id: number) => void;
  onNewCandidate: () => void;
  fileName: string;
  onChangeFile: () => void;
  saveStatus: SaveStatus;
  saveAt?: number;
  onToggleNav: () => void;
  collapsed: boolean;
  onOpenGuide: (file: string, title: string, label: string) => void;
  onOpenCommand: () => void;
  theme: string;
  onToggleTheme: () => void;
  view: View;
  onShowScore: () => void;
  onShowSummary: () => void;
  onOpenEventGuide: () => void;
  onExport: () => void;
  round: string;
  room: string;
  onChangeRoundRoom: (round: string, room: string) => void;
  restrictKeys?: string[];
  isManual: boolean;
  onDownloadDb: () => void;
}) {
  const event = currentEventKey ? EVENTS_BY_KEY[currentEventKey] : null;
  const ordered = inSpeakingOrder(ballots);

  // Collapsed: a slim icon rail. The whole rail is a click target to expand;
  // interactive clusters stop propagation so their own actions still fire.
  if (collapsed) {
    const stop = (e: MouseEvent) => e.stopPropagation();
    return (
      <aside className="sidebar sidebar-rail" onClick={onToggleNav} title="Click to expand" role="button" aria-label="Expand sidebar">
        <div className="rail-brand"><IconMic size={22} /></div>
        <div className="rail-actions" onClick={stop}>
          <button className="icon-btn" onClick={onOpenCommand} title="Command bar (⌘K)" aria-label="Command bar"><IconSearch /></button>
          {event && <button className={`icon-btn ${view === 'score' ? 'is-active' : ''}`} onClick={onShowScore} title="Score" aria-label="Score"><IconClipboard /></button>}
          {event && <button className={`icon-btn ${view === 'summary' ? 'is-active' : ''}`} onClick={onShowSummary} title="Summary" aria-label="Summary"><IconGrid /></button>}
          {event && <button className="icon-btn" onClick={onOpenEventGuide} title="View guide" aria-label="View guide"><IconBook /></button>}
          {event && <button className="icon-btn" onClick={onExport} title="Export / backup" aria-label="Export"><IconDownload /></button>}
          {event && <button className="icon-btn" onClick={onNewCandidate} title="New candidate" aria-label="New candidate"><IconPlus /></button>}
        </div>
        {event && <span className="rail-code mono" title={event.name}>{EVENT_META[event.key].code}</span>}
        {event && (
          <div className="rail-running" onClick={stop}>
            <RunningTimer ballots={ballots} onOpen={onPickBallot}
              limitSec={EVENT_META[event.key].timeLimitSec} graceSec={EVENT_META[event.key].graceSec} variant="rail" />
          </div>
        )}
        {event && ordered.length > 0 && (
          <div className="rail-cands" onClick={stop}>
            {ordered.map((b, i) => (
              <button key={b.id} className={`rail-cand ${currentBallotId === b.id && view === 'score' ? 'is-active' : ''}`}
                title={`${b.speakingOrder ?? i + 1}. ${competitorLabel(b)}`} onClick={() => onPickBallot(b.id!)}>
                {initialsFor(competitorLabel(b))}
              </button>
            ))}
          </div>
        )}
        <div className="rail-spacer" />
        <div className="rail-theme" onClick={stop}><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="wordmark wordmark-btn" onClick={onToggleNav} title="Collapse sidebar">Mic Drop</button>
        <div className="sidebar-top-actions">
          <button className="icon-btn" onClick={onOpenCommand} title="Command bar (⌘K)" aria-label="Command bar"><IconSearch /></button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="icon-btn" onClick={onToggleNav} title="Collapse sidebar" aria-label="Collapse sidebar"><IconChevronsLeft /></button>
        </div>
      </div>

      <div className="sidebar-file">
        <span className="dot dot-good" aria-hidden />
        <span className="file-name mono" title={fileName}>{fileName}</span>
        <button className="link-btn" onClick={onChangeFile}>change</button>
      </div>
      <div className="sidebar-save"><SaveIndicator status={saveStatus} at={saveAt} /></div>

      <div className="sidebar-scroll">
        {!event && (
          <>
            {restrictKeys && restrictKeys.length > 1 && (
              <p className="sidebar-hint">This file already has more than one event. Pick the one to work in.</p>
            )}
            <nav className="event-nav">
              {CATEGORY_ORDER.map((cat) => {
                const list = eventsByCategory[cat].filter((e) => !restrictKeys || restrictKeys.includes(e.key));
                if (!list.length) return null;
                return (
                  <div key={cat} className="event-group">
                    <div className="overline event-group-label">{CATEGORY_LABEL[cat]}</div>
                    {list.map((e) => (
                      <button key={e.key} className="event-item" onClick={() => onPickEvent(e.key)}>
                        <span className="event-code mono">{EVENT_META[e.key].code}</span>
                        <span className="event-name">{e.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
            {!restrictKeys && (
              <button className="link-btn sidebar-qr" onClick={() => onOpenGuide(...QR)}>
                Quick reference <IconArrowUpRight />
              </button>
            )}
          </>
        )}

        {event && (
          <>
            <div className="event-chip">
              <span className="event-chip-code mono">{EVENT_META[event.key].code}</span>
              <span className="event-chip-name">{event.name}</span>
              <button className="link-btn" onClick={onChangeEvent}>change</button>
            </div>

            <RunningTimer ballots={ballots} onOpen={onPickBallot}
              limitSec={EVENT_META[event.key].timeLimitSec} graceSec={EVENT_META[event.key].graceSec} variant="bar" />

            {/* Main navigation for this event */}
            <nav className="main-nav">
              <button className={`main-nav-item ${view === 'score' ? 'is-active' : ''}`} onClick={onShowScore}>
                <IconClipboard /> <span>Score</span>
              </button>
              <button className={`main-nav-item ${view === 'summary' ? 'is-active' : ''}`} onClick={onShowSummary}>
                <IconGrid /> <span>Summary</span>{ballots.length ? <span className="main-nav-count mono">{ballots.length}</span> : null}
              </button>
              <button className="main-nav-item" onClick={onOpenEventGuide}>
                <IconBook /> <span>View guide</span>
              </button>
              {isManual && (
                <button className="main-nav-item" onClick={onDownloadDb} title="Save the .sqlite file to disk">
                  <IconDownload /> <span>Download .sqlite</span>
                </button>
              )}
              <button className="main-nav-item" onClick={onExport}>
                <IconDownload /> <span>Export / backup (md)</span>
              </button>
              <button className="main-nav-item" onClick={() => onOpenGuide(...QR)}>
                <IconArrowUpRight /> <span>Quick reference</span>
              </button>
            </nav>

            {/* Round & Room — shared across every candidate in this file */}
            <div className="round-room">
              <label className="field">
                <span className="field-label overline">Round</span>
                <input className="input" value={round} placeholder="e.g. Round 3"
                  onChange={(e) => onChangeRoundRoom(e.target.value, room)} />
              </label>
              <label className="field">
                <span className="field-label overline">Room</span>
                <input className="input" value={room} placeholder="e.g. 204"
                  onChange={(e) => onChangeRoundRoom(round, e.target.value)} />
              </label>
            </div>

            <button className="btn btn-sm sidebar-new" onClick={onNewCandidate}><IconPlus /> New candidate</button>

            <div className="ballot-list">
              <div className="overline ballot-list-label">Candidates ({ballots.length})</div>
              {ballots.length === 0 && <p className="ballot-empty">No candidates yet.</p>}
              {ordered.map((b, i) => (
                <button key={b.id}
                  className={`ballot-item ${currentBallotId === b.id && view === 'score' ? 'is-active' : ''}`}
                  onClick={() => onPickBallot(b.id!)}>
                  <span className="ballot-item-num mono">{b.speakingOrder ?? i + 1}</span>
                  <Avatar label={competitorLabel(b)} />
                  <span className="ballot-item-text">
                    <span className="ballot-item-main">{competitorLabel(b)}</span>
                    <span className="ballot-item-meta mono">
                      {b.rank != null ? `rank ${b.rank}` : 'unranked'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
