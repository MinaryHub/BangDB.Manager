import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createTable, dropTable, extractTables, isSystemTable, listTables } from '../api/bangdb';
import type { ApiResult, ColumnInfo, CreateTableSpec, KeyType, TableType } from '../api/types';
import { createTableSql } from '../api/goapi';
import { TopBar } from '../components/Layout';
import { Icons } from '../components/kinds';
import { Field, Modal, ResultBadge, describeResult, useConfirm, useToast } from '../components/ui';
import { useConnection } from '../store/store';
import { t } from '../i18n';

export default function TablesPage() {
  const { connId, db = '' } = useParams();
  const conn = useConnection(connId);
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, confirmEl } = useConfirm();
  const [tables, setTables] = useState<string[]>([]);
  const [res, setRes] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSys, setShowSys] = useState(false);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!conn) return;
    setLoading(true);
    const r = await listTables(conn, db);
    setRes(r);
    setTables(r.ok ? extractTables(r.data) : []);
    setLoading(false);
  }, [conn, db]);
  useEffect(() => { load(); }, [load]);

  if (!conn) return <div className="empty">{t('Connection not found.')}</div>;

  const shown = tables.filter((x) => (showSys || !isSystemTable(x)) && x.toLowerCase().includes(filter.toLowerCase()));

  async function drop(tb: string) {
    if (!conn) return;
    if (!(await confirm(t('Delete table "{name}"? All of its data will be lost.', { name: tb })))) return;
    const r = await dropTable(conn, db, tb);
    if (r.ok) { toast(t('"{name}" deleted', { name: tb }), 'ok'); load(); } else toast(t('Delete failed: {error}', { error: describeResult(r) }), 'err');
  }

  return (
    <>
      <TopBar title={db} crumbs={[{ to: '/connections', label: t('Servers') }, { to: `/c/${conn.id}/dbs`, label: conn.name }, { label: 'DB' }]}
        right={<><button className="btn sm" onClick={() => nav(`/c/${conn.id}/db/${encodeURIComponent(db)}/query`)}>SQL</button><button className="btn primary sm" onClick={() => setCreating(true)}>{t('+ Table')}</button></>} />
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <input className="grow mono" placeholder={t('Search tables')} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)' }} />
        <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={showSys} onChange={(e) => setShowSys(e.target.checked)} /> {t('System tables')}</label>
        <button className="btn ghost icon sm" onClick={load} disabled={loading} title={t('Refresh')} aria-label={t('Refresh')}>{loading ? <span className="spin" /> : Icons.refresh}</button>
        <ResultBadge r={res} />
      </div>
      {res && !res.ok && <div className="card danger">{describeResult(res)}</div>}
      {res?.ok && shown.length === 0 && <div className="empty">{t('No tables.')}</div>}
      <div className="list">
        {shown.map((tb) => (
          <div key={tb} className="item">
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => nav(`/c/${conn.id}/db/${encodeURIComponent(db)}/t/${encodeURIComponent(tb)}`)}>
              <div className="title mono">{tb}</div>
              {isSystemTable(tb) && <div className="sub">{t('System table')}</div>}
            </div>
            <button className="btn ghost icon sm danger" onClick={() => drop(tb)} title={t('Delete')} aria-label={t('Delete')}>{Icons.trash}</button>
          </div>
        ))}
      </div>
      <button className="fab" onClick={() => setCreating(true)} aria-label={t('Create table')}>+</button>
      {creating && conn.kind === 'go' && <CreateSqlTableModal onClose={() => setCreating(false)} onCreate={async (spec) => {
        const r = await createTable(conn, db, spec);
        if (r.ok) { toast(t('"{name}" created', { name: spec.table_name }), 'ok'); setCreating(false); load(); } else toast(t('Create failed: {error}', { error: describeResult(r) }), 'err');
      }} />}
      {creating && conn.kind === 'rest' && <CreateTableModal onClose={() => setCreating(false)} onCreate={async (spec) => {
        const r = await createTable(conn, db, spec);
        if (r.ok) { toast(t('"{name}" created', { name: spec.table_name }), 'ok'); setCreating(false); load(); } else toast(t('Create failed: {error}', { error: describeResult(r) }), 'err');
      }} />}
      {confirmEl}
    </>
  );
}

function CreateTableModal({ onClose, onCreate }: { onClose: () => void; onCreate: (s: CreateTableSpec) => Promise<void> }) {
  const [s, setS] = useState<CreateTableSpec>({ table_name: '', table_type: 'WIDE_TABLE', key_type: 'NORMAL_KEY', key_sz: 24, allow_duplicate: false, allow_rev_idx: false, version_type: 0 });
  const [busy, setBusy] = useState(false);
  const up = (p: Partial<CreateTableSpec>) => setS((x) => ({ ...x, ...p }));
  return (
    <Modal title={t('Create table')} onClose={onClose}>
      <Field label={t('Table name')}><input className="mono" autoFocus value={s.table_name} onChange={(e) => up({ table_name: e.target.value })} /></Field>
      <div className="grid2">
        <Field label={t('Table type')}>
          <select value={s.table_type} onChange={(e) => up({ table_type: e.target.value as TableType })}>
            <option value="WIDE_TABLE">{t('WIDE_TABLE (JSON documents, indexable)')}</option>
            <option value="NORMAL_TABLE">{t('NORMAL_TABLE (key/value)')}</option>
            <option value="PRIMITIVE_TABLE">PRIMITIVE_TABLE</option>
          </select>
        </Field>
        <Field label={t('Key type')}>
          <select value={s.key_type} onChange={(e) => up({ key_type: e.target.value as KeyType })}>
            <option value="NORMAL_KEY">{t('NORMAL_KEY (string)')}</option>
            <option value="NORMAL_KEY_LONG">{t('NORMAL_KEY_LONG (integer)')}</option>
            <option value="COMPOSITE_KEY">COMPOSITE_KEY</option>
          </select>
        </Field>
        <Field label={t('Key size (bytes)')}><input type="number" min={1} value={s.key_sz} onChange={(e) => up({ key_sz: Number(e.target.value) })} /></Field>
        <Field label={t('Versioning')}><select value={s.version_type} onChange={(e) => up({ version_type: Number(e.target.value) })}><option value={0}>{t('Off')}</option><option value={1}>{t('On')}</option></select></Field>
      </div>
      <label className="check"><input type="checkbox" checked={s.allow_duplicate} onChange={(e) => up({ allow_duplicate: e.target.checked })} /> {t('Allow duplicate keys (allow_duplicate)')}</label>
      <label className="check"><input type="checkbox" checked={s.allow_rev_idx} onChange={(e) => up({ allow_rev_idx: e.target.checked })} /> {t('Reverse index (allow_rev_idx, WIDE_TABLE)')}</label>
      <div className="actions">
        <button className="btn" onClick={onClose}>{t('Cancel')}</button>
        <button className="btn primary" disabled={busy || !s.table_name.trim()} onClick={async () => { setBusy(true); try { await onCreate({ ...s, table_name: s.table_name.trim() }); } finally { setBusy(false); } }}>{t('Create')}</button>
      </div>
    </Modal>
  );
}

type ColDraft = ColumnInfo & { id: number };
const TYPES = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'ANY'];

/** CREATE TABLE builder for BangDB (Go): columns with type/PK/NOT NULL/UNIQUE/DEFAULT, or raw SQL. */
function CreateSqlTableModal({ onClose, onCreate }: { onClose: () => void; onCreate: (s: CreateTableSpec & { columns?: ColumnInfo[]; sql?: string }) => Promise<void> }) {
  const [name, setName] = useState('');
  const [cols, setCols] = useState<ColDraft[]>([{ id: 1, name: 'id', decl: 'INTEGER', pk: true }, { id: 2, name: '', decl: 'TEXT' }]);
  const [rawSql, setRawSql] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const upCol = (id: number, p: Partial<ColumnInfo>) => setCols((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const base: CreateTableSpec = { table_name: name.trim(), table_type: 'NORMAL_TABLE', key_type: 'NORMAL_KEY', key_sz: 0, allow_duplicate: false, allow_rev_idx: false, version_type: 0 };
  let preview = '';
  try { preview = name.trim() ? createTableSql({ ...base, columns: cols }) : ''; } catch (e) { preview = `-- ${(e as Error).message}`; }
  return (
    <Modal title={t('Create table (SQL)')} onClose={onClose}>
      <Field label={t('Table name')}><input className="mono" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {rawSql === null ? (
        <>
          <div className="muted small" style={{ marginBottom: 6 }}>{t('Columns')}</div>
          {cols.map((c) => (
            <div key={c.id} className="row wrap" style={{ marginBottom: 6, gap: 6 }}>
              <input className="mono" placeholder={t('Name')} value={c.name} onChange={(e) => upCol(c.id, { name: e.target.value })} style={{ ...inp, flex: '1 1 110px' }} />
              <select value={c.decl} onChange={(e) => upCol(c.id, { decl: e.target.value })} style={{ ...inp, width: 100 }}>{TYPES.map((ty) => <option key={ty}>{ty}</option>)}</select>
              <label className="check small" style={{ margin: 0 }}><input type="checkbox" checked={!!c.pk} onChange={(e) => upCol(c.id, { pk: e.target.checked })} />PK</label>
              <label className="check small" style={{ margin: 0 }}><input type="checkbox" checked={!!c.notNull} onChange={(e) => upCol(c.id, { notNull: e.target.checked })} />NOT NULL</label>
              <label className="check small" style={{ margin: 0 }}><input type="checkbox" checked={!!c.unique} onChange={(e) => upCol(c.id, { unique: e.target.checked })} />UNIQUE</label>
              <input className="mono" placeholder="DEFAULT" value={c.default ?? ''} onChange={(e) => upCol(c.id, { default: e.target.value })} style={{ ...inp, width: 90 }} />
              <button className="btn sm ghost" onClick={() => setCols((l) => l.filter((x) => x.id !== c.id))} aria-label={t('Delete column')}>✕</button>
            </div>
          ))}
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="btn sm" onClick={() => setCols((l) => [...l, { id: Date.now(), name: '', decl: 'TEXT' }])}>{t('+ Column')}</button>
            <button className="btn sm ghost" onClick={() => setRawSql(preview)}>{t('Edit SQL directly')}</button>
          </div>
          {preview && <pre className="out">{preview}</pre>}
        </>
      ) : (
        <Field label="CREATE TABLE SQL"><textarea className="mono" rows={8} value={rawSql} spellCheck={false} onChange={(e) => setRawSql(e.target.value)} /></Field>
      )}
      <div className="actions">
        <button className="btn" onClick={onClose}>{t('Cancel')}</button>
        <button className="btn primary" disabled={busy || (rawSql === null ? !name.trim() : !rawSql.trim())} onClick={async () => {
          setBusy(true);
          try {
            if (rawSql !== null) await onCreate({ ...base, table_name: name.trim() || 'table', sql: rawSql });
            else { createTableSql({ ...base, columns: cols }); await onCreate({ ...base, columns: cols }); }
          } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
        }}>{t('Create')}</button>
      </div>
    </Modal>
  );
}
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)' };
