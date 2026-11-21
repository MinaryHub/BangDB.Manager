import { describe, expect, it } from 'vitest';
import { fuzzyScore } from './CommandPalette';

const rank = (q: string, items: string[]) => items.map((t) => [t, fuzzyScore(t, q)] as const).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);

describe('fuzzyScore', () => {
  it('ranks prefixes and word starts first and drops scattered matches', () => {
    expect(rank('ord', ['Sponsor development', 'Check for updates', 'order_summary', 'orders', 'products'])).toEqual(['orders', 'order_summary']);
    expect(rank('dr', ['analytics.daily_revenue', 'audit_log', 'orders'])).toEqual(['analytics.daily_revenue']);
    expect(rank('usr', ['users', 'audit_log'])).toEqual(['users']);
    expect(rank('ser', ['users', 'servers'])).toEqual(['servers', 'users']);
    expect(fuzzyScore('anything', '')).toBe(0);
  });
});
