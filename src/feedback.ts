import { APP_VERSION, ISSUES_URL, PLATFORM_LABEL, platform, systemLine } from './appinfo';
import type { ServerKind } from './api/types';

export type FeedbackKind = 'bug' | 'feature' | 'question';

export const FEEDBACK: Record<FeedbackKind, { label: string; template: string; labels: string; prefix: string; placeholder: string }> = {
  bug: { label: 'Report a bug', template: 'bug_report.yml', labels: 'bug', prefix: '[Bug] ', placeholder: 'What happened, and what did you expect instead? Steps to reproduce help a lot.' },
  feature: { label: 'Request a feature', template: 'feature_request.yml', labels: 'enhancement', prefix: '[Feature] ', placeholder: 'What would you like the app to do, and what would it help you with?' },
  question: { label: 'Ask a question', template: 'question.yml', labels: 'question', prefix: '[Question] ', placeholder: 'What would you like to know?' }
};

/**
 * Details that help with a report, without anything identifying: no server
 * addresses, names, credentials, table names or data — only the app build,
 * where it runs, the kinds of servers saved and the kind of screen.
 */
export function diagnostics(kinds: ServerKind[], path: string): string {
  const counts = new Map<string, number>();
  kinds.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  const screen = path
    .replace(/^\/c\/[^/]+/, '/c/:server')
    .replace(/\/db\/[^/]+/, '/db/:db')
    .replace(/\/t\/[^/]+/, '/t/:table') || '/';
  return [
    `App: BangDB Manager ${APP_VERSION}`,
    `Runs as: ${PLATFORM_LABEL[platform()]}`,
    `System: ${systemLine()}`,
    `Server kinds saved: ${counts.size ? [...counts].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', ') : 'none'}`,
    `Screen: ${screen}`
  ].join('\n');
}

/** New-issue URL with the issue form pre-filled (field ids of .github/ISSUE_TEMPLATE/*.yml). */
export function issueUrl(kind: FeedbackKind, title: string, description: string, env?: string): string {
  const f = FEEDBACK[kind];
  const q = new URLSearchParams({
    template: f.template,
    labels: f.labels,
    title: `${f.prefix}${title.trim()}`,
    description: description.trim().slice(0, 4000),
    version: APP_VERSION
  });
  if (env) q.set('environment', env);
  return `${ISSUES_URL}/new?${q.toString()}`;
}
