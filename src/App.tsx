import { lazy } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui';
import UpdateBanner from './components/UpdateBanner';
import ConnectionsPage from './pages/ConnectionsPage';

// Pages load on first use: a connection only ever needs the screens of its own
// kind, so the start screen does not wait for the Mongo, Redis or SQL editors.
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ConsolePage = lazy(() => import('./pages/ConsolePage'));
const DatabasesPage = lazy(() => import('./pages/DatabasesPage'));
const QueryPage = lazy(() => import('./pages/QueryPage'));
const TableDetailPage = lazy(() => import('./pages/TableDetailPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const GoServerPage = lazy(() => import('./pages/GoServerPage'));
const GoTablePage = lazy(() => import('./pages/GoTablePage'));
const GoTablesPage = lazy(() => import('./pages/GoTablesPage'));
const MongoServerPage = lazy(() => import('./pages/MongoPages').then((m) => ({ default: m.MongoServerPage })));
const MongoDbPage = lazy(() => import('./pages/MongoPages').then((m) => ({ default: m.MongoDbPage })));
const MongoCollectionPage = lazy(() => import('./pages/MongoPages').then((m) => ({ default: m.MongoCollectionPage })));
const RedisPage = lazy(() => import('./pages/RedisPage'));
const SqlServerPage = lazy(() => import('./pages/SqlServerPage'));
import type { ServerKind } from './api/types';
import { useConnection } from './store/store';

type Pages = Partial<Record<ServerKind | 'sql', React.ReactNode>>;

/**
 * Pick the page for the connection's kind: `sql` covers BangDB (Go) and the
 * gateway's SQL databases, which share the SQL pages.
 */
function ByKind(p: Pages) {
  const conn = useConnection(useParams().connId);
  if (!conn) return <div className="empty">Connection not found. <a href="#/connections">Server list</a></div>;
  const sql = ['go', 'postgres', 'mysql', 'mssql', 'sqlite'].includes(conn.kind);
  return <>{p[conn.kind] ?? (sql ? p.sql : undefined) ?? p.rest}</>;
}
function ServerPage() {
  const conn = useConnection(useParams().connId);
  if (!conn) return <DatabasesPage />;
  if (conn.kind === 'go') return <GoServerPage conn={conn} />;
  if (conn.kind === 'mongodb') return <MongoServerPage conn={conn} />;
  if (conn.kind === 'redis') return <RedisPage />;
  if (conn.db) return <SqlServerPage conn={conn} />;
  return <DatabasesPage />;
}

// HashRouter keeps deep links working when the built files are served from a
// plain static host, a file:// WebView (Capacitor) or the bundled proxy.
export default function App() {
  return (
    <ToastProvider>
      <UpdateBanner />
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/connections" replace />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/c/:connId/dbs" element={<ServerPage />} />
            <Route path="/c/:connId/db/:db" element={<ByKind sql={<GoTablesPage />} mongodb={<MongoDbPage />} redis={<RedisPage />} rest={<TablesPage />} />} />
            <Route path="/c/:connId/db/:db/query" element={<ByKind mongodb={<MongoDbPage />} redis={<RedisPage />} rest={<QueryPage />} />} />
            <Route path="/c/:connId/db/:db/t/:table" element={<ByKind sql={<GoTablePage />} mongodb={<MongoCollectionPage />} rest={<TableDetailPage />} />} />
            <Route path="/c/:connId/console" element={<ConsolePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/connections" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
