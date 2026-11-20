import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiResult } from '../api/types';
import { Icons } from './kinds';

// ---------- Toasts ----------
interface Toast { id: number; text: string; kind: 'info' | 'ok' | 'err'; n: number }
const ToastCtx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems((l) => {
      // repeat of the newest toast: bump its counter instead of stacking
      const last = l[l.length - 1];
      if (last && last.text === text && last.kind === kind) return [...l.slice(0, -1), { ...last, n: last.n + 1 }];
      return [...l.slice(-3), { id, text, kind, n: 1 }];
    });
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'err' ? 6000 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role="status">{t.kind === 'ok' ? Icons.check : t.kind === 'err' ? Icons.alert : Icons.info}<span className="grow">{t.text}</span>{t.n > 1 && <span className="n">×{t.n}</span>}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Human readable one-liner for an API result, for toasts. */
export function describeResult(r: ApiResult): string {
  if (r.error) return r.error;
  if (!r.ok) {
    const d = r.data as Record<string, unknown> | null;
    const msg = d && typeof d === 'object' && ('error' in d || 'msg' in d)
      ? String(d.error ?? d.msg).replace(/^bangdb: /, '')
      : r.text.slice(0, 160);
    return `HTTP ${r.status} ${msg}`.trim();
  }
  return `OK (${r.status}, ${r.durationMs}ms)`;
}

// ---------- Modal ----------
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <button className="x" onClick={onClose} aria-label="Close">{Icons.close}</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ---------- Confirm ----------
export function useConfirm() {
  const [req, setReq] = useState<{ text: string; ok: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((text: string, ok = 'Delete') => new Promise<boolean>((resolve) => setReq({ text, ok, resolve })), []);
  const el = req ? (
    <Modal title="Confirm" onClose={() => { req.resolve(false); setReq(null); }}>
      <p>{req.text}</p>
      <div className="actions">
        <button className="btn" onClick={() => { req.resolve(false); setReq(null); }}>Cancel</button>
        <button className="btn danger" autoFocus onClick={() => { req.resolve(true); setReq(null); }}>{req.ok}</button>
      </div>
    </Modal>
  ) : null;
  return { confirm, confirmEl: el };
}

// ---------- Prompt ----------
export function usePrompt() {
  const [req, setReq] = useState<{ title: string; label: string; value: string; resolve: (v: string | null) => void } | null>(null);
  const prompt = useCallback((title: string, label: string, value = '') => new Promise<string | null>((resolve) => setReq({ title, label, value, resolve })), []);
  const close = (v: string | null) => { req?.resolve(v); setReq(null); };
  const el = req ? (
    <Modal title={req.title} onClose={() => close(null)}>
      <Field label={req.label}>
        <input className="mono" autoFocus value={req.value} onChange={(e) => setReq({ ...req, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && req.value.trim()) close(req.value.trim()); }} />
      </Field>
      <div className="actions">
        <button className="btn" onClick={() => close(null)}>Cancel</button>
        <button className="btn primary" disabled={!req.value.trim()} onClick={() => close(req.value.trim())}>OK</button>
      </div>
    </Modal>
  ) : null;
  return { prompt, promptEl: el };
}

// ---------- JSON output ----------
export function JsonOut({ value }: { value: unknown }) {
  const text = useMemo(() => (typeof value === 'string' ? value : JSON.stringify(value, null, 2)), [value]);
  return <pre className="out">{text}</pre>;
}

export function ResultBadge({ r }: { r: ApiResult | null }) {
  if (!r) return null;
  const cls = r.error ? 'err' : r.ok ? 'ok' : 'warn';
  return <span className={`badge ${cls}`}>{r.error ? 'Error' : `HTTP ${r.status}`} · {r.durationMs}ms</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

/** Rows a result table draws at first; more are added on request (large results stay responsive). */
export const RENDER_STEP = 300;

/** Sort comparator for mixed result values: NULLs last, numbers numerically, text naturally. */
export function compareValues(a: unknown, b: unknown): number {
  const na = a === null || a === undefined, nb = b === null || b === undefined;
  if (na || nb) return na === nb ? 0 : na ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = typeof a === 'object' ? JSON.stringify(a) : String(a);
  const y = typeof b === 'object' ? JSON.stringify(b) : String(b);
  return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Table rendering of an array of flat-ish objects. Nested values shown as JSON.
 * Headers sort in the browser; long results render RENDER_STEP rows at a time.
 */
export function DataTable({ rows, onRowClick }: { rows: Record<string, unknown>[]; onRowClick?: (row: Record<string, unknown>, index: number) => void }) {
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const [limit, setLimit] = useState(RENDER_STEP);
  const cols = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => s.add(k)));
    return Array.from(s);
  }, [rows]);
  // a different result resets paging and sort; callers often rebuild the same
  // rows on every render, so this keys on the shape, not the array identity
  const shape = `${rows.length}\u0000${cols.join('\u0000')}`;
  useEffect(() => { setLimit(RENDER_STEP); setSort((s) => (s && cols.includes(s.col) ? s : null)); }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps
  const numeric = useMemo(() => new Set(cols.filter((c) => rows.slice(0, 50).some((r) => typeof r[c] === 'number') && rows.slice(0, 50).every((r) => r[c] == null || typeof r[c] === 'number'))), [cols, rows]);
  // indexes, so onRowClick still gets the row's position in `rows`
  const order = useMemo(() => {
    const idx = rows.map((_, i) => i);
    if (!sort) return idx;
    const dir = sort.desc ? -1 : 1;
    return idx.sort((i, j) => compareValues(rows[i][sort.col], rows[j][sort.col]) * dir || i - j);
  }, [rows, sort]);
  if (!rows.length) return <div className="empty">No results</div>;
  const toggle = (c: string) => setSort((s) => (s?.col !== c ? { col: c, desc: false } : !s.desc ? { col: c, desc: true } : null));
  return (
    <div className="tablewrap">
      <table className="data">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="sortable" onClick={() => toggle(c)} title="Sort (click again to reverse, a third time to reset)"
                aria-sort={sort?.col === c ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                {c}{sort?.col === c && (sort.desc ? ' ▼' : ' ▲')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.slice(0, limit).map((i) => {
            const r = rows[i];
            return (
              <tr key={i} onClick={onRowClick ? () => onRowClick(r, i) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                {cols.map((c) => {
                  const v = r[c];
                  return <td key={c} className={numeric.has(c) ? 'num' : undefined} title={fmt(v)}>{v === null ? <span className="null">NULL</span> : fmt(v)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > limit && (
        <div className="more-rows">
          Showing {limit.toLocaleString()} of {rows.length.toLocaleString()} rows
          <button className="btn sm" onClick={() => setLimit((l) => l + RENDER_STEP * 3)}>Show more</button>
          <button className="btn sm ghost" onClick={() => setLimit(rows.length)}>Show all</button>
        </div>
      )}
    </div>
  );
}
const fmt = (v: unknown) => (v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Friendly empty state with an optional action. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="ico">{icon ?? Icons.db}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
