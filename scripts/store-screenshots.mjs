// Store / listing screenshots (screenshots/README.md has the setup):
//   node scripts/store-screenshots.mjs screenshots [only]
// Desktop 1440×810 @4/3 = 1920×1080, phone 360×640 @3 = 1080×1920.
// Needs the app on APP_URL (default http://localhost:8080) and the demo servers.
// RELEASES_JSON=<file> serves a saved GitHub releases list to the version-history page.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const OUT = process.argv[2] || 'screenshots';
const ONLY = process.argv[3];
const releases = process.env.RELEASES_JSON ? readFileSync(process.env.RELEASES_JSON, 'utf8') : null;
mkdirSync(`${OUT}/desktop-1920x1080`, { recursive: true });
mkdirSync(`${OUT}/android-phone-1080x1920`, { recursive: true });
const CONNS = [
  { id: 'go', name: 'Shop · BangDB', kind: 'go', baseUrl: 'http://127.0.0.1:18081', defaultDb: 'main', auth: { mode: 'basic', user: 'app', pass: 'demo', headerName: '', tokenField: 'token' } },
  { id: 'pg', name: 'Production · PostgreSQL', kind: 'postgres', db: { host: '127.0.0.1', port: 5433, user: 'postgres', database: 'shop' } },
  { id: 'sq', name: 'Analytics · SQLite', kind: 'sqlite', db: { file: 'analytics.db' } },
  { id: 'rest', name: 'Legacy · BangDB 2.0', kind: 'rest', baseUrl: 'http://127.0.0.1:18080', defaultDb: 'mydb', useProxy: true }
];
const B = `${process.env.APP_URL || 'http://localhost:8080'}/#`;
const errors = [];
const browser = await chromium.launch();

async function ctxFor(kind, theme) {
  const opts = kind === 'phone'
    ? { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }
    : { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 };
  const ctx = await browser.newContext({ ...opts, colorScheme: theme });
  await ctx.addInitScript((c) => {
    localStorage.setItem('bangdb-manager.connections.v1', JSON.stringify(c));
    localStorage.setItem('bangdb-manager.sql-history', JSON.stringify([]));
  }, CONNS);
  if (releases) await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: releases }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page };
}
const settle = (p, ms = 700) => p.waitForTimeout(ms);
async function shot(p, name) { await p.mouse.move(1, 1); await settle(p, 350); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); }
const want = (n) => !ONLY || n.includes(ONLY);

// ---------------- desktop
{
  const { ctx, page: p } = await ctxFor('desktop', 'dark');
  if (want('01')) {
    await p.goto(`${B}/c/go/db/main/t/customers`);
    await p.locator('table.grid tbody tr').nth(5).waitFor(); await settle(p);
    const cell = (r, c) => p.locator('table.grid tbody tr').nth(r).locator('td.cell').nth(c);
    await cell(2, 3).click(); await p.keyboard.press('Control+a'); await p.keyboard.type('Busan'); await p.keyboard.press('Enter');
    await p.keyboard.press('Escape');
    await cell(4, 5).click(); await p.keyboard.press('Control+a'); await p.keyboard.type('gold'); await p.keyboard.press('Enter'); await p.keyboard.press('Escape');
    await p.locator('table.grid tbody tr').nth(7).locator('input[type=checkbox]').check();
    await p.getByRole('button', { name: /Delete selected/ }).click();
    await shot(p, 'desktop-1920x1080/01-table-data');
  }
  if (want('03')) {
    await p.goto(`${B}/c/pg/db/shop`); await p.locator('.item .title', { hasText: 'orders' }).waitFor(); await settle(p, 1200);
    await shot(p, 'desktop-1920x1080/03-tables');
    await p.keyboard.press('Control+k'); await p.locator('.palette input').fill('ord'); await settle(p, 300);
    await shot(p, 'desktop-1920x1080/04-quick-open');
    await p.keyboard.press('Escape');
  }
  if (want('06')) {
    await p.goto(`${B}/connections`); await p.locator('.dot.ok').nth(3).waitFor({ timeout: 10000 }).catch(() => {}); await settle(p, 800);
    await shot(p, 'desktop-1920x1080/06-servers');
  }
  if (want('07')) {
    await p.goto(`${B}/c/go/dbs`); await settle(p, 1500);
    await shot(p, 'desktop-1920x1080/07-server-overview');
  }
  if (want('09')) {
    await p.goto(`${B}/about/versions`); await p.locator('.version').nth(2).waitFor(); await settle(p);
    await shot(p, 'desktop-1920x1080/09-version-history');
  }
  await ctx.close();
}
{
  const { ctx, page: p } = await ctxFor('desktop', 'light');
  if (want('02')) {
    await p.goto(`${B}/c/pg/db/shop/query`); await p.locator('textarea').waitFor();
    await p.locator('textarea').fill(`SELECT c.city,\n       COUNT(*)              AS orders,\n       SUM(o.total)          AS revenue,\n       ROUND(AVG(o.total), 2) AS avg_order\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status <> 'refunded'\nGROUP BY c.city\nORDER BY revenue DESC;`);
    await p.keyboard.press('Control+Enter'); await p.locator('table.data').waitFor(); await settle(p);
    await shot(p, 'desktop-1920x1080/02-sql-console');
  }
  if (want('05')) {
    await p.goto(`${B}/c/go/db/main/t/orders`); await p.locator('.tabs').waitFor(); await settle(p);
    await p.getByRole('button', { name: 'Schema' }).click(); await settle(p);
    await shot(p, 'desktop-1920x1080/05-schema');
  }
  if (want('08')) {
    await p.goto(`${B}/about`); await p.getByText('Help & feedback').waitFor(); await settle(p, 1200);
    await p.getByRole('button', { name: 'Check for updates' }).click(); await p.getByText(/up to date/).waitFor({ timeout: 15000 }).catch(() => {});
    await shot(p, 'desktop-1920x1080/08-about-updates-support');
  }
  if (want('10')) {
    await p.goto(`${B}/about`); await p.getByRole('button', { name: 'Report a bug' }).click();
    await p.locator('.modal input').first().fill('Saving a row in a SQL Server table fails');
    await p.locator('.modal textarea').fill('After editing two cells and pressing Ctrl+S the save bar shows "Save failed — nothing was applied: conversion failed". Other tables save fine.');
    await shot(p, 'desktop-1920x1080/10-report-issue');
  }
  await ctx.close();
}

// ---------------- phone
{
  const { ctx, page: p } = await ctxFor('phone', 'dark');
  if (want('p1')) { await p.goto(`${B}/connections`); await p.locator('.dot.ok').nth(3).waitFor({ timeout: 10000 }).catch(() => {}); await settle(p, 800); await shot(p, 'android-phone-1080x1920/01-servers'); }
  if (want('p2')) { await p.goto(`${B}/c/go/db/main/t/customers`); await p.locator('table.grid tbody tr').nth(5).waitFor(); await settle(p); await shot(p, 'android-phone-1080x1920/02-table-data'); }
  if (want('p3')) {
    await p.goto(`${B}/c/pg/db/shop/query`); await p.locator('textarea').waitFor();
    await p.locator('textarea').fill(`SELECT status, COUNT(*) AS n,\n       SUM(total) AS revenue\nFROM orders\nGROUP BY status\nORDER BY n DESC;`);
    await p.getByRole('button', { name: /^Run \(/ }).click(); await p.locator('table.data').waitFor(); await settle(p);
    await p.evaluate(() => { const el = document.querySelector('.split textarea, textarea'); const y = el.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo(0, y); }); await settle(p, 300);
    await shot(p, 'android-phone-1080x1920/03-sql-console');
  }
  if (want('p4')) { await p.goto(`${B}/c/pg/db/shop`); await p.locator('.item .title', { hasText: 'orders' }).waitFor(); await settle(p, 1200); await shot(p, 'android-phone-1080x1920/04-tables'); }
  if (want('p5')) { await p.goto(`${B}/c/pg/db/shop`); await p.locator('.item').first().waitFor(); await p.locator('.topbar .narrow-only').click(); await p.locator('.palette input').fill('rev'); await settle(p, 300); await shot(p, 'android-phone-1080x1920/05-quick-open'); await p.keyboard.press('Escape'); }
  if (want('p6')) { await p.goto(`${B}/connections`); await p.reload(); await p.goto(`${B}/about`); await p.getByText('Help & feedback').waitFor(); await settle(p, 1000); await shot(p, 'android-phone-1080x1920/06-about'); }
  await ctx.close();
}
console.log('errors', errors);
await browser.close();
