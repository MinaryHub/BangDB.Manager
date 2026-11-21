// App icon source: one drawing, rendered in the variants each platform needs.
//   node scripts/icon.mjs   → writes the SVGs and renders the PNGs (Playwright)
// (The committed PNGs were then quantized with libimagequant and saved back as
// RGBA to cut their size by two thirds; a fresh run gives larger, equivalent files.)
// The mark: a white database cylinder with a table card being edited in front
// of it, on the app's sky-to-violet gradient (the in-app accent colours).
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SKY = '#38bdf8', VIOLET = '#6d5dfc', INK = '#4338ca';

/** The cylinder and the table card, drawn in a 1024 box around (512, 512). */
function mark(id) {
  return `
  <g>
    <!-- database cylinder -->
    <path d="M232 318v352c0 46 94 84 210 84s210-38 210-84V318" fill="#fff"/>
    <path d="M232 435c0 46 94 84 210 84s210-38 210-84M232 552c0 46 94 84 210 84s210-38 210-84" fill="none" stroke="${INK}" stroke-opacity=".22" stroke-width="16"/>
    <ellipse cx="442" cy="318" rx="210" ry="84" fill="#fff"/>
    <ellipse cx="442" cy="318" rx="168" ry="60" fill="url(#${id}top)"/>
    <!-- table card being edited -->
    <g filter="url(#${id}shadow)">
      <rect x="500" y="500" width="330" height="290" rx="44" fill="#fff"/>
    </g>
    <path d="M544 500h242a44 44 0 0 1 44 44v34H500v-34a44 44 0 0 1 44-44z" fill="url(#${id}head)"/>
    <path d="M610 578v212M720 578v212M500 648h330M500 718h330" stroke="${INK}" stroke-opacity=".18" stroke-width="10"/>
    <rect x="615" y="653" width="100" height="60" rx="8" fill="${VIOLET}" fill-opacity=".14" stroke="${VIOLET}" stroke-width="10"/>
  </g>`;
}

function defs(id) {
  return `<defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SKY}"/><stop offset="1" stop-color="${VIOLET}"/></linearGradient>
    <linearGradient id="${id}top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SKY}" stop-opacity=".35"/><stop offset="1" stop-color="${VIOLET}" stop-opacity=".35"/></linearGradient>
    <linearGradient id="${id}head" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${SKY}"/><stop offset="1" stop-color="${VIOLET}"/></linearGradient>
    <linearGradient id="${id}shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${id}shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#1e1b4b" flood-opacity=".35"/></filter>
  </defs>`;
}

// the drawing spans x 232–830, y 234–790: centre it, optionally scaled
const centred = (scale) => `translate(512 512) scale(${scale}) translate(-531 -512)`;

const variants = {
  // desktop / web / favicon: rounded tile with a transparent margin (like the BangDB icon)
  rounded: (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs(id)}
  <rect x="32" y="32" width="960" height="960" rx="216" fill="url(#${id}bg)"/>
  <rect x="32" y="32" width="960" height="960" rx="216" fill="url(#${id}shine)"/>
  <g transform="${centred(1)}">${mark(id)}</g></svg>`,
  // maskable PWA icon / Apple touch icon: full-bleed background, mark inside the 80 % safe circle
  fullbleed: (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs(id)}
  <rect width="1024" height="1024" fill="url(#${id}bg)"/>
  <rect width="1024" height="1024" fill="url(#${id}shine)"/>
  <g transform="${centred(0.9)}">${mark(id)}</g></svg>`,
  // Android adaptive icon (via @capacitor/assets, which insets both layers to the 72dp visible
  // area): the mark at the same size as the tile, inside the 66dp safe circle
  foreground: (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs(id)}
  <g transform="${centred(1)}">${mark(id)}</g></svg>`,
  background: (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs(id)}
  <rect width="1024" height="1024" fill="url(#${id}bg)"/><rect width="1024" height="1024" fill="url(#${id}shine)"/></svg>`
};

const svg = Object.fromEntries(Object.entries(variants).map(([k, f]) => [k, f(`bm${k[0]}`)]));
mkdirSync('icons', { recursive: true });
for (const [k, s] of Object.entries(svg)) writeFileSync(`icons/icon-${k}.svg`, s);
writeFileSync('public/icon.svg', svg.rounded);

const outputs = [
  ['rounded', 1024, 'build/icon.png'],          // electron-builder: Windows .ico, macOS .icns, Linux
  ['rounded', 512, 'public/icon-512.png'],       // PWA "any", MinaryHub card icon
  ['rounded', 192, 'public/icon-192.png'],
  ['rounded', 32, 'public/favicon-32.png'],
  ['fullbleed', 512, 'public/icon-maskable-512.png'],
  ['fullbleed', 180, 'public/apple-touch-icon.png'],
  ['rounded', 1024, 'assets/icon-only.png'],     // @capacitor/assets sources for the Android app
  ['foreground', 1024, 'assets/icon-foreground.png'],
  ['background', 1024, 'assets/icon-background.png']
];
mkdirSync('assets', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [k, size, file] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg[k].replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(file, size);
}
await browser.close();
