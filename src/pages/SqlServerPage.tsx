import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dialectOf, type Maintenance } from '../api/dialect';
import { gw, gwDatabases, gwStats, type DatabaseInfo } from '../api/gateway';
import { dumpSql, errorText, goQuery, goRows, goTables } from '../api/goapi';
import { downloadText } from '../api/data';
import type { Connection } from '../api/types';
import { TopBar } from '../components/Layout';
import { DataTable, JsonOut, Modal, useConfirm, usePrompt, useToast } from '../components/ui';
import { fmtBytes, kindLabel } from './ConnectionsPage';
import { ScriptModal } from './GoServerPage';
import { t } from '../i18n';

/** Overview of a PostgreSQL / MySQL / SQL Server / SQLite server reached through the gateway. */
export default function SqlServerPage({ conn }: { conn: Connection }) {
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, confirmEl } = useConfirm();
  const { prompt, promptEl } = usePrompt();
  const d = dialectOf(conn);
  const [dbs, setDbs] = useState<DatabaseInfo[] | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState('');
  const [showSys, setShowSys] = useState(false);
  const [target, setTarget] = useState(conn.defaultDb);
  const [busy, setBusy] = useState('');
  const [script, setScript] = useState(false);
  const [result, setResult] = useState<{ title: string; rows: Record<string, unknown>[] } | null>(null);
  const on = useMemo(() => (conn.kind === 'sqlite' || !target ? conn : { ...conn, db: { ...conn.db, database: target } }), [conn, target]);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([gwDatabases(conn), gwStats(conn)]);
    if (!a.ok) { setErr(errorText(a)); return; }
    setErr('');
    setDbs(a.data.databases);
    if (b.ok) setStats(b.data);
  }, [conn]);
  useEffect(() => { load(); }, [load]);

  const open = (name: string) => nav(`/c/${conn.id}/db/${encodeURIComponent(name)}`);
  const shown = (dbs ?? []).filter((x) => showSys || !x.system || x.name === conn.defaultDb);
  const scalar = Object.entries(stats ?? {}).filter(([k, v]) => k !== 'version' && (typeof v === 'number' || (typeof v === 'string' && v.length < 40)));

  async function runMaintenance(m: Maintenance) {
    if (m.confirm && !(await confirm(t('Run {op} on {db}? Large databases take a while and may be locked meanwhile.', { op: m.label, db: target }), t('Run')))) return;
    setBusy(m.label);
    try {
      let stmts: string[];
      if (typeof m.sql === 'function') {
        const tl = await goTables(on);
        if (!tl.ok) throw new Error(errorText(tl));
        stmts = m.sql(tl.data.tables.filter((x) => x.kind === 'table').map((x) => x.name));
        if (!stmts.length) { toast(t('No tables')); return; }
      } else stmts = [m.sql];
      // one statement per request, outside a transaction: VACUUM, DBCC and CREATE/DROP DATABASE refuse to run inside one
      const rows: Record<string, unknown>[] = [];
      for (const s of stmts) {
        const r = await goQuery(on, s, undefined, { mode: 'exec' });
        if (!r.ok) throw new Error(errorText(r));
        rows.push(...goRows(r.data));
      }
      toast(t('{op} complete', { op: m.label }), 'ok');
      if (rows.length) setResult({ title: m.label, rows });
    } catch (e) { toast(t('{label} failed: {error}', { label: m.label, error: (e as Error).message }), 'err'); } finally { setBusy(''); }
  }

  return (
    <>
      <TopBar title={conn.name} crumbs={[{ to: '/connections', label: t('Servers') }, { label: kindLabel(conn.kind) }]}
        right={<button className="btn sm" onClick={load}>{t('Refresh')}</button>} />
      {err && <div className="card danger">{err} — {t('Check the connection settings (address, credentials, gateway).')}</div>}
      {stats?.version !== undefined && <p className="muted small mono" style={{ whiteSpace: 'pre-wrap' }}>{String(stats.version).split('\n')[0]}</p>}

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <b className="grow">{conn.kind === 'sqlite' ? t('Database file') : t('Databases ({n})', { n: shown.length })}</b>
          {(dbs ?? []).some((x) => x.system) && <label className="check small" style={{ margin: 0 }}><input type="checkbox" checked={showSys} onChange={(e) => setShowSys(e.target.checked)} /> {t('System DBs')}</label>}
          {d.createDatabase && <button className="btn sm" onClick={async () => {
            const name = await prompt(t('Create database'), t('Name'));
            if (!name) return;
            const r = await goQuery(conn, d.createDatabase!(name), undefined, { mode: 'exec' });
            if (r.ok) { toast(t('"{name}" created', { name }), 'ok'); load(); } else toast(t('Failed: {error}', { error: errorText(r) }), 'err');
          }}>{t('+ DB')}</button>}
        </div>
        <div className="list">
          {shown.map((x) => (
            <div key={x.name} className="item">
              <div className="grow" style={{ cursor: 'pointer' }} onClick={() => open(x.name)}>
                <div className="title mono">{conn.kind === 'sqlite' ? conn.db?.file : x.name}{x.name === conn.defaultDb && conn.kind !== 'sqlite' && <span className="badge" style={{ marginLeft: 8 }}>{t('Default')}</span>}{x.system && <span className="badge" style={{ marginLeft: 8 }}>{t('System')}</span>}</div>
                <div className="sub">{fmtBytes(x.size ?? (conn.kind === 'sqlite' ? Number(stats?.size) : undefined)) || ' '}</div>
              </div>
              <button className="btn sm" onClick={() => nav(`/c/${conn.id}/db/${encodeURIComponent(x.name)}/query`)}>SQL</button>
              {d.dropDatabase && !x.system && <button className="btn sm danger" onClick={async () => {
                if (!(await confirm(t('Drop database "{name}". All tables and data will be lost.', { name: x.name })))) return;
                const other = conn.db?.database === x.name ? { ...conn, db: { ...conn.db, database: d.id === 'postgres' ? 'postgres' : d.id === 'mssql' ? 'master' : '' } } : conn;
                await gw(conn, 'disconnect', { database: x.name }); // the gateway's own sessions would block the DROP
                const r = await goQuery(other, d.dropDatabase!(x.name), undefined, { mode: 'exec' });
                if (r.ok) { toast(t('"{name}" deleted', { name: x.name }), 'ok'); load(); } else toast(t('Failed: {error}', { error: errorText(r) }), 'err');
              }}>DROP</button>}
            </div>
          ))}
          {dbs && !shown.length && <div className="muted small">{t('No databases')}</div>}
        </div>
      </div>

      {scalar.length > 0 && (
        <div className="stats">
          {scalar.map(([k, v]) => <div key={k} className="stat"><div className="k">{k}</div><div className="v" style={{ fontSize: 15 }}>{/size$/i.test(k) && v !== '' && !isNaN(Number(v)) ? fmtBytes(Number(v)) : typeof v === 'number' ? v.toLocaleString() : String(v)}</div></div>)}
        </div>
      )}

      <div className="card">
        <div className="row wrap">
          <b className="grow">{t('Target database')}</b>
          {conn.kind !== 'sqlite' && (
            <select className="inp" value={target} onChange={(e) => setTarget(e.target.value)}>
              {(dbs ?? [{ name: conn.defaultDb }]).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          )}
        </div>
        <p className="muted small">{t('A dump writes table definitions, indexes and rows plus all views into one SQL script (ordered by foreign keys). Restore it on a database of the same kind with "Run SQL script".')}</p>
        <div className="row wrap">
          <button className="btn" disabled={!!busy} onClick={async () => {
            setBusy(t('Dumping…'));
            try {
              downloadText(`${(target || conn.name).replace(/[^\p{L}\p{N}._-]+/gu, '_')}-${new Date().toISOString().slice(0, 10)}.sql`, await dumpSql(on, (m) => setBusy(m)), 'application/sql');
              toast(t('Dump complete'), 'ok');
            } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
          }}>{busy && !d.maintenance.some((m) => m.label === busy) ? busy : t('Dump (.sql)')}</button>
          <button className="btn" onClick={() => setScript(true)}>{t('Run SQL script / restore')}</button>
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          {d.maintenance.map((m) => (
            <div key={m.label} className="item">
              <div className="grow"><div className="title">{m.label}</div><div className="sub">{t(m.desc)}</div></div>
              <button className="btn sm" disabled={!!busy} onClick={() => runMaintenance(m)}>{busy === m.label ? '…' : t('Run')}</button>
            </div>
          ))}
        </div>
      </div>

      <details className="adv">
        <summary>{t('Raw info')}</summary>
        <JsonOut value={stats ?? {}} />
      </details>
      {script && <ScriptModal conn={on} onClose={() => setScript(false)} />}
      {result && <Modal title={result.title} onClose={() => setResult(null)} wide><DataTable rows={result.rows} /></Modal>}
      {confirmEl}{promptEl}
    </>
  );
}
