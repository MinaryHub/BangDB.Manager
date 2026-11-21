import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { countWhere, dropTable, dropView, errorText, estimateCounts, goQuery, goRows, goTables } from '../api/goapi';
import { mapLimit } from '../api/limit';
import type { GoTableInfo } from '../api/types';
import { TopBar } from '../components/Layout';
import { Icons } from '../components/kinds';
import { CreateTableModal, CreateViewModal } from '../components/SchemaForms';
import { DataTable, Modal, useConfirm, useToast } from '../components/ui';
import { useDbConnection } from '../store/store';
import { dialectOf, viewSelect } from '../api/dialect';
import { t, tp } from '../i18n';

/** Tables at least this big (by the statistics) keep the estimate instead of a COUNT(*). */
const EXACT_BELOW = 100_000;

interface RowCount { n: number; approx?: boolean; counting?: boolean }

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

function CountText({ c, onExact }: { c: RowCount | undefined; onExact: () => void }) {
  if (!c) return <>{t('… rows')}</>;
  if (!c.approx) return <>{tp(c.n, '{n} row', '{n} rows')}</>;
  return (
    <button className="linkbtn" disabled={c.counting} onClick={(e) => { e.stopPropagation(); onExact(); }}
      title={t('About {n} rows, from the database statistics. Click to count exactly (scans the table).', { n: c.n.toLocaleString() })}>
      {c.counting ? t('counting…') : t('≈ {n} rows', { n: compact.format(c.n) })}
    </button>
  );
}

/** Tables and views of a SQL database (BangDB or one reached through the gateway). */
export default function GoTablesPage() {
  const { connId, db = '' } = useParams();
  const conn = useDbConnection(connId, db);
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, confirmEl } = useConfirm();
  const [tables, setTables] = useState<GoTableInfo[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, RowCount | undefined>>({});
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState<'table' | 'view' | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);

  // each load gets a number; counts of an older load (or after leaving the page) are dropped
  const loadSeq = useRef(0);
  useEffect(() => () => { loadSeq.current++; }, []);
  const load = useCallback(async () => {
    if (!conn) return;
    const my = ++loadSeq.current;
    const stale = () => my !== loadSeq.current;
    setLoading(true);
    const r = await goTables(conn);
    if (stale()) return;
    setLoading(false);
    if (!r.ok) { setErr(errorText(r)); setTables([]); return; }
    setErr('');
    setTables(r.data.tables);
    // Row counts. Where the database keeps statistics (PostgreSQL, MySQL,
    // SQL Server) one catalog query gives every table's estimate; big tables
    // keep it (COUNT(*) scans them) and can be counted on request. The rest
    // are counted exactly, a few at a time — a COUNT(*) per table all at
    // once floods the server and the gateway's small pool — and shown as
    // each one arrives.
    const tableList = r.data.tables.filter((tb) => tb.kind === 'table');
    const est = await estimateCounts(conn);
    if (stale()) return;
    const first: Record<string, RowCount> = {};
    for (const tb of tableList) { const n = est?.get(tb.name); if (n !== undefined && n >= EXACT_BELOW) first[tb.name] = { n, approx: true }; }
    setCounts(first);
    await mapLimit(tableList.filter((tb) => !first[tb.name]), 4, async (tb) => {
      const n = await countWhere(conn, tb.name);
      if (!stale()) setCounts((c) => ({ ...c, [tb.name]: n === undefined ? undefined : { n } }));
    }, stale);
  }, [conn]);
  useEffect(() => { load(); }, [load]);

  async function countExactly(name: string) {
    if (!conn) return;
    setCounts((c) => ({ ...c, [name]: c[name] && { ...c[name]!, counting: true } }));
    const n = await countWhere(conn, name);
    setCounts((c) => ({ ...c, [name]: n === undefined ? c[name] && { ...c[name]!, counting: false } : { n } }));
    if (n === undefined) toast(t('Could not count "{name}"', { name }), 'err');
  }

  if (!conn) return <div className="empty">{t('Connection not found.')}</div>;
  const base = `/c/${conn.id}/db/${encodeURIComponent(db)}`;
  const shown = tables.filter((tb) => tb.name.toLowerCase().includes(filter.toLowerCase()));
  const nT = tables.filter((tb) => tb.kind === 'table').length;

  async function drop(tb: GoTableInfo) {
    if (!conn) return;
    const view = tb.kind === 'view';
    if (!(await confirm(view ? t('Drop view "{name}".', { name: tb.name }) : t('Drop table "{name}". All data will be lost.', { name: tb.name })))) return;
    const r = view ? await dropView(conn, tb.name) : await dropTable(conn, tb.name);
    if (r.ok) { toast(t('"{name}" deleted', { name: tb.name }), 'ok'); load(); } else toast(t('Delete failed: {error}', { error: errorText(r) }), 'err');
  }

  async function create(sql: string, name: string): Promise<boolean> {
    if (!conn) return false;
    const r = await goQuery(conn, sql, undefined, { mode: 'exec' });
    if (!r.ok) { toast(t('Failed: {error}', { error: errorText(r) }), 'err'); return false; }
    toast(t('"{name}" created', { name }), 'ok');
    await load();
    if (name) nav(`${base}/t/${encodeURIComponent(name)}`);
    return true;
  }

  return (
    <>
      <TopBar title={conn.db && conn.kind !== 'sqlite' ? db : t('Tables')} crumbs={[{ to: '/connections', label: t('Servers') }, { to: `/c/${conn.id}/dbs`, label: conn.name }]}
        right={<>
          <button className="btn sm" onClick={() => nav(`${base}/query`)}>SQL</button>
          <button className="btn sm" onClick={() => setCreating('view')}>{t('+ View')}</button>
          <button className="btn primary sm" onClick={() => setCreating('table')}>{t('+ Table')}</button>
        </>} />
      <div className="toolbar">
        <input type="search" className="inp filter" placeholder={t('Search tables and views — Enter opens the first match')} value={filter} onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && shown[0]) nav(`${base}/t/${encodeURIComponent(shown[0].name)}`); }} />
        <span className="muted small">{tp(nT, '{n} table', '{n} tables')} · {tp(tables.length - nT, '{n} view', '{n} views')}</span>
        <button className="btn ghost icon sm" onClick={load} disabled={loading} title={t('Refresh')} aria-label={t('Refresh')}>{loading ? <span className="spin" /> : Icons.refresh}</button>
      </div>
      {err && <div className="card danger">{err}</div>}
      {!err && !loading && tables.length === 0 && (
        <div className="card">
          <p><b>{t('No tables.')}</b></p>
          <p className="muted small">{t('Create one with "+ Table" by choosing columns and constraints, or restore a dump with "Run SQL script" on the server page.')}</p>
          <button className="btn primary" onClick={() => setCreating('table')}>{t('+ Create table')}</button>
        </div>
      )}
      <div className="list">
        {shown.map((tb) => (
          <div key={tb.name} className="item">
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => nav(`${base}/t/${encodeURIComponent(tb.name)}`)}>
              <div className="title mono">
                {tb.name}
                {tb.kind === 'view' && <span className="badge accent" style={{ marginLeft: 8 }}>{t('View')}</span>}
                {tb.store === 'memory' && <span className="badge accent" style={{ marginLeft: 8 }}>{t('In-memory')}</span>}
                {tb.store === 'timeseries' && <span className="badge accent" style={{ marginLeft: 8 }}>{t('Time series')}</span>}
              </div>
              <div className="sub">
                {tb.kind === 'view'
                  ? viewSelect(tb.sql ?? '').replace(/\s+/g, ' ').slice(0, 120)
                  : <>{tp(tb.columns?.length ?? 0, '{n} column', '{n} columns')} · {tp((tb.indexes ?? []).filter((i) => !i.auto).length, '{n} index', '{n} indexes')} · <CountText c={counts[tb.name]} onExact={() => countExactly(tb.name)} /> — {(tb.columns ?? []).map((c) => c.name).join(', ')}</>}
              </div>
            </div>
            <button className="btn ghost icon sm danger" onClick={() => drop(tb)} title={t('Delete')} aria-label={t('Delete')}>{Icons.trash}</button>
            <span className="chev" onClick={() => nav(`${base}/t/${encodeURIComponent(tb.name)}`)}>{Icons.chevron}</span>
          </div>
        ))}
      </div>
      <button className="fab" onClick={() => setCreating('table')} aria-label={t('Create table')}>+</button>
      {creating === 'table' && <CreateTableModal tables={tables} d={dialectOf(conn)} onClose={() => setCreating(null)} onCreate={create} />}
      {creating === 'view' && (
        <CreateViewModal d={dialectOf(conn)} onClose={() => setCreating(null)} onCreate={create}
          onPreview={async (s) => { const r = await goQuery(conn, s, undefined, { limit: 5 }); if (r.ok) setPreview(goRows(r.data)); else toast(errorText(r), 'err'); }} />
      )}
      {preview && <Modal title={t('Preview (5 rows)')} onClose={() => setPreview(null)} wide><DataTable rows={preview} /></Modal>}
      {confirmEl}
    </>
  );
}
