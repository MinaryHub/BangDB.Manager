/**
 * CHANGELOG.md parsing: the file is a list of "## <version> — <title>"
 * sections. Used for the in-app version history and the release notes.
 */
export interface ChangelogEntry {
  /** "0.6.0", or null for a section that is not a release ("Unreleased", "미출시"). */
  version: string | null;
  heading: string;
  title: string;
  /** YYYY-MM-DD when the heading carries one, e.g. "## v0.6.0 — Title (2026-11-21)". */
  date?: string;
  body: string;
}

const HEAD = /^##\s+(.+?)\s*$/;

export function parseChangelog(md: string): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  const body: string[] = [];
  const flush = () => { if (cur) { cur.body = body.join('\n').trim(); out.push(cur); } body.length = 0; };
  for (const line of md.split(/\r?\n/)) {
    const h = HEAD.exec(line);
    if (h) {
      flush();
      const heading = h[1];
      const v = /^v?(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/.exec(heading);
      const date = /\((\d{4}-\d{2}-\d{2})\)\s*$/.exec(heading)?.[1];
      const title = heading.replace(/^v?\d+\.\d+\.\d+(?:-[\w.]+)?\s*/, '').replace(/^(Unreleased|미출시)\s*/i, '').replace(/^[—–-]\s*/, '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '');
      cur = { version: v ? v[1] : null, heading, title, date, body: '' };
    } else if (cur) body.push(line);
  }
  flush();
  return out;
}

/** The section of one version ("0.6.0" or "v0.6.0"), or null. */
export function sectionFor(md: string, version: string): ChangelogEntry | null {
  const v = version.replace(/^v/, '');
  return parseChangelog(md).find((e) => e.version === v) ?? null;
}

/**
 * Notes for one version out of a release body: the body may be the whole
 * changelog (older releases attached all of it) or already just the notes.
 */
export function releaseNotes(body: string, version: string): string {
  const entries = parseChangelog(body);
  if (!entries.length) return body.trim();
  return sectionFor(body, version)?.body ?? '';
}
