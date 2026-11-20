import { describe, expect, it } from 'vitest';
import { mapLimit } from './limit';

describe('mapLimit', () => {
  it('keeps order and never exceeds the limit', async () => {
    let running = 0, peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3], 2, async (n) => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running--;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });

  it('stops starting work when cancelled', async () => {
    let calls = 0, stop = false;
    await mapLimit([1, 2, 3, 4, 5, 6], 1, async () => { calls++; if (calls === 2) stop = true; }, () => stop);
    expect(calls).toBe(2);
  });

  it('handles an empty list', async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });
});
