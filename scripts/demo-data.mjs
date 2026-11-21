// Demo data for the store screenshots (scripts/store-screenshots.mjs):
// writes bangdb.sql, pg.sql and sqlite.sql — an online shop (customers,
// products, orders, a view) — into the current folder. Deterministic, so the
// screenshots come out the same every time. See screenshots/README.md.
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const first = ['Minji','Jisoo','Hyun','Seojun','Yuna','Daniel','Emma','Liam','Sofia','Noah','Mia','Lucas','Hana','Jae','Olivia','Ethan','Ava','Leo','Chloe','Ryan'];
const last = ['Kim','Lee','Park','Choi','Jung','Kang','Smith','Garcia','Müller','Rossi','Tanaka','Nguyen','Brown','Martin','Silva'];
const cities = ['Seoul','Busan','Incheon','Tokyo','Berlin','Austin','Toronto','Lisbon','Singapore','Melbourne'];
const products = [['Mechanical Keyboard','Peripherals',129],['4K Monitor 27"','Displays',389],['USB-C Dock','Peripherals',179],['Noise-cancel Headset','Audio',249],['Ergonomic Mouse','Peripherals',69],['Webcam 1080p','Video',89],['Laptop Stand','Accessories',49],['NVMe SSD 2TB','Storage',159],['Desk Lamp','Accessories',39],['Portable Speaker','Audio',99],['Graphics Tablet','Creative',219],['Smart Plug 4-pack','Home',45]];
const status = ['paid','paid','paid','shipped','shipped','delivered','delivered','delivered','refunded','pending'];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const out = { customers: [], products: [], orders: [] };
for (let i = 1; i <= 240; i++) { const f = pick(first), l = pick(last); out.customers.push([i, `${f} ${l}`, `${f.toLowerCase()}.${l.toLowerCase().replace('ü','u')}${i}@example.com`, pick(cities), `2025-${String(1 + Math.floor(rnd()*12)).padStart(2,'0')}-${String(1 + Math.floor(rnd()*28)).padStart(2,'0')}`, rnd() < 0.18 ? 'gold' : rnd() < 0.4 ? 'silver' : 'basic']); }
products.forEach((p, i) => out.products.push([i + 1, p[0], p[1], p[2], Math.floor(rnd() * 400)]));
for (let i = 1; i <= 1800; i++) { const p = 1 + Math.floor(rnd() * products.length); const qty = 1 + Math.floor(rnd() * 3); out.orders.push([1000 + i, 1 + Math.floor(rnd() * 240), p, qty, +(products[p-1][2] * qty).toFixed(2), pick(status), `2026-${String(1 + Math.floor(rnd()*10)).padStart(2,'0')}-${String(1 + Math.floor(rnd()*28)).padStart(2,'0')} ${String(Math.floor(rnd()*24)).padStart(2,'0')}:${String(Math.floor(rnd()*60)).padStart(2,'0')}:00`]); }
const ins = (t, cols, rows) => { const o = []; for (let i = 0; i < rows.length; i += 200) o.push(`INSERT INTO ${t} (${cols.join(', ')}) VALUES\n${rows.slice(i, i + 200).map((r) => `(${r.map((v) => typeof v === 'number' ? v : q(v)).join(', ')})`).join(',\n')};`); return o.join('\n'); };
const ddl = (intpk, ts, num) => `
CREATE TABLE customers (id ${intpk} PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, city TEXT, joined DATE, tier TEXT DEFAULT 'basic');
CREATE TABLE products (id ${intpk} PRIMARY KEY, name TEXT NOT NULL, category TEXT, price ${num} NOT NULL, stock INT DEFAULT 0);
CREATE TABLE orders (id ${intpk} PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), product_id INT NOT NULL REFERENCES products(id), qty INT NOT NULL, total ${num} NOT NULL, status TEXT NOT NULL, ordered_at ${ts});
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE VIEW order_summary AS SELECT c.name AS customer, c.city, COUNT(*) AS orders, SUM(o.total) AS revenue FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.name, c.city;
`;
const data = ins('customers', ['id','name','email','city','joined','tier'], out.customers) + '\n' + ins('products', ['id','name','category','price','stock'], out.products) + '\n' + ins('orders', ['id','customer_id','product_id','qty','total','status','ordered_at'], out.orders);
const fs = await import('node:fs');
fs.writeFileSync('bangdb.sql', ddl('INTEGER', 'TEXT', 'REAL') + data);
fs.writeFileSync('pg.sql', ddl('INTEGER', 'TIMESTAMP', 'NUMERIC(10,2)') + data + `
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, actor TEXT, action TEXT, at TIMESTAMPTZ DEFAULT now());
INSERT INTO audit_log (actor, action, at) SELECT 'svc-' || (g % 7), (ARRAY['login','export','update','delete'])[1 + g % 4], now() - (g || ' minutes')::interval FROM generate_series(1, 420000) g;
CREATE SCHEMA analytics;
CREATE TABLE analytics.daily_revenue (day DATE PRIMARY KEY, revenue NUMERIC(12,2), orders INT);
INSERT INTO analytics.daily_revenue SELECT d::date, round((random()*9000+1000)::numeric, 2), (random()*80+10)::int FROM generate_series('2026-01-01'::date, '2026-10-31', '1 day') d;
ANALYZE;`);
fs.writeFileSync('sqlite.sql', ddl('INTEGER', 'TEXT', 'REAL') + data);
console.log('ok');
