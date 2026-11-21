// Shared by bump-version.mjs (patch bump before local builds) and release.mjs:
// one version in package.json, package-lock.json and the gateway's package files.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const write = (p, o) => writeFileSync(p, JSON.stringify(o, null, 2) + '\n');

export const currentVersion = () => read('package.json').version;

/** "1.2.3" + patch|minor|major|"x.y.z" → the next version. */
export function nextVersion(current, how) {
  if (/^\d+\.\d+\.\d+$/.test(how)) return how;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!m) throw new Error(`package.json version is not x.y.z: ${current}`);
  const [maj, min, pat] = m.slice(1).map(Number);
  if (how === 'major') return `${maj + 1}.0.0`;
  if (how === 'minor') return `${maj}.${min + 1}.0`;
  if (how === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Unknown bump "${how}" — use patch, minor, major or x.y.z`);
}

export function setVersion(next) {
  for (const [pkg, lock] of [['package.json', 'package-lock.json'], ['proxy/package.json', 'proxy/package-lock.json']]) {
    if (!existsSync(pkg)) continue;
    const p = read(pkg); p.version = next; write(pkg, p);
    if (existsSync(lock)) {
      const l = read(lock); l.version = next;
      if (l.packages?.['']) l.packages[''].version = next;
      write(lock, l);
    }
  }
}

/** The CHANGELOG.md section of one version ("## v1.2.3 — Title"), without its heading. */
export function notesFor(changelog, version) {
  const v = version.replace(/^v/, '').replace(/[.]/g, '\\.');
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+v?${v}\\b`).test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  return { heading: lines[start].replace(/^##\s+/, ''), body: lines.slice(start + 1, end).join('\n').trim() };
}
