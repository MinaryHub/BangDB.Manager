// Release notes of one version from CHANGELOG.md, for the GitHub release body:
//   node scripts/release-notes.mjs v0.6.0 > release-notes.md
import { readFileSync } from 'node:fs';
import { notesFor } from './version-lib.mjs';

const tag = process.argv[2];
if (!tag) { console.error('usage: node scripts/release-notes.mjs <tag>'); process.exit(1); }
const v = tag.replace(/^v/, '');
const s = notesFor(readFileSync('CHANGELOG.md', 'utf8'), v);
const repo = 'https://github.com/knoxxr/BangDB.Manager';
const footer = `\n\n---\n\n**Downloads:** Windows \`.exe\` · macOS \`.dmg\` · Linux \`.AppImage\` / \`.deb\` · Android \`.apk\` · web bundle \`.zip\` — see the files below.\n\n[Full changelog](${repo}/blob/v${v}/CHANGELOG.md) · [Report a problem](${repo}/issues/new/choose) · [Sponsor](https://github.com/sponsors/knoxxr)`;
process.stdout.write(`## v${v}${s?.heading.replace(/^v?[\d.]+/, '') ?? ''}\n\n${s?.body || 'See CHANGELOG.md.'}${footer}\n`);
