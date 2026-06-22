import { useEffect, useState, type MouseEvent } from 'react';
import { marked } from 'marked';
import { IconX } from './icons';

// Slide-over panel that renders the event's full markdown guide as reference
// while judging. The markdown is fetched from public/guides/<key>.md (copied
// there by scripts/build-data.ts). Content is our own trusted guides.
marked.setOptions({ gfm: true, breaks: false });

const cache = new Map<string, string>();

export function GuideDrawer({
  file, title, label = 'Event guide', open, onClose, onNavigate,
}: {
  file: string; title: string; label?: string; open: boolean; onClose: () => void;
  // Resolve an in-guide markdown link (e.g. the quick reference's event index)
  // to another guide and open it here, instead of letting the browser navigate
  // to a non-existent path. Receives the link's raw filename.
  onNavigate?: (fileName: string) => void;
}) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (cache.has(file)) { setHtml(cache.get(file)!); setError(''); return; }
    setHtml(''); setError('');
    // Don't gate on response.ok — the desktop `views://` scheme returns status 0
    // on success. Treat an empty body as the real failure.
    fetch(`${import.meta.env.BASE_URL}guides/${file}`)
      .then((r) => r.text())
      .then((md) => {
        if (!md.trim()) throw new Error('empty');
        const out = marked.parse(md) as string; cache.set(file, out); setHtml(out);
      })
      .catch(() => setError('Could not load the guide. Run `bun run build:data` to generate it.'));
  }, [open, file]);

  // Catch clicks on markdown links to other guides (.md) and route them through
  // onNavigate; let real external links (http) behave normally.
  function onClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (!href.endsWith('.md')) return;
    e.preventDefault();
    onNavigate?.(href.split('/').pop()!);
  }

  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="drawer-head">
          <span className="overline">{label}</span>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)" aria-label="Close"><IconX /></button>
        </div>
        {error && <div className="callout callout-bad">{error}</div>}
        {!html && !error && <p className="drawer-loading">Loading…</p>}
        <article className="markdown" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      </aside>
    </div>
  );
}
