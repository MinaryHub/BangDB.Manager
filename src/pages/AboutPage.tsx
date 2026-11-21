import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DEFAULT_ENDPOINTS, GO_KEYS, REST_KEYS } from '../api/endpoints';
import { APP_VERSION, PLATFORM_LABEL, REPO_URL, SPONSOR_URL, openExternal, platform, systemLine } from '../appinfo';
import { FeedbackModal } from '../components/Feedback';
import { AppIcon, Icons, KindBadge, KIND_STYLE } from '../components/kinds';
import type { ServerKind } from '../api/types';
import { MOD_KEY, TopBar } from '../components/Layout';
import type { FeedbackKind } from '../feedback';
import { LANGS, setLang, t, tx, useLang } from '../i18n';
import { setTheme, useTheme, type Theme } from '../theme';
import { applyUpdate, checkForUpdates, setAutoUpdate, useUpdate, type UpdateState } from '../update';

/** What the app does, for the About page (and the store listing screenshot of it). */
const FEATURES: { icon: JSX.Element; title: string; text: string }[] = [
  { icon: Icons.edit, title: tx('Spreadsheet-style editing'), text: tx('Edit cells in place, add and delete rows, and save everything in one transaction.') },
  { icon: Icons.code, title: tx('SQL console'), text: tx('A schema panel, run the statement at the cursor, EXPLAIN, parameters, history and exports.') },
  { icon: Icons.db, title: tx('Schema tools'), text: tx('Create tables and views, change columns and indexes, and read the DDL.') },
  { icon: Icons.copy, title: tx('Import, export and back up'), text: tx('CSV, JSON and SQL in and out, and full dumps that stay fast on big tables.') },
  { icon: Icons.server, title: tx('MongoDB and Redis'), text: tx('Collections, documents and aggregation; a key browser with an editor for every type.') },
  { icon: Icons.search, title: tx('Quick open'), text: tx('Jump to any table, server or page with Ctrl/⌘+K.') },
  { icon: Icons.globe, title: tx('Runs everywhere'), text: tx('Windows, macOS, Linux, Android and the browser — in English or Korean, light or dark.') },
  { icon: Icons.history, title: tx('Always up to date'), text: tx('Automatic updates, release notes and earlier versions in the version history.') }
];

export default function AboutPage() {
  const theme = useTheme();
  const lang = useLang();
  // the quick-open palette and the desktop Help menu can open the feedback form directly
  const initial = (useLocation().state as { feedback?: FeedbackKind } | null)?.feedback ?? null;
  const [feedback, setFeedback] = useState<FeedbackKind | null>(initial);
  return (
    <>
      <TopBar title={t('About')} />
      <div className="card about-hero">
        <AppIcon size={64} />
        <div className="grow">
          <h2>BangDB Manager</h2>
          <div className="tagline">{t('One app for seven databases — on your desktop, your phone and the web.')}</div>
          <div className="muted small">{t('Version {v}', { v: APP_VERSION })} · {t(PLATFORM_LABEL[platform()])} · {systemLine()}</div>
        </div>
      </div>

      <div className="card about-app">
        <b>{t('About BangDB Manager')}</b>
        <p>{t('BangDB Manager is a cross-platform database manager for BangDB, PostgreSQL, MySQL/MariaDB, SQL Server, SQLite, MongoDB and Redis. Browse and edit tables like a spreadsheet, run SQL, change schemas, and import, export and back up your data — with the same app on Windows, macOS, Linux, Android and the web.')}</p>
        <p>{t('The desktop app has a database gateway built in, so every supported database connects without installing anything else, and it can serve the app to phones on the same Wi-Fi. Connection details, including passwords, are stored only on this device.')}</p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature">
              <span className="fi">{f.icon}</span>
              <div><b>{t(f.title)}</b><span>{t(f.text)}</span></div>
            </div>
          ))}
        </div>
        <div className="supported">
          <span className="muted small">{t('Supported databases')}</span>
          <div className="kinds">
            {(['go', 'rest', 'postgres', 'mysql', 'mssql', 'sqlite', 'mongodb', 'redis'] as ServerKind[]).map((k) => (
              <span key={k} className="kindchip"><KindBadge kind={k} small />{KIND_STYLE[k].label}</span>
            ))}
          </div>
        </div>
      </div>

      <UpdatesCard />

      <div className="card">
        <b>{t('Help & feedback')}</b>
        <p className="muted small">{t("Questions, problems and ideas go to the project's GitHub Issues, where they are answered in public so others can find them too.")}</p>
        <div className="actions-grid">
          <button className="btn" onClick={() => setFeedback('bug')}>{Icons.bug}{t('Report a bug')}</button>
          <button className="btn" onClick={() => setFeedback('feature')}>{Icons.bulb}{t('Request a feature')}</button>
          <button className="btn" onClick={() => setFeedback('question')}>{Icons.help}{t('Ask a question')}</button>
          <button className="btn ghost" onClick={() => openExternal(`${REPO_URL}/issues`)}>{Icons.github}{t('Browse issues')}</button>
        </div>
      </div>

      <div className="card sponsor">
        <div className="row wrap">
          <span className="heart">{Icons.heart}</span>
          <div className="grow" style={{ minWidth: 200 }}>
            <b>{t('Support development')}</b>
            <p className="muted small" style={{ margin: '2px 0 0' }}>{t('BangDB Manager is free. If it saves you time, you can sponsor its development on GitHub Sponsors.')}</p>
          </div>
          <button className="btn primary sponsor-btn" onClick={() => openExternal(SPONSOR_URL)}>{Icons.heart}{t('Sponsor')}</button>
        </div>
      </div>

      <div className="card">
        <b>{t('Appearance')}</b>
        <div className="settings-grid">
          <span className="small">{t('Theme')}</span>
          <div className="seg" role="radiogroup" aria-label={t('Theme')}>
            {([['auto', tx('System')], ['light', tx('Light')], ['dark', tx('Dark')]] as [Theme, string][]).map(([th, l]) => (
              <button key={th} role="radio" aria-checked={theme === th} className={theme === th ? 'on' : ''} onClick={() => setTheme(th)}>{t(l)}</button>
            ))}
          </div>
          <span className="small">Language · 언어</span>
          <div className="seg" role="radiogroup" aria-label="Language · 언어">
            {LANGS.map((l) => (
              <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => void setLang(l.id)}>{l.label}</button>
            ))}
          </div>
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>{t('Saved on this device.')}</p>
      </div>
      <div className="card">
        <b>{t('Keyboard shortcuts')}</b>
        <div className="shortcuts small">
          {([
            [[MOD_KEY, 'K'], tx('Quick open — jump to a server, table or page')],
            [['/'], tx('Focus the quick search of a table')],
            [[MOD_KEY, 'S'], tx('Save pending grid changes')],
            [['Enter', 'Tab', 'Esc'], tx('In a grid cell: next row · next cell · cancel')],
            [[MOD_KEY, 'Enter'], tx('SQL console: run the selection or everything')],
            [[MOD_KEY, 'Shift', 'Enter'], tx('SQL console: run the statement at the cursor')],
            [['Tab', 'Shift+Tab'], tx('SQL console: indent / outdent')]
          ] as [string[], string][]).map(([keys, what]) => (
            <div key={what} className="sc"><span className="keys">{keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span><span>{t(what)}</span></div>
          ))}
        </div>
      </div>
      <div className="card">
        <b>{t('Install on a phone')}</b>
        <ul className="small">
          <li>{t('Android Chrome: Menu → "Add to Home Screen" (PWA), or the APK from the releases page')}</li>
          <li>{t('iOS Safari: Share → "Add to Home Screen"')}</li>
          <li>{t('Desktop app on Windows / macOS / Linux: Server menu → "Allow phone access" serves the app to phones on the same network')}</li>
        </ul>
      </div>
      <details className="card">
        <summary><b style={{ display: 'inline' }}>{t('Endpoints (defaults)')}</b></summary>
        <div className="tablewrap" style={{ marginTop: 8 }}>
          <table className="data">
            <thead><tr><th>{t('Key')}</th><th>{t('Method')}</th><th>{t('Path')}</th><th>{t('Verified')}</th></tr></thead>
            <tbody>
              {[...GO_KEYS, ...REST_KEYS].map((k) => {
                const e = DEFAULT_ENDPOINTS[k];
                return <tr key={k}><td className="mono">{k}</td><td>{e.method}</td><td className="mono">{e.path}</td><td>{GO_KEYS.includes(k) ? 'Go' : e.verified ? <span className="ok">✔</span> : <span className="warn">{t('unverified')}</span>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">{t('"unverified" entries can be changed under Edit connection → Advanced.')}</p>
      </details>
      {feedback && <FeedbackModal kind={feedback} onClose={() => setFeedback(null)} />}
    </>
  );
}

const MODE_TEXT: Record<UpdateState['mode'], string> = {
  pwa: tx('New builds are fetched in the background; reload to switch to them.'),
  store: tx('New releases on GitHub are announced here; download and install the new package to update.'),
  'desktop-auto': tx('Updates download in the background and install when you restart the app.'),
  'desktop-notify': tx('This build cannot install updates by itself (unsigned macOS / deb); new releases are announced with a download link.'),
  off: tx('Automatic updates are not available in this build.')
};

function statusText(u: UpdateState): string {
  switch (u.status) {
    case 'checking': return t('Checking for updates…');
    case 'none': return u.checkedAt ? t("You're up to date · checked {time}", { time: new Date(u.checkedAt).toLocaleTimeString() }) : t("You're up to date");
    case 'available': return t('Version {v} is available', { v: u.version });
    case 'downloading': return t('Downloading {v}… {percent}%', { v: u.version ?? '', percent: u.percent ?? 0 });
    case 'ready': return u.version ? t('Version {v} is ready to install', { v: u.version }) : t('A new version is ready to install');
    case 'error': return t('Update check failed: {error}', { error: u.error ?? '' });
    case 'unsupported': return u.mode === 'pwa' ? t('Updates come from the server this app is opened from (no service worker here).') : t('Automatic updates are off in this build.');
    default: return u.auto ? t('Checks automatically') : t('Automatic checks are off');
  }
}

function UpdatesCard() {
  const u = useUpdate();
  const busy = u.status === 'checking' || u.status === 'downloading';
  return (
    <div className="card">
      <div className="row wrap" style={{ marginBottom: 6 }}>
        <b className="grow" style={{ margin: 0, whiteSpace: 'nowrap' }}>{t('Updates')}</b>
        <Link className="btn sm ghost" to="/about/versions">{Icons.history}{t('Version history')}</Link>
        <button className="btn sm" disabled={busy || u.mode === 'off'} onClick={() => void checkForUpdates()}>{busy ? <span className="spin" /> : Icons.refresh}{t('Check for updates')}</button>
      </div>
      <div className={`update-status ${u.status}`}>
        <span className="dot" />
        <span className="grow">{statusText(u)}</span>
        {u.status === 'ready' && <button className="btn sm primary" onClick={() => void applyUpdate()}>{u.mode === 'pwa' ? t('Reload now') : t('Restart now')}</button>}
        {u.status === 'available' && u.url && <button className="btn sm primary" onClick={() => openExternal(u.url!)}>{t('Download')}</button>}
      </div>
      {u.status === 'downloading' && <div className="progress"><div style={{ width: `${u.percent ?? 0}%` }} /></div>}
      <label className="check" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={u.auto} disabled={u.mode === 'off'} onChange={(e) => void setAutoUpdate(e.target.checked)} />
        {t('Check for updates automatically')}
      </label>
      <p className="muted small" style={{ margin: '4px 0 0' }}>{t(MODE_TEXT[u.mode])}</p>
    </div>
  );
}
