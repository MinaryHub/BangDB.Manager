import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DEFAULT_ENDPOINTS, GO_KEYS, REST_KEYS } from '../api/endpoints';
import { APP_VERSION, PLATFORM_LABEL, REPO_URL, SPONSOR_URL, openExternal, platform, systemLine } from '../appinfo';
import { FeedbackModal } from '../components/Feedback';
import { Icons } from '../components/kinds';
import { MOD_KEY, TopBar } from '../components/Layout';
import type { FeedbackKind } from '../feedback';
import { setTheme, useTheme, type Theme } from '../theme';
import { applyUpdate, checkForUpdates, setAutoUpdate, useUpdate, type UpdateState } from '../update';

export default function AboutPage() {
  const theme = useTheme();
  // the quick-open palette and the desktop Help menu can open the feedback form directly
  const initial = (useLocation().state as { feedback?: FeedbackKind } | null)?.feedback ?? null;
  const [feedback, setFeedback] = useState<FeedbackKind | null>(initial);
  return (
    <>
      <TopBar title="About" />
      <div className="card about-hero">
        <span className="mark">{Icons.logo}</span>
        <div className="grow">
          <h2>BangDB Manager</h2>
          <div className="muted small">Version {APP_VERSION} · {PLATFORM_LABEL[platform()]} · {systemLine()}</div>
          <p className="small" style={{ margin: '8px 0 0' }}>Manage BangDB, PostgreSQL, MySQL/MariaDB, SQL Server, SQLite, MongoDB and Redis from one app on Windows, macOS, Linux, Android and the web. Connection details stay on this device.</p>
        </div>
      </div>

      <UpdatesCard />

      <div className="card">
        <b>Help &amp; feedback</b>
        <p className="muted small">Questions, problems and ideas go to the project's GitHub Issues, where they are answered in public so others can find them too.</p>
        <div className="actions-grid">
          <button className="btn" onClick={() => setFeedback('bug')}>{Icons.bug}Report a bug</button>
          <button className="btn" onClick={() => setFeedback('feature')}>{Icons.bulb}Request a feature</button>
          <button className="btn" onClick={() => setFeedback('question')}>{Icons.help}Ask a question</button>
          <button className="btn ghost" onClick={() => openExternal(`${REPO_URL}/issues`)}>{Icons.github}Browse issues</button>
        </div>
      </div>

      <div className="card sponsor">
        <div className="row wrap">
          <span className="heart">{Icons.heart}</span>
          <div className="grow" style={{ minWidth: 200 }}>
            <b>Support development</b>
            <p className="muted small" style={{ margin: '2px 0 0' }}>BangDB Manager is free. If it saves you time, you can sponsor its development on GitHub Sponsors.</p>
          </div>
          <button className="btn primary sponsor-btn" onClick={() => openExternal(SPONSOR_URL)}>{Icons.heart}Sponsor</button>
        </div>
      </div>

      <div className="card">
        <b>Appearance</b>
        <div className="row wrap">
          <div className="seg" role="radiogroup" aria-label="Theme">
            {([['auto', 'System'], ['light', 'Light'], ['dark', 'Dark']] as [Theme, string][]).map(([t, l]) => (
              <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{l}</button>
            ))}
          </div>
          <span className="muted small">Saved on this device.</span>
        </div>
      </div>
      <div className="card">
        <b>Keyboard shortcuts</b>
        <div className="shortcuts small">
          {([
            [[MOD_KEY, 'K'], 'Quick open — jump to a server, table or page'],
            [['/'], 'Focus the quick search of a table'],
            [[MOD_KEY, 'S'], 'Save pending grid changes'],
            [['Enter', 'Tab', 'Esc'], 'In a grid cell: next row · next cell · cancel'],
            [[MOD_KEY, 'Enter'], 'SQL console: run the selection or everything'],
            [[MOD_KEY, 'Shift', 'Enter'], 'SQL console: run the statement at the cursor'],
            [['Tab', 'Shift+Tab'], 'SQL console: indent / outdent']
          ] as [string[], string][]).map(([keys, what]) => (
            <div key={what} className="sc"><span className="keys">{keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span><span>{what}</span></div>
          ))}
        </div>
      </div>
      <div className="card">
        <b>Install on a phone</b>
        <ul className="small">
          <li>Android Chrome: Menu → "Add to Home Screen" (PWA), or the APK from the releases page</li>
          <li>iOS Safari: Share → "Add to Home Screen"</li>
          <li>Desktop app on Windows / macOS / Linux: Server menu → "Allow phone access" serves the app to phones on the same network</li>
        </ul>
      </div>
      <details className="card">
        <summary><b style={{ display: 'inline' }}>Endpoints (defaults)</b></summary>
        <div className="tablewrap" style={{ marginTop: 8 }}>
          <table className="data">
            <thead><tr><th>Key</th><th>Method</th><th>Path</th><th>Verified</th></tr></thead>
            <tbody>
              {[...GO_KEYS, ...REST_KEYS].map((k) => {
                const e = DEFAULT_ENDPOINTS[k];
                return <tr key={k}><td className="mono">{k}</td><td>{e.method}</td><td className="mono">{e.path}</td><td>{GO_KEYS.includes(k) ? 'Go' : e.verified ? <span className="ok">✔</span> : <span className="warn">unverified</span>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">"unverified" entries can be changed under Edit connection → Advanced.</p>
      </details>
      {feedback && <FeedbackModal kind={feedback} onClose={() => setFeedback(null)} />}
    </>
  );
}

const MODE_TEXT: Record<UpdateState['mode'], string> = {
  pwa: 'New builds are fetched in the background; reload to switch to them.',
  store: 'New releases on GitHub are announced here; download and install the new package to update.',
  'desktop-auto': 'Updates download in the background and install when you restart the app.',
  'desktop-notify': 'This build cannot install updates by itself (unsigned macOS / deb); new releases are announced with a download link.',
  off: 'Automatic updates are not available in this build.'
};

function statusText(u: UpdateState): string {
  switch (u.status) {
    case 'checking': return 'Checking for updates…';
    case 'none': return `You're up to date${u.checkedAt ? ` · checked ${new Date(u.checkedAt).toLocaleTimeString()}` : ''}`;
    case 'available': return `Version ${u.version} is available`;
    case 'downloading': return `Downloading ${u.version ?? 'update'}… ${u.percent ?? 0}%`;
    case 'ready': return `${u.version ? `Version ${u.version}` : 'A new version'} is ready to install`;
    case 'error': return `Update check failed: ${u.error ?? 'unknown error'}`;
    case 'unsupported': return u.mode === 'pwa' ? 'Updates come from the server this app is opened from (no service worker here).' : 'Automatic updates are off in this build.';
    default: return u.auto ? 'Checks automatically' : 'Automatic checks are off';
  }
}

function UpdatesCard() {
  const u = useUpdate();
  const busy = u.status === 'checking' || u.status === 'downloading';
  return (
    <div className="card">
      <div className="row wrap" style={{ marginBottom: 6 }}>
        <b className="grow" style={{ margin: 0 }}>Updates</b>
        <Link className="btn sm ghost" to="/about/versions">{Icons.history}Version history</Link>
        <button className="btn sm" disabled={busy || u.mode === 'off'} onClick={() => void checkForUpdates()}>{busy ? <span className="spin" /> : Icons.refresh}Check for updates</button>
      </div>
      <div className={`update-status ${u.status}`}>
        <span className="dot" />
        <span className="grow">{statusText(u)}</span>
        {u.status === 'ready' && <button className="btn sm primary" onClick={() => void applyUpdate()}>{u.mode === 'pwa' ? 'Reload now' : 'Restart now'}</button>}
        {u.status === 'available' && u.url && <button className="btn sm primary" onClick={() => openExternal(u.url!)}>Download</button>}
      </div>
      {u.status === 'downloading' && <div className="progress"><div style={{ width: `${u.percent ?? 0}%` }} /></div>}
      <label className="check" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={u.auto} disabled={u.mode === 'off'} onChange={(e) => void setAutoUpdate(e.target.checked)} />
        Check for updates automatically
      </label>
      <p className="muted small" style={{ margin: '4px 0 0' }}>{MODE_TEXT[u.mode]}</p>
    </div>
  );
}
