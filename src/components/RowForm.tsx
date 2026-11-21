import { useState } from 'react';
import { affinity, editText, isBlob, isBoolColumn, isJsonColumn, parseInput } from '../api/goapi';
import type { ColumnInfo } from '../api/types';
import { t, tp } from '../i18n';
import { Modal, useConfirm, useToast } from './ui';

type Mode = 'default' | 'null' | 'value';
interface FieldState { mode: Mode; text: string; blob?: string }

/**
 * Form for one row. New rows start with every field on "default" (left out
 * of the INSERT, so DEFAULT / auto-increment apply); edits send only the
 * fields that changed.
 */
export function RowForm({ columns, values, isNew, readOnly, title, onClose, onSubmit, onDelete, onDuplicate }: {
  columns: ColumnInfo[];
  values: Record<string, unknown>;
  isNew: boolean;
  readOnly?: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: (values: Record<string, unknown>) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onDuplicate?: (values: Record<string, unknown>) => void;
}) {
  const toast = useToast();
  const { confirm, confirmEl } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Record<string, FieldState>>(() => {
    const o: Record<string, FieldState> = {};
    for (const c of columns) {
      const has = c.name in values;
      const v = values[c.name];
      o[c.name] = isNew && !has
        ? { mode: 'default', text: '' }
        : v === null || v === undefined ? { mode: 'null', text: '' }
        : isBlob(v) ? { mode: 'value', text: '', blob: v.blob }
        : { mode: 'value', text: pretty(c, editText(v)) };
    }
    return o;
  });
  const set = (name: string, p: Partial<FieldState>) => setF((x) => ({ ...x, [name]: { ...x[name], ...p } }));

  function collect(): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      const s = f[c.name];
      if (s.mode === 'default') continue;
      let v: unknown;
      if (s.mode === 'null') v = null;
      else if (s.blob !== undefined) v = { blob: s.blob };
      else if (isJsonColumn(c) && s.text.trim()) {
        try { v = JSON.stringify(JSON.parse(s.text)); } catch (e) { toast(t('{column}: invalid JSON — {error}', { column: c.name, error: (e as Error).message }), 'err'); return null; }
      } else {
        try { v = parseInput(s.text, c); } catch (e) { toast((e as Error).message, 'err'); return null; }
      }
      if (!isNew && same(v, values[c.name])) continue;
      out[c.name] = v;
    }
    return out;
  }

  async function submit() {
    const v = collect();
    if (!v || !onSubmit) return;
    if (!Object.keys(v).length) { toast(isNew ? t('Enter at least one value') : t('No values changed'), 'err'); return; }
    setBusy(true);
    try { if (await onSubmit(v)) onClose(); } finally { setBusy(false); }
  }

  async function pickFile(name: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    set(name, { mode: 'value', blob: btoa(bin), text: '' });
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      {columns.map((c) => {
        const s = f[c.name];
        const a = affinity(c);
        const auto = c.pk && a === 'INTEGER';
        const long = isJsonColumn(c) || s.text.length > 60 || s.text.includes('\n');
        return (
          <div key={c.name} className="formrow">
            <div className="lbl">
              {c.pk && <span className="pk-ico">🔑</span>}{c.name}
              <span className="ctype">{[c.decl || c.type || 'ANY', c.notNull ? 'NOT NULL' : '', c.unique ? 'UNIQUE' : '', c.default ? `DEFAULT ${c.default}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="ctl">
              {a === 'BLOB' || s.blob !== undefined ? (
                <div className="row wrap">
                  <span className="small muted">{s.blob !== undefined ? tp(Math.floor((s.blob.length * 3) / 4), '{n} byte', '{n} bytes') : s.mode === 'null' ? 'NULL' : t('Empty')}</span>
                  {!readOnly && <label className="btn sm">{t('Choose file')}<input type="file" style={{ display: 'none' }} onChange={(e) => pickFile(c.name, e)} /></label>}
                  {s.blob !== undefined && <button className="btn sm ghost" onClick={() => download(c.name, s.blob!)}>{t('Download')}</button>}
                </div>
              ) : isBoolColumn(c) ? (
                <select className="inp" disabled={readOnly} value={s.mode === 'value' ? (Number(s.text) ? '1' : '0') : s.mode}
                  onChange={(e) => { const v = e.target.value; set(c.name, v === 'null' || v === 'default' ? { mode: v } : { mode: 'value', text: v }); }}>
                  {isNew && <option value="default">{t('Default')}</option>}
                  {!c.notNull && !c.pk && <option value="null">NULL</option>}
                  <option value="1">{t('true (1)')}</option><option value="0">{t('false (0)')}</option>
                </select>
              ) : long ? (
                <textarea className="inp mono" rows={isJsonColumn(c) ? 6 : 3} readOnly={readOnly} value={s.text}
                  placeholder={s.mode === 'default' ? placeholder(c, auto) : s.mode === 'null' ? 'NULL' : ''}
                  onChange={(e) => set(c.name, { mode: 'value', text: e.target.value })} spellCheck={false} />
              ) : (
                <input className="inp mono" readOnly={readOnly} value={s.text}
                  inputMode={a === 'INTEGER' ? 'numeric' : a === 'REAL' ? 'decimal' : undefined}
                  placeholder={s.mode === 'default' ? placeholder(c, auto) : s.mode === 'null' ? 'NULL' : ''}
                  onChange={(e) => set(c.name, { mode: 'value', text: e.target.value })} />
              )}
              {!readOnly && (
                <div className="opts">
                  {isNew && <label><input type="checkbox" checked={s.mode === 'default'} onChange={(e) => set(c.name, { mode: e.target.checked ? 'default' : 'value' })} />{auto ? t('Auto number') : t('Default')}</label>}
                  {!c.notNull && !c.pk && <label><input type="checkbox" checked={s.mode === 'null'} onChange={(e) => set(c.name, { mode: e.target.checked ? 'null' : 'value', blob: undefined })} />NULL</label>}
                  {isJsonColumn(c) && s.mode === 'value' && <a href="#" onClick={(e) => { e.preventDefault(); try { set(c.name, { text: JSON.stringify(JSON.parse(s.text), null, 2) }); } catch (er) { toast(t('JSON error: {error}', { error: (er as Error).message }), 'err'); } }}>{t('Format')}</a>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="actions">
        {onDelete && (
          <button className="btn danger" disabled={busy} onClick={async () => {
            if (!(await confirm(t('Delete this row?'), t('Delete')))) return;
            setBusy(true); try { if (await onDelete()) onClose(); } finally { setBusy(false); }
          }}>{t('Delete')}</button>
        )}
        {onDuplicate && <button className="btn ghost" onClick={() => { const v = collectAll(columns, f); if (v) onDuplicate(v); }}>{t('Duplicate')}</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>{readOnly ? t('Close') : t('Cancel')}</button>
        {!readOnly && onSubmit && <button className="btn primary" disabled={busy} onClick={submit}>{isNew ? t('Add (INSERT)') : t('Save (UPDATE)')}</button>}
      </div>
      {confirmEl}
    </Modal>
  );
}

const placeholder = (c: ColumnInfo, auto?: boolean) => (auto ? t('(auto number)') : c.default ? t('(default {value})', { value: c.default }) : t('(default: NULL)'));
const pretty = (c: ColumnInfo, s: string) => {
  if (!isJsonColumn(c) || !s) return s;
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Values for "duplicate as new row": everything except auto-numbered keys. */
function collectAll(columns: ColumnInfo[], f: Record<string, FieldState>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    const s = f[c.name];
    if (s.mode === 'default' || (c.pk && affinity(c) === 'INTEGER')) continue;
    out[c.name] = s.mode === 'null' ? null : s.blob !== undefined ? { blob: s.blob } : (() => { try { return parseInput(s.text, c); } catch { return s.text; } })();
  }
  return out;
}

function download(name: string, b64: string) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf]));
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.bin`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
