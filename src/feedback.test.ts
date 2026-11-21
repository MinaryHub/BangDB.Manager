import { describe, expect, it } from 'vitest';
import { diagnostics, issueUrl } from './feedback';

describe('feedback', () => {
  it('pre-fills the issue form by field id', () => {
    const u = new URL(issueUrl('bug', ' Save fails ', 'It broke', 'App: x'));
    expect(u.origin + u.pathname).toBe('https://github.com/MinaryHub/BangDB.Manager/issues/new');
    expect(u.searchParams.get('template')).toBe('bug_report.yml');
    expect(u.searchParams.get('labels')).toBe('bug');
    expect(u.searchParams.get('title')).toBe('[Bug] Save fails');
    expect(u.searchParams.get('description')).toBe('It broke');
    expect(u.searchParams.get('environment')).toBe('App: x');
    expect(u.searchParams.has('version')).toBe(true);
  });
  it('keeps identifying details out of the diagnostics', () => {
    const d = diagnostics(['postgres', 'postgres', 'redis'], '/c/2f8a-uuid/db/payroll/t/salaries');
    expect(d).toContain('Server kinds saved: postgres ×2, redis');
    expect(d).toContain('Screen: /c/:server/db/:db/t/:table');
    expect(d).not.toMatch(/payroll|salaries|2f8a/);
  });
});
