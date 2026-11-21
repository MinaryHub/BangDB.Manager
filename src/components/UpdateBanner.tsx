import { Link } from 'react-router-dom';
import { APP_VERSION, openExternal } from '../appinfo';
import { applyUpdate, dismissUpdateBar, dismissUpdatedNotice, skipVersion, useUpdate } from '../update';
import { Icons } from './kinds';

/**
 * The bar at the top of the app for update news (state from src/update.ts):
 *  - an update is ready (web: reload, desktop: restart)
 *  - a newer release exists (phones, macOS / deb desktop builds): download
 *  - the app was just updated: what's new
 */
export default function UpdateBanner() {
  const u = useUpdate();
  if (!u.barHidden && u.status === 'ready') {
    return (
      <div className="updatebar" role="status">
        {Icons.refresh}
        <span className="grow">{u.version ? `Version ${u.version} is ready.` : 'A new version is ready.'} {u.mode === 'pwa' ? 'Reload to use it.' : 'Restart to install it.'}</span>
        <button className="btn sm ghost" onClick={dismissUpdateBar}>Later</button>
        <button className="btn sm primary" onClick={() => void applyUpdate()}>{u.mode === 'pwa' ? 'Reload' : 'Restart now'}</button>
      </div>
    );
  }
  if (!u.barHidden && u.status === 'available' && u.version) {
    return (
      <div className="updatebar" role="status">
        {Icons.refresh}
        <span className="grow">Version {u.version} is available (you have {APP_VERSION}).</span>
        <button className="btn sm ghost" onClick={() => void skipVersion(u.version!)}>Skip this version</button>
        <button className="btn sm primary" onClick={() => u.url && openExternal(u.url)}>Download</button>
      </div>
    );
  }
  if (u.updatedFrom) {
    return (
      <div className="updatebar ok" role="status">
        {Icons.check}
        <span className="grow">Updated to {APP_VERSION} (from {u.updatedFrom}).</span>
        <Link className="btn sm" to={`/about/versions#v${APP_VERSION}`} onClick={dismissUpdatedNotice}>What's new</Link>
        <button className="btn sm ghost icon" aria-label="Close" onClick={dismissUpdatedNotice}>{Icons.close}</button>
      </div>
    );
  }
  return null;
}
