import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { affinity, editText, isBlob, isBoolColumn, parseInput } from '../api/goapi';
import type { ColumnInfo } from '../api/types';

/** A grid row: `key` is the rowid, or "new:<n>" for a row not yet inserted. */
export interface GridRow {
  key: string;
  values: Record<string, unknown>;
  isNew?: boolean;
}

export interface GridProps {
  columns: ColumnInfo[];
  rows: GridRow[];
  readOnly?: boolean;
  /** Pending edits: row key → column → value. */
  edits: Record<string, Record<string, unknown>>;
  deleted: Set<string>;
  selected: Set<string>;
  sort?: { col: string; desc: boolean };
  onSort?: (col: string) => void;
  onEdit: (rowKey: string, col: string, value: unknown) => void;
  onToggleSelect: (rowKey: string) => void;
  onToggleAll: () => void;
  onOpenRow: (row: GridRow) => void;
  onError: (msg: string) => void;
}

/** Display text of a stored value. */
export function cellText(v: unknown): string {
  if (v === undefined) return '';
  if (v === null) return 'NULL';
  if (isBlob(v)) return `BLOB (${Math.floor((v.blob.length * 3) / 4)} B)`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

type Dir = 1 | -1 | 'down';
interface RowHandlers {
  edit: (rowKey: string, col: string, value: unknown) => void;
  toggle: (rowKey: string) => void;
  open: (row: GridRow) => void;
  error: (msg: string) => void;
  startEdit: (row: string, col: string) => void;
  stopEdit: () => void;
  move: (row: string, col: string, dir: Dir) => void;
}

export function DataGrid(p: GridProps) {
  const [editing, setEditing] = useState<{ row: string; col: string } | null>(null);
  const allSel = p.rows.length > 0 && p.rows.every((r) => p.selected.has(r.key));

  // Rows are memoized; they get handlers that never change identity and read
  // the latest props through this ref, so editing or selecting one row only
  // re-renders that row instead of the whole page.
  const latest = useRef(p);
  latest.current = p;
  const h = useMemo((): RowHandlers => ({
    edit: (k, c, v) => latest.current.onEdit(k, c, v),
    toggle: (k) => latest.current.onToggleSelect(k),
    open: (r) => latest.current.onOpenRow(r),
    error: (m) => latest.current.onError(m),
    startEdit: (row, col) => setEditing({ row, col }),
    stopEdit: () => setEditing(null),
    move: (row, col, dir) => {
      const { rows, columns, readOnly } = latest.current;
      if (dir === 'down') {
        const i = rows.findIndex((r) => r.key === row);
        const next = rows[i + 1];
        setEditing(next ? { row: next.key, col } : null);
        return;
      }
      const cols = columns.filter((c) => isEditable(c, readOnly));
      const i = cols.findIndex((c) => c.name === col);
      const next = cols[i + dir];
      setEditing(next ? { row, col: next.name } : null);
    }
  }), []);

  return (
    <div className="gridwrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="lead">
              {!p.readOnly && <input type="checkbox" checked={allSel} onChange={p.onToggleAll} aria-label="Select all" />}
            </th>
            {p.columns.map((c) => (
              <th key={c.name} className={p.onSort ? 'sortable' : ''} onClick={() => p.onSort?.(c.name)} title={c.decl || c.type || ''}
                aria-sort={p.sort?.col === c.name ? (p.sort.desc ? 'descending' : 'ascending') : undefined}>
                {c.pk && <span className="pk-ico" title="Primary key">🔑</span>}
                {c.name}
                {p.sort?.col === c.name && <span>{p.sort.desc ? ' ▼' : ' ▲'}</span>}
                <span className="ctype">{[c.decl || c.type || 'ANY', c.notNull ? 'NOT NULL' : '', c.default ? `= ${c.default}` : ''].filter(Boolean).join(' · ')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r) => (
            <Row key={r.key} r={r} columns={p.columns} readOnly={!!p.readOnly} edits={p.edits[r.key]}
              del={p.deleted.has(r.key)} sel={p.selected.has(r.key)}
              editingCol={editing?.row === r.key ? editing.col : null} h={h} />
          ))}
        </tbody>
      </table>
      {!p.rows.length && <div className="empty">No rows</div>}
    </div>
  );
}

const isEditable = (c: ColumnInfo, readOnly?: boolean) => !readOnly && affinity(c) !== 'BLOB';
const NO_EDITS: Record<string, unknown> = {};

const Row = memo(function Row({ r, columns, readOnly, edits, del, sel, editingCol, h }: {
  r: GridRow; columns: ColumnInfo[]; readOnly: boolean; edits: Record<string, unknown> | undefined;
  del: boolean; sel: boolean; editingCol: string | null; h: RowHandlers;
}) {
  const e = edits ?? NO_EDITS;
  return (
    <tr className={[r.isNew ? 'new' : '', del ? 'deleted' : '', sel ? 'sel' : ''].join(' ')}>
      <td className="lead">
        {!readOnly && <input type="checkbox" checked={sel} onChange={() => h.toggle(r.key)} aria-label="Select row" />}
        <button className="rowbtn" title={readOnly ? 'Details' : 'Edit in form'} onClick={() => h.open(r)}>{readOnly ? '⤢' : '✎'}</button>
      </td>
      {columns.map((c) => {
        const has = c.name in e;
        const v = has ? e[c.name] : r.values[c.name];
        const a = affinity(c);
        const canEdit = isEditable(c, readOnly) && !del;
        if (editingCol === c.name) {
          return (
            <td key={c.name} className="editing">
              <CellEditor col={c} value={v}
                onCommit={(val, next) => {
                  if (!sameValue(val, r.values[c.name]) || has) h.edit(r.key, c.name, val);
                  if (next) h.move(r.key, c.name, next); else h.stopEdit();
                }}
                onCancel={h.stopEdit}
                onError={h.error} />
            </td>
          );
        }
        const cls = ['cell', has ? 'edited' : '', a === 'INTEGER' || a === 'REAL' ? 'num' : '', canEdit ? '' : 'ro'].join(' ');
        const placeholder = r.isNew && !has ? (c.pk && a === 'INTEGER' ? '(auto)' : c.default ? `default ${c.default}` : '') : '';
        return (
          <td key={c.name} className={cls} title={cellText(v)} tabIndex={canEdit ? 0 : undefined}
            onClick={() => { if (canEdit) h.startEdit(r.key, c.name); }}
            onKeyDown={(ev) => { if (canEdit && (ev.key === 'Enter' || ev.key === 'F2')) { ev.preventDefault(); h.startEdit(r.key, c.name); } }}>
            {placeholder ? <span className="null">{placeholder}</span> : v === null || (r.isNew && v === undefined) ? <span className="null">{r.isNew ? '' : 'NULL'}</span> : cellText(v)}
          </td>
        );
      })}
    </tr>
  );
});

const sameValue = (a: unknown, b: unknown) => a === b || (a !== null && b !== null && typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));

/** Inline editor: Enter saves and moves down, Tab moves right, Esc cancels. */
function CellEditor({ col, value, onCommit, onCancel, onError }: {
  col: ColumnInfo; value: unknown;
  onCommit: (v: unknown, next?: Dir) => void; onCancel: () => void; onError: (m: string) => void;
}) {
  const [text, setText] = useState(editText(value));
  const [isNull, setIsNull] = useState(value === null);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => { ref.current?.focus(); if (ref.current && 'select' in ref.current && ref.current.tagName === 'INPUT') ref.current.select(); }, []);

  function commit(next?: Dir) {
    if (isNull) { onCommit(null, next); return; }
    try { onCommit(parseInput(text, col), next); } catch (e) { onError((e as Error).message); }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commit('down'); }
    else if (e.key === 'Tab') { e.preventDefault(); commit(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
  };

  if (isBoolColumn(col)) {
    return (
      <select ref={ref} value={value === null ? '' : String(Number(value) ? 1 : 0)} onKeyDown={onKey} onBlur={() => onCancel()}
        onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}>
        <option value="">NULL</option><option value="1">true (1)</option><option value="0">false (0)</option>
      </select>
    );
  }
  const a = affinity(col);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <input ref={ref} value={isNull ? '' : text} placeholder={isNull ? 'NULL' : ''}
        inputMode={a === 'INTEGER' ? 'numeric' : a === 'REAL' ? 'decimal' : undefined}
        onChange={(e) => { setIsNull(false); setText(e.target.value); }}
        onKeyDown={onKey} onBlur={() => commit()} />
      {!col.notNull && !col.pk && (
        <button type="button" className="btn sm ghost" style={{ minHeight: 0, borderRadius: 0, border: 0 }} title="Set to NULL"
          onMouseDown={(e) => { e.preventDefault(); onCommit(null); }}>NULL</button>
      )}
    </div>
  );
}
