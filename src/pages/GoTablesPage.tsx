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

/** Tables at least this big (by the statistics) keep the estimate instead of a COUNT(*). */
const EXACT_BELOW = 100_000;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

interface RowCount { n: number; approx?: boolean; counting?: boolean }

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

function CountText({ c, onExact }: { c: RowCount | undefined; onExact: () => void }) {
  if (!c) return <>… rows</>;
  if (!c.approx) return <>{c.n.toLocaleString()} rows</>;
  return (
    <button className="linkbtn" disabled={c.counting} onClick={(e) => { e.stopPropagation(); onExact(); }}
      title={`About ${c.n.toLocaleString()} rows, from the database statistics. Click to count exactly (scans the table).`}>
      {c.counting ? 'counting…' : `≈ ${compact.format(c.n)} rows`}
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
    const tableList = r.data.tables.filter((t) => t.kind === 'table');
    const est = await estimateCounts(conn);
    if (stale()) return;
    const first: Record<string, RowCount> = {};
    for (const t of tableList) { const n = est?.get(t.name); if (n !== undefined && n >= EXACT_BELOW) first[t.name] = { n, approx: true }; }
    setCounts(first);
    await mapLimit(tableList.filter((t) => !first[t.name]), 4, async (t) => {
      const n = await countWhere(conn, t.name);
      if (!stale()) setCounts((c) => ({ ...c, [t.name]: n === undefined ? undefined : { n } }));
    }, stale);
  }, [conn]);
  useEffect(() => { load(); }, [load]);

  async function countExactly(name: string) {
    if (!conn) return;
    setCounts((c) => ({ ...c, [name]: c[name] && { ...c[name]!, counting: true } }));
    const n = await countWhere(conn, name);
    setCounts((c) => ({ ...c, [name]: n === undefined ? c[name] && { ...c[name]!, counting: false } : { n } }));
    if (n === undefined) toast(`Could not count "${name}"`, 'err');
  }

  if (!conn) return <div className="empty">Connection not found.</div>;
  const base = `/c/${conn.id}/db/${encodeURIComponent(db)}`;
  const shown = tables.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));
  const nT = tables.filter((t) => t.kind === 'table').length;

  async function drop(t: GoTableInfo) {
    if (!conn) return;
    const view = t.kind === 'view';
    if (!(await confirm(view ? `Drop view "${t.name}".` : `Drop table "${t.name}". All data will be lost.`))) return;
    const r = view ? await dropView(conn, t.name) : await dropTable(conn, t.name);
    if (r.ok) { toast(`"${t.name}" deleted`, 'ok'); load(); } else toast(`Delete failed: ${errorText(r)}`, 'err');
  }

  async function create(sql: string, name: string): Promise<boolean> {
    if (!conn) return false;
    const r = await goQuery(conn, sql, undefined, { mode: 'exec' });
    if (!r.ok) { toast(`Failed: ${errorText(r)}`, 'err'); return false; }
    toast(`"${name}" created`, 'ok');
    await load();
    if (name) nav(`${base}/t/${encodeURIComponent(name)}`);
    return true;
  }

  return (
    <>
      <TopBar title={conn.db && conn.kind !== 'sqlite' ? db : 'Tables'} crumbs={[{ to: '/connections', label: 'Servers' }, { to: `/c/${conn.id}/dbs`, label: conn.name }]}
        right={<>
          <button className="btn sm" onClick={() => nav(`${base}/query`)}>SQL</button>
          <button className="btn sm" onClick={() => setCreating('view')}>+ View</button>
          <button className="btn primary sm" onClick={() => setCreating('table')}>+ Table</button>
        </>} />
      <div className="toolbar">
        <input type="search" className="inp filter" placeholder="Search tables and views — Enter opens the first match" value={filter} onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && shown[0]) nav(`${base}/t/${encodeURIComponent(shown[0].name)}`); }} />
        <span className="muted small">{plural(nT, 'table')} · {plural(tables.length - nT, 'view')}</span>
        <button className="btn ghost icon sm" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">{loading ? <span className="spin" /> : Icons.refresh}</button>
      </div>
      {err && <div className="card danger">{err}</div>}
      {!err && !loading && tables.length === 0 && (
        <div className="card">
          <p><b>No tables.</b></p>
          <p className="muted small">Create one with "+ Table" by choosing columns and constraints, or restore a dump with "Run SQL script" on the server page.</p>
          <button className="btn primary" onClick={() => setCreating('table')}>+ Create table</button>
        </div>
      )}
      <div className="list">
        {shown.map((t) => (
          <div key={t.name} className="item">
            <div className="grow" style={{ cursor: 'pointer' }} onClick={() => nav(`${base}/t/${encodeURIComponent(t.name)}`)}>
              <div className="title mono">
                {t.name}
                {t.kind === 'view' && <span className="badge accent" style={{ marginLeft: 8 }}>View</span>}
                {t.store === 'memory' && <span className="badge accent" style={{ marginLeft: 8 }}>In-memory</span>}
                {t.store === 'timeseries' && <span className="badge accent" style={{ marginLeft: 8 }}>Time series</span>}
              </div>
              <div className="sub">
                {t.kind === 'view'
                  ? viewSelect(t.sql ?? '').replace(/\s+/g, ' ').slice(0, 120)
                  : <>{plural(t.columns?.length ?? 0, 'column')} · {plural((t.indexes ?? []).filter((i) => !i.auto).length, 'index', 'indexes')} · <CountText c={counts[t.name]} onExact={() => countExactly(t.name)} /> — {(t.columns ?? []).map((c) => c.name).join(', ')}</>}
              </div>
            </div>
            <button className="btn ghost icon sm danger" onClick={() => drop(t)} title="Delete" aria-label="Delete">{Icons.trash}</button>
            <span className="chev" onClick={() => nav(`${base}/t/${encodeURIComponent(t.name)}`)}>{Icons.chevron}</span>
          </div>
        ))}
      </div>
      <button className="fab" onClick={() => setCreating('table')} aria-label="Create table">+</button>
      {creating === 'table' && <CreateTableModal tables={tables} d={dialectOf(conn)} onClose={() => setCreating(null)} onCreate={create} />}
      {creating === 'view' && (
        <CreateViewModal d={dialectOf(conn)} onClose={() => setCreating(null)} onCreate={create}
          onPreview={async (s) => { const r = await goQuery(conn, s, undefined, { limit: 5 }); if (r.ok) setPreview(goRows(r.data)); else toast(errorText(r), 'err'); }} />
      )}
      {preview && <Modal title="Preview (5 rows)" onClose={() => setPreview(null)} wide><DataTable rows={preview} /></Modal>}
      {confirmEl}
    </>
  );
}
