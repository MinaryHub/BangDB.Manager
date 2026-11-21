import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import changelogMd from '../../CHANGELOG.md?raw';
import { parseChangelog, releaseNotes } from '../api/changelog';
import { APP_VERSION, RELEASES_URL, openExternal, platform } from '../appinfo';
import { Icons } from '../components/kinds';
import { TopBar } from '../components/Layout';
import { Markdown } from '../components/Markdown';
import { t, tp } from '../i18n';
import { checkForUpdates, compareVersions, downloadFor, fetchReleases, useUpdate, type Release } from '../update';

interface Row {
  version: string;
  title: string;
  date?: string;
  notes: string;
  release?: Release;
}

const size = (n?: number) => (n === undefined ? '' : n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/**
 * Version history: the notes bundled with this build (CHANGELOG.md, works
 * offline) merged with the GitHub releases (newer versions, dates and the
 * download files of every version — to install an older one again).
 */
export default function VersionsPage() {
  const loc = useLocation();
  const u = useUpdate();
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [err, setErr] = useState('');
  const local = useMemo(() => parseChangelog(changelogMd), []);

  useEffect(() => {
    let alive = true;
    fetchReleases(50).then((r) => { if (alive) setReleases(r); }).catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo((): Row[] => {
    const by = new Map<string, Row>();
    for (const e of local) if (e.version) by.set(e.version, { version: e.version, title: e.title, date: e.date, notes: e.body });
    for (const r of releases ?? []) {
      const v = r.tag_name.replace(/^v/, '');
      const have = by.get(v);
      const date = r.published_at?.slice(0, 10);
      if (have) by.set(v, { ...have, date: have.date ?? date, release: r });
      else by.set(v, { version: v, title: (r.name ?? '').replace(/^BangDB Manager\s*v?[\d.]+\s*[—–-]?\s*/i, ''), date, notes: releaseNotes(r.body ?? '', v), release: r });
    }
    return [...by.values()].sort((a, b) => compareVersions(b.version, a.version));
  }, [local, releases]);

  // changes in this build that are not in a release yet
  const unreleased = local.find((e) => !e.version && local.indexOf(e) === 0 && !rows.some((r) => r.version === APP_VERSION));

  useEffect(() => {
    if (!loc.hash) return;
    const el = document.getElementById(decodeURIComponent(loc.hash.slice(1)));
    el?.scrollIntoView({ block: 'start' });
  }, [loc.hash, rows.length]);

  const p = platform();
  return (
    <>
      <TopBar title={t('Version history')} crumbs={[{ to: '/about', label: t('About') }]}
        right={<>
          <button className="btn sm" onClick={() => void checkForUpdates()} disabled={u.status === 'checking'}>{u.status === 'checking' ? <span className="spin" /> : Icons.refresh}{t('Check for updates')}</button>
          <button className="btn sm ghost" onClick={() => openExternal(RELEASES_URL)}>{Icons.github}<span className="hide-narrow">{t('Releases')}</span></button>
        </>} />
      <p className="muted small">{t('You have {v}.', { v: APP_VERSION })} {releases ? tp(releases.length, '{n} release on GitHub.', '{n} releases on GitHub.') : err ? t('Could not reach GitHub ({error}) — showing the notes bundled with this build.', { error: err }) : t('Loading releases from GitHub…')}</p>
      {unreleased && (
        <div className="card version">
          <div className="vhead"><h3>{t('This build')}</h3><span className="badge accent">{t('Installed')} · {APP_VERSION}</span></div>
          <div className="vtitle">{unreleased.title}</div>
          <Markdown text={unreleased.body} />
        </div>
      )}
      <div className="versions">
        {rows.map((r) => {
          const cmp = compareVersions(r.version, APP_VERSION);
          const files = (r.release?.assets ?? []).filter((a) => !/\.(blockmap|ya?ml)$/i.test(a.name));
          const mine = r.release ? downloadFor(r.release, p) : undefined;
          return (
            <div key={r.version} id={`v${r.version}`} className={`card version${cmp === 0 ? ' current' : ''}`}>
              <div className="vhead">
                <h3>v{r.version}</h3>
                {cmp === 0 && <span className="badge accent">{t('Installed')}</span>}
                {cmp > 0 && <span className="badge ok">{t('New')}</span>}
                {r.release?.prerelease && <span className="badge warn">{t('Pre-release')}</span>}
                <span className="grow" />
                {r.date && <span className="muted small">{r.date}</span>}
              </div>
              {r.title && <div className="vtitle">{r.title}</div>}
              {r.notes ? <Markdown text={r.notes} /> : <p className="muted small">{t('No notes for this version.')}</p>}
              {r.release && (
                <div className="row wrap" style={{ marginTop: 8 }}>
                  {cmp !== 0 && mine && mine !== r.release.html_url && (
                    <button className={`btn sm${cmp > 0 ? ' primary' : ''}`} onClick={() => openExternal(mine)}>{cmp > 0 ? t('Download update') : t('Install this version')}</button>
                  )}
                  <button className="btn sm ghost" onClick={() => openExternal(r.release!.html_url)}>{Icons.external}{t('Release page')}</button>
                  {files.length > 0 && (
                    <details className="files">
                      <summary className="small">{tp(files.length, '{n} file', '{n} files')}</summary>
                      <ul className="small">
                        {files.map((a) => <li key={a.name}><a href={a.browser_download_url} target="_blank" rel="noopener noreferrer">{a.name}</a> <span className="muted">{size(a.size)}</span></li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
