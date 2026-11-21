import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isSqlKind } from '../api/dialect';
import { cachedTables } from '../api/goapi';
import type { GoTableInfo } from '../api/types';
import { useConnections, useDbConnection } from '../store/store';
import { SPONSOR_URL, openExternal } from '../appinfo';
import { nextTheme, setTheme, useTheme } from '../theme';
import { checkForUpdates } from '../update';
import { Icons, KindBadge, KIND_STYLE } from './kinds';

/** Event that opens the palette from anywhere (buttons outside the layout). */
export const OPEN_PALETTE = 'bangdb:palette';
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE));

interface Item { id: string; label: string; hint?: string; group: string; icon?: ReactNode; run: () => void }

/**
 * Score of `query` as a subsequence of `text` (higher is better), or -1.
 * Consecutive and word-start matches count more, so "ord" ranks "orders" above "o_r_d".
 */
export function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase(), q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return 0;
  let score = 0, ti = 0, run = 0;
  for (let i = 0; i < q.length; i++) {
    const at = t.indexOf(q[i], ti);
    if (at < 0) return -1;
    const wordStart = at === 0 || /[\s_./·-]/.test(t[at - 1]);
    run = at === ti && i > 0 ? run + 1 : 1;
    // a jump into the middle of a word ("ord" → spOnsoR Development) is a weak match
    score += run * 2 + (wordStart ? 3 : 0) - Math.min(at - ti, 5) * 0.2 - (run === 1 && !wordStart ? (i > 0 ? 6 : 2) : 0);
    ti = at + 1;
  }
  return score - t.length * 0.01;
}

/** Ctrl/⌘+K quick open: jump to a server, a table of the current server, or a page. */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_PALETTE, onOpen); };
  }, []);
  return open ? <Palette onClose={() => setOpen(false)} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const { connId, db: routeDb } = useParams();
  const connections = useConnections();
  const active = connections.find((c) => c.id === connId);
  const db = routeDb ?? active?.defaultDb;
  const conn = useDbConnection(active?.id, db);
  const theme = useTheme();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [tables, setTables] = useState<GoTableInfo[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    if (conn && isSqlKind(conn.kind)) cachedTables(conn).then((t) => { if (alive) setTables(t); });
    return () => { alive = false; };
  }, [conn]);

  const items = useMemo((): Item[] => {
    const out: Item[] = [];
    const go = (to: string) => () => { nav(to); onClose(); };
    if (conn && db !== undefined) {
      const base = `/c/${conn.id}/db/${encodeURIComponent(db)}`;
      for (const t of tables ?? []) {
        out.push({ id: `t:${t.name}`, label: t.name, hint: t.kind === 'view' ? 'View' : `${t.columns?.length ?? 0} columns`, group: conn.name, icon: Icons.db, run: go(`${base}/t/${encodeURIComponent(t.name)}`) });
      }
      if (isSqlKind(conn.kind)) out.push({ id: 'sql', label: 'SQL console', hint: conn.name, group: 'Pages', icon: Icons.code, run: go(`${base}/query`) });
    }
    for (const c of connections) {
      out.push({ id: `c:${c.id}`, label: c.name, hint: KIND_STYLE[c.kind]?.label, group: 'Servers', icon: <KindBadge kind={c.kind} small />, run: go(`/c/${c.id}/dbs`) });
    }
    out.push(
      { id: 'servers', label: 'All servers', group: 'Pages', icon: Icons.server, run: go('/connections') },
      { id: 'about', label: 'About · updates', group: 'Pages', icon: Icons.info, run: go('/about') },
      { id: 'theme', label: `Theme: ${theme} → ${nextTheme(theme)}`, hint: 'Switch colour theme', group: 'Settings', icon: Icons.theme, run: () => setTheme(nextTheme(theme)) },
      { id: 'update', label: 'Check for updates', group: 'App', icon: Icons.refresh, run: () => { void checkForUpdates(); nav('/about'); onClose(); } },
      { id: 'versions', label: 'Version history · what\'s new', group: 'App', icon: Icons.history, run: go('/about/versions') },
      { id: 'bug', label: 'Report a bug', hint: 'GitHub Issues', group: 'App', icon: Icons.bug, run: () => { nav('/about', { state: { feedback: 'bug' } }); onClose(); } },
      { id: 'feature', label: 'Request a feature', hint: 'GitHub Issues', group: 'App', icon: Icons.bulb, run: () => { nav('/about', { state: { feedback: 'feature' } }); onClose(); } },
      { id: 'question', label: 'Ask a question', hint: 'GitHub Issues', group: 'App', icon: Icons.help, run: () => { nav('/about', { state: { feedback: 'question' } }); onClose(); } },
      { id: 'sponsor', label: 'Sponsor development', hint: 'GitHub Sponsors', group: 'App', icon: Icons.heart, run: () => { openExternal(SPONSOR_URL); onClose(); } }
    );
    return out;
  }, [conn, db, tables, connections, theme, nav, onClose]);

  const shown = useMemo(() => {
    if (!q.trim()) return items.slice(0, 60);
    return items
      // the group (server name) counts only when the query has several words, e.g. "prod ord"
      .map((it) => ({ it, s: /\s/.test(q.trim()) ? Math.max(fuzzyScore(it.label, q), fuzzyScore(`${it.group} ${it.label}`, q) - 2) : fuzzyScore(it.label, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.it);
  }, [items, q]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); shown[sel]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  let lastGroup = '';
  return (
    <div className="modal-bg palette-bg" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Quick open">
        <div className="palette-in">
          {Icons.search}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} spellCheck={false}
            placeholder={tables?.length ? 'Jump to a table, server or page…' : 'Jump to a server or page…'}
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={shown[sel] ? `pi-${sel}` : undefined} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {shown.map((it, i) => {
            const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <div key={it.id}>
                {head && !q.trim() && <div className="palette-group">{head}</div>}
                <div id={`pi-${i}`} role="option" aria-selected={i === sel} className={`palette-item${i === sel ? ' on' : ''}`}
                  onMouseMove={() => i !== sel && setSel(i)} onClick={it.run}>
                  <span className="pi-ico">{it.icon}</span>
                  <span className="pi-label">{it.label}</span>
                  {it.hint && <span className="pi-hint">{q.trim() ? `${it.group} · ${it.hint}` : it.hint}</span>}
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="empty">No matches</div>}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Ctrl</kbd><kbd>K</kbd> toggle</span></div>
      </div>
    </div>
  );
}
