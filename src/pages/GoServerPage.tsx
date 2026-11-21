import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyze, dumpSql, errorText, goHealth, goStats, runScript, splitSql, vacuum, type ScriptProgress } from '../api/goapi';
import { downloadText } from '../api/data';
import type { ApiResult, Connection } from '../api/types';
import { TopBar } from '../components/Layout';
import { JsonOut, Modal, useConfirm, useToast } from '../components/ui';
import { t, tp } from '../i18n';

interface Stats {
  version?: string; tables?: number; views?: number; seq?: number;
  db?: Record<string, number>;
  api?: { requests: number; rejected: number; statements: number; errors: number };
}

/** Overview and maintenance of one knoxxr/bangdb server (one database file). */
export default function GoServerPage({ conn }: { conn: Connection }) {
  const nav = useNavigate();
  const toast = useToast();
  const { confirm, confirmEl } = useConfirm();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [script, setScript] = useState(false);
  const base = `/c/${conn.id}/db/${encodeURIComponent(conn.defaultDb)}`;

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([goHealth(conn), goStats(conn)]);
    if (!s.ok) { setErr(errorText(s)); return; }
    setErr('');
    setStats({ ...(s.data as Stats), version: (s.data as Stats).version ?? h.data?.version });
  }, [conn]);
  useEffect(() => { load(); }, [load]);

  const d = stats?.db ?? {};
  const hit = d.PageReads + d.PageCacheHits > 0 ? (d.PageCacheHits / (d.PageReads + d.PageCacheHits)) * 100 : undefined;
  const nodeHit = d.NodeHits + d.NodeMisses > 0 ? (d.NodeHits / (d.NodeHits + d.NodeMisses)) * 100 : undefined;
  const tiles: [string, string | number | undefined][] = [
    [t('Tables'), stats?.tables], [t('Views'), stats?.views], [t('Commits'), d.Commits], [t('Statements / errors'), d.Statements !== undefined ? `${d.Statements} / ${d.Errors}` : undefined],
    [t('Slow queries'), d.SlowQueries], [t('WAL pages'), d.WALPages], [t('Checkpoints'), d.Checkpoints], [t('Page count'), d.PageCount],
    [t('Page cache hits'), hit === undefined ? '-' : `${hit.toFixed(1)}%`], [t('Node cache hits'), nodeHit === undefined ? '-' : `${nodeHit.toFixed(1)}%`],
    [t('Open snapshots'), d.Snapshots], [t('Write-lock waits'), d.LockWaits], [t('API requests'), stats?.api?.requests], [t('Auth rejected'), stats?.api?.rejected]
  ];

  async function act(label: string, fn: () => Promise<ApiResult>, ok: string) {
    setBusy(label);
    const r = await fn();
    setBusy('');
    toast(r.ok ? ok : t('{label} failed: {error}', { label, error: errorText(r) }), r.ok ? 'ok' : 'err');
    load();
  }

  return (
    <>
      <TopBar title={conn.name} crumbs={[{ to: '/connections', label: t('Servers') }, { label: 'BangDB (Go)' }]}
        right={<button className="btn sm" onClick={load}>{t('Refresh')}</button>} />
      {err && <div className="card danger">{err} — {t('Check the server connection settings (address, password).')}</div>}
      <div className="row wrap" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={() => nav(base)}>{t('Open tables')}</button>
        <button className="btn" onClick={() => nav(`${base}/query`)}>{t('SQL console')}</button>
      </div>
      {stats && <p className="muted small mono">{stats.version}</p>}
      <div className="stats">
        {tiles.map(([k, v]) => <div key={k} className="stat"><div className="k">{k}</div><div className="v">{v === undefined ? '…' : typeof v === 'number' ? v.toLocaleString() : v}</div></div>)}
      </div>

      <div className="card">
        <b>{t('Backup & migration')}</b>
        <p className="muted small">{t('A dump writes every table definition, index and row plus all views into one SQL script (ordered by foreign keys). Run script executes a BangDB/SQLite dump in batches.')}</p>
        <div className="row wrap">
          <button className="btn" disabled={!!busy} onClick={async () => {
            setBusy(t('Dumping…'));
            try {
              const sql = await dumpSql(conn, (m) => setBusy(m));
              downloadText(`${conn.name.replace(/[^\p{L}\p{N}._-]+/gu, '_')}-${new Date().toISOString().slice(0, 10)}.sql`, sql, 'application/sql');
              toast(t('Dump complete'), 'ok');
            } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(''); }
          }}>{busy && busy !== 'VACUUM' && busy !== 'ANALYZE' ? busy : t('Full dump (.sql)')}</button>
          <button className="btn" onClick={() => setScript(true)}>{t('Run SQL script / restore')}</button>
        </div>
      </div>

      <div className="card">
        <b>{t('Maintenance')}</b>
        <div className="list" style={{ marginTop: 8 }}>
          <div className="item">
            <div className="grow"><div className="title">ANALYZE</div><div className="sub">{t('Collects index statistics to improve join order and index selection')}</div></div>
            <button className="btn sm" disabled={!!busy} onClick={() => act('ANALYZE', () => analyze(conn), t('ANALYZE complete'))}>{t('Run')}</button>
          </div>
          <div className="item">
            <div className="grow"><div className="title">VACUUM</div><div className="sub">{t('Rebuilds the file to reclaim space freed by deletes (writes wait until it finishes)')}</div></div>
            <button className="btn sm" disabled={!!busy} onClick={async () => { if (await confirm(t('Run VACUUM? Large databases take a while, and writes wait in the meantime.'), t('Run'))) act('VACUUM', () => vacuum(conn), t('VACUUM complete')); }}>{t('Run')}</button>
          </div>
        </div>
      </div>

      <details className="adv">
        <summary>{t('Raw stats (GET /v1/stats)')}</summary>
        <JsonOut value={stats ?? {}} />
      </details>
      <p className="muted small">{t('Features not exposed by the HTTP API (online backup file, replication, encryption keys, integrity check) are available through the bangdb CLI on the server (.backup, .check, -replica-of).')}</p>
      {script && <ScriptModal conn={conn} onClose={() => { setScript(false); load(); }} />}
      {confirmEl}
    </>
  );
}

export function ScriptModal({ conn, onClose }: { conn: Connection; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [prog, setProg] = useState<(ScriptProgress & { running: boolean }) | null>(null);
  const stop = useRef(false);
  const n = text.trim() ? splitSql(text).length : 0;
  return (
    <Modal title={t('Run SQL script')} onClose={() => !prog?.running && onClose()} wide>
      <p className="muted small">{t('Semicolon-separated statements are grouped into batches of about 256KB, each run in one transaction. PRAGMA / BEGIN / COMMIT from a SQLite .dump are skipped. On failure only that batch is rolled back and execution stops.')}</p>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <label className="btn sm">{t('Choose file')}<input type="file" accept=".sql,.txt" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setText(await f.text()); }} /></label>
        <span className="small muted">{n ? `${tp(n, '{n} statement', '{n} statements')} · ${(text.length / 1024).toFixed(0)} KB` : ''}</span>
      </div>
      <textarea className="inp mono" style={{ width: '100%', minHeight: 200 }} value={text.length > 200000 ? `${text.slice(0, 200000)}\n-- … ${t('(preview shows only the first 200KB)')}` : text} readOnly={text.length > 200000}
        spellCheck={false} onChange={(e) => setText(e.target.value)} placeholder="CREATE TABLE ...; INSERT INTO ...;" />
      {prog && <div className="progress"><div style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%`, background: prog.error ? 'var(--warn)' : undefined }} /></div>}
      {prog && <p className="small">{t('{done}/{total} statements run', { done: prog.done.toLocaleString(), total: prog.total.toLocaleString() })}</p>}
      {prog?.error && <pre className="out danger">{prog.error}{prog.failedSql ? `\n\n${prog.failedSql}` : ''}</pre>}
      <div className="actions">
        {prog?.running && <button className="btn" onClick={() => { stop.current = true; }}>{t('Stop')}</button>}
        <span className="grow" />
        <button className="btn" disabled={prog?.running} onClick={onClose}>{t('Close')}</button>
        <button className="btn primary" disabled={!n || prog?.running} onClick={async () => {
          stop.current = false;
          setProg({ done: 0, total: n, running: true });
          const p = await runScript(conn, text, (x) => setProg({ ...x, running: true }), 256 * 1024, () => stop.current);
          setProg({ ...p, running: false });
          toast(p.error ? t('Error while running the script') : tp(p.done, '{n} statement run', '{n} statements run'), p.error ? 'err' : 'ok');
        }}>{t('Run')}</button>
      </div>
    </Modal>
  );
}
