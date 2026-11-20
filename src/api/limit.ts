/**
 * Run `fn` over `items` with at most `limit` calls in flight, in order of
 * the list. Stops starting new calls once `cancelled()` returns true.
 * Results keep the items' order.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>, cancelled: () => boolean = () => false): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length && !cancelled()) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
