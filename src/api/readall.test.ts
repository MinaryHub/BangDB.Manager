import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setFetchImpl } from './http';
import { afterKeySql, countWhere, dumpSql, keysetOf, readAll } from './goapi';
import { BANGDB, MSSQL, POSTGRES, identityOf } from './dialect';
import type { Connection, GoTableInfo } from './types';
// A fake gateway answering /gw/query from a real in-memory SQLite database
// (node:sqlite, loaded past the bundler, which does not know the module).
interface Stmt { columns(): { name: string }[]; all(): Record<string, unknown>[]; run(): unknown }
interface Db { exec(sql: string): void; prepare(sql: string): Stmt; close(): void }
const { DatabaseSync } = (globalThis as unknown as { process: { getBuiltinModule(n: string): { DatabaseSync: new (f: string) => Db } } }).process.getBuiltinModule('node:sqlite');

const conn: Connection = {
  id: 't', name: 'mem', kind: 'sqlite', baseUrl: 'http://gw.test', defaultDb: 'main', databases: ['main'],
  auth: { mode: 'none', headerName: '', tokenField: '' }, useProxy: false, endpointOverrides: {}, createdAt: 0, db: { file: ':memory:' }
};
let db: Db;
const sent: string[] = [];
const SQLITE = { ...BANGDB, id: 'sqlite' as const };
const INFO: Record<string, GoTableInfo> = {
  plain: { name: 'plain', kind: 'table', rowid: 'rowid', columns: [{ name: 'id', pk: true }, { name: 'v' }] },
  pair: { name: 'pair', kind: 'table', primaryKey: ['a', 'b'], columns: [{ name: 'a', pk: true }, { name: 'b', pk: true }, { name: 'v' }] },
  nokey: { name: 'nokey', kind: 'table', columns: [{ name: 'v' }] }
} as unknown as Record<string, GoTableInfo>;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE plain (id INTEGER PRIMARY KEY, v TEXT);
    CREATE TABLE pair (a TEXT NOT NULL, b INT NOT NULL, v TEXT, PRIMARY KEY (a, b)) WITHOUT ROWID;
    CREATE TABLE nokey (v TEXT);`);
  const vals = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join(',');
  db.exec(`INSERT INTO plain (id, v) VALUES ${vals(1234, (i) => `(${i * 3 + 1}, 'p${i}')`)}`);
  db.exec(`INSERT INTO pair (a, b, v) VALUES ${vals(530, (i) => `('k${i % 7}', ${i}, 'x${i}')`)}`);
  db.exec(`INSERT INTO nokey (v) VALUES ${vals(260, (i) => `('n${i}')`)}`);
  setFetchImpl((async (url: string | URL | Request, init?: RequestInit) => {
    const op = String(url).split('/gw/')[1];
    const body = JSON.parse(String(init?.body));
    let out: unknown;
    if (op === 'query') {
      sent.push(body.sql);
      const st = db.prepare(body.sql);
      const columns = st.columns().map((c) => c.name);
      const rows = st.all().map((r) => Object.values(r));
      out = { columns, types: columns.map(() => ''), rows, rows_affected: 0, last_insert_id: 0, truncated: false, ms: 0 };
    } else if (op === 'tables') out = { tables: Object.values(INFO).map((t) => ({ ...t, sql: `CREATE TABLE ${t.name} (x)` })), count: 3 };
    else throw new Error(`unexpected op ${op}`);
    return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch);
});
afterAll(() => db?.close());

const info = async (name: string) => INFO[name];

describe('keyset paging', () => {
  it('builds the "after last key" condition for one and several columns', () => {
    expect(afterKeySql(['"id"'], [5], POSTGRES)).toBe('"id" > 5');
    expect(afterKeySql(['[a]', '[b]'], ['x', 2], MSSQL)).toBe("([a] > N'x') OR ([a] = N'x' AND [b] > 2)");
    expect(keysetOf({ kind: 'rowid', expr: 'rowid' }, BANGDB)?.select).toBe('rowid AS "__rowid", *');
    expect(keysetOf({ kind: 'ctid' }, POSTGRES)).toBeNull();
  });

  it('reads every row once, in key order, without OFFSET (rowid table)', async () => {
    sent.length = 0;
    const { columns, rows } = await readAll(conn, 'plain', { pageSize: 100, ident: identityOf(SQLITE, await info('plain')) });
    expect(columns).toEqual(['id', 'v']);
    expect(rows.length).toBe(1234);
    expect(rows.map((r) => r[0])).toEqual(Array.from({ length: 1234 }, (_, i) => i * 3 + 1));
    expect(sent.length).toBe(13);
    expect(sent.some((s) => /OFFSET [1-9]/.test(s))).toBe(false);
  });

  it('pages a composite primary key and honours a WHERE clause', async () => {
    const ident = identityOf(SQLITE, await info('pair'));
    expect(ident).toEqual({ kind: 'pk', columns: ['a', 'b'] });
    const all = await readAll(conn, 'pair', { pageSize: 50, ident });
    expect(all.rows.length).toBe(530);
    expect(new Set(all.rows.map((r) => `${r[0]}/${r[1]}`)).size).toBe(530);
    const some = await readAll(conn, 'pair', { pageSize: 20, ident, where: "a = 'k3' OR v LIKE 'x1%'" });
    const expected = Array.from({ length: 530 }, (_, i) => i).filter((i) => i % 7 === 3 || String(i).startsWith('1'));
    expect(some.rows.map((r) => r[1]).sort((x, y) => Number(x) - Number(y))).toEqual(expected);
  });

  it('falls back to OFFSET without a key', async () => {
    sent.length = 0;
    const { rows } = await readAll(conn, 'nokey', { pageSize: 100 });
    expect(rows.length).toBe(260);
    expect(sent.some((s) => /OFFSET 200/.test(s))).toBe(true);
  });

  it('dumps through keyset paging', async () => {
    const sql = await dumpSql(conn, undefined, ['plain']);
    expect(sql.match(/\(\d+, 'p\d+'\)/g)?.length).toBe(1234);
  });
});

describe('countWhere', () => {
  it('shares one query between identical counts asked at the same time', async () => {
    sent.length = 0;
    const [a, b] = await Promise.all([countWhere(conn, 'plain'), countWhere(conn, 'plain')]);
    expect([a, b]).toEqual([1234, 1234]);
    expect(sent.length).toBe(1);
    expect(await countWhere(conn, 'plain')).toBe(1234);
    expect(sent.length).toBe(2);
  });
});
