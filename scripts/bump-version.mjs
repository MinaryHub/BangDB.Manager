// Raises the patch version before every build (npm "prebuild"):
// package.json, package-lock.json and proxy/package.json get the same version.
// Skipped in CI and Docker builds (CI or NO_VERSION_BUMP set), which build a
// version that was already committed. Releases use `npm run release` instead.
import { currentVersion, nextVersion, setVersion } from './version-lib.mjs';

if (process.env.CI || process.env.NO_VERSION_BUMP) {
  console.log('version bump skipped (CI / NO_VERSION_BUMP)');
  process.exit(0);
}
const cur = currentVersion();
const next = nextVersion(cur, 'patch');
setVersion(next);
console.log(`version ${cur} -> ${next}`);
