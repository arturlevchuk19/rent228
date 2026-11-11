export type QuantityChange = { set: number } | { delta: number };

/** Serialize writes to the same template row; a rejected write must not block retries. */
export function createQuantityQueue() {
  const pending = new Map<string, Promise<void>>();
  return (key: string, task: () => Promise<void>): Promise<void> => {
    const previous = pending.get(key) || Promise.resolve();
    const result = previous.catch(() => {}).then(task);
    pending.set(key, result);
    void result.then(() => { if (pending.get(key) === result) pending.delete(key); },
      () => { if (pending.get(key) === result) pending.delete(key); });
    return result;
  };
}

/** The input is the total for the visible row, including any older duplicate records. */
export async function writeGroupedQuantity<T extends { id: string; quantity: number }>({ rows, change, create, update, commit }: {
  rows: T[]; change: QuantityChange; create: (quantity: number) => Promise<T>;
  update: (id: string, quantity: number) => Promise<T>; commit: (row: T) => void;
}) {
  const current = rows.reduce((sum, row) => sum + row.quantity, 0);
  const raw = 'set' in change ? change.set : current + change.delta;
  if (!Number.isFinite(raw)) throw new Error('Укажите корректное количество');
  const quantity = Math.max(0, Math.trunc(raw));
  if (!rows.length) {
    if (quantity) commit(await create(quantity));
    return;
  }
  // Keep duplicate records and their notes, but exclude their quantity from totals.
  // This also works for editors who can change quantities but cannot delete rows.
  for (const duplicate of rows.slice(1)) {
    if (duplicate.quantity !== 0) commit(await update(duplicate.id, 0));
  }
  if (rows[0].quantity !== quantity) commit(await update(rows[0].id, quantity));
}

/** Keep displayed totals separate from confirmed rows while writes run in order. */
export function createOptimisticQuantityQueue() {
  type Entry = { latest: number; version: number; pending: number; tail: Promise<void> };
  const entries = new Map<string, Entry>();
  return {
    value(key: string, confirmed: number) { return entries.get(key)?.latest ?? confirmed; },
    hasPending() { return entries.size > 0; },
    change(key: string, change: QuantityChange, options: { read: () => number; save: (quantity: number) => Promise<void>; notify: () => void; failed: (error: unknown) => void; settled: () => void }): Promise<void> {
      let entry = entries.get(key);
      if (!entry) { entry = { latest: options.read(), version: 0, pending: 0, tail: Promise.resolve() }; entries.set(key, entry); }
      const raw = 'set' in change ? change.set : entry.latest + change.delta;
      if (!Number.isFinite(raw)) { if (entry.pending === 0) entries.delete(key); throw new Error('Укажите корректное количество'); }
      const target = Math.max(0, Math.trunc(raw));
      entry.latest = target;
      const current = entry, version = ++entry.version;
      current.pending++;
      options.notify();
      const result = current.tail.then(async () => {
        try { await options.save(target); }
        catch (error) { if (current.version === version) { current.latest = options.read(); options.failed(error); } }
        finally { if (--current.pending === 0) entries.delete(key); options.notify(); options.settled(); }
      });
      current.tail = result;
      return result;
    },
  };
}
