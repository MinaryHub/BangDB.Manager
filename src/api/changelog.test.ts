import { describe, expect, it } from 'vitest';
import { parseChangelog, releaseNotes, sectionFor } from './changelog';

const md = `## Unreleased — Next things

- a

## v0.6.0 — Updates (2026-11-21)

**New**
- b

## v0.5.0 — English UI

- c
`;

describe('changelog', () => {
  it('parses sections with version, title and date', () => {
    const e = parseChangelog(md);
    expect(e.map((x) => [x.version, x.title, x.date])).toEqual([[null, 'Next things', undefined], ['0.6.0', 'Updates', '2026-11-21'], ['0.5.0', 'English UI', undefined]]);
    expect(e[1].body).toBe('**New**\n- b');
  });
  it('finds a version with or without v', () => {
    expect(sectionFor(md, 'v0.5.0')?.body).toBe('- c');
    expect(sectionFor(md, '0.4.0')).toBeNull();
  });
  it('cuts one version out of a whole-changelog release body', () => {
    expect(releaseNotes(md, 'v0.6.0')).toBe('**New**\n- b');
    expect(releaseNotes('Just notes', 'v1.0.0')).toBe('Just notes');
  });
});
