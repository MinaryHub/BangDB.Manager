// Google Play feature graphic (1024×500): the app icon, name, tagline and the
// first English store screenshot. Run after scripts/icon.mjs and the screenshots:
//   node scripts/feature-graphic.mjs   → screenshots/feature-graphic-1024x500.png
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const icon = readFileSync('public/icon.svg', 'utf8').replace('<svg ', '<svg width="84" height="84" ');
const shot = `data:image/png;base64,${readFileSync('screenshots/en/desktop-1920x1080/01-table-data.png').toString('base64')}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1024px;height:500px;overflow:hidden;font-family:Inter,"Noto Sans",system-ui,sans-serif}
body{background:radial-gradient(900px 520px at 85% 15%,#26407a 0%,#0b1220 62%);color:#e6ecf5;position:relative}
.l{position:absolute;left:56px;top:80px;width:440px}
.l svg{filter:drop-shadow(0 10px 24px rgba(109,93,252,.45))}
h1{font-size:46px;margin:18px 0 10px;letter-spacing:-.02em}
p{font-size:19px;line-height:1.45;color:#b7c2d4;margin:0 0 20px}
.k{display:flex;gap:8px;flex-wrap:wrap}.k span{font-size:13px;font-weight:700;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
img{position:absolute;left:530px;top:70px;width:640px;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.6);border:1px solid #324361}
</style></head><body>
<div class="l">${icon}
<h1>BangDB Manager</h1><p>Tables, data and SQL for seven databases — on desktop, phone and web.</p>
<div class="k"><span>BangDB</span><span>PostgreSQL</span><span>MySQL</span><span>SQL Server</span><span>SQLite</span><span>MongoDB</span><span>Redis</span></div></div>
<img src="${shot}">
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/feature-graphic-1024x500.png' });
await browser.close();
console.log('screenshots/feature-graphic-1024x500.png');
