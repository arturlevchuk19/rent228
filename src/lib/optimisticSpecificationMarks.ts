/** Immediate local feedback, serialized writes and rollback to the last confirmed value. */
export function createOptimisticSpecificationMarks() {
  type Entry = { confirmed: boolean; latest: boolean; version: number; pending: number; tail: Promise<void> };
  const entries = new Map<string, Entry>();
  return {
    overlay(key: string, remote: boolean) { return entries.get(key)?.latest ?? remote; },
    hasPending() { return entries.size > 0; },
    change(key: string, value: boolean, options: { read: () => boolean; apply: (value: boolean) => void; save: () => Promise<unknown>; onError: (error: unknown) => void; settled: () => void }): Promise<void> {
      let entry = entries.get(key);
      if (!entry) { entry = { confirmed: options.read(), latest: value, version: 0, pending: 0, tail: Promise.resolve() }; entries.set(key, entry); }
      const current = entry;
      const version = ++current.version;
      current.latest = value; current.pending++;
      options.apply(value);
      const result = current.tail.then(async () => {
        try { await options.save(); current.confirmed = value; }
        catch (error) { if (current.version === version) { current.latest = current.confirmed; options.apply(current.confirmed); options.onError(error); } }
        finally { if (--current.pending === 0) entries.delete(key); options.settled(); }
      });
      current.tail = result;
      return result;
    },
  };
}
