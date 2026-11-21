// Prepare a release:
//   npm run release -- minor              # or patch | major | 1.4.0
//   npm run release -- minor --git        # also commit and tag v<version>
// 1. sets the version everywhere (package.json, lock files, gateway)
// 2. turns the "## Unreleased — <title>" section of CHANGELOG.md into
//    "## v<version> — <title> (<date>)", so the app's version history and the
//    GitHub release notes (scripts/release-notes.mjs) show it
// 3. with --git: commits "Release v<version>" and creates the tag; pushing the
//    tag (git push origin v<version>) starts the release workflow
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { currentVersion, nextVersion, setVersion } from './version-lib.mjs';

const args = process.argv.slice(2);
const how = args.find((a) => !a.startsWith('--'));
if (!how) {
  console.error('usage: npm run release -- <patch|minor|major|x.y.z> [--git]');
  process.exit(1);
}
const git = args.includes('--git');
const cur = currentVersion();
const next = nextVersion(cur, how);
const date = new Date().toISOString().slice(0, 10);

let log = readFileSync('CHANGELOG.md', 'utf8');
if (new RegExp(`^##\\s+v${next.replace(/\./g, '\\.')}\\b`, 'm').test(log)) {
  console.error(`CHANGELOG.md already has a v${next} section.`);
  process.exit(1);
}
// only the newest (top) section can be the one being released
const top = /^##\s.*$/m.exec(log);
const unreleased = top && /^##\s+(?:Unreleased|미출시)\s*(?:[—–-]\s*(.*))?$/.exec(top[0]);
if (unreleased) {
  const title = unreleased[1]?.trim();
  log = log.replace(unreleased[0], `## v${next}${title ? ` — ${title}` : ''} (${date})`);
} else {
  console.warn('No "## Unreleased" section in CHANGELOG.md — adding an empty one for this version; fill it in before tagging.');
  log = `## v${next} (${date})\n\n- \n\n${log}`;
}
writeFileSync('CHANGELOG.md', log);
setVersion(next);
console.log(`version ${cur} -> ${next}, CHANGELOG.md section dated ${date}`);

if (git) {
  const run = (...a) => execFileSync('git', a, { stdio: 'inherit' });
  run('add', 'CHANGELOG.md', 'package.json', 'package-lock.json', 'proxy/package.json', 'proxy/package-lock.json');
  run('commit', '-m', `Release v${next}`);
  run('tag', '-a', `v${next}`, '-m', `BangDB Manager v${next}`);
  console.log(`\nCommitted and tagged. Publish with:\n  git push && git push origin v${next}`);
} else {
  console.log(`\nNext: review CHANGELOG.md, commit, then\n  git tag -a v${next} -m "BangDB Manager v${next}" && git push origin v${next}`);
}
