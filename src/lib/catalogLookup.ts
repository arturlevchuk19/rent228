/** Bound URL length and read every page below PostgREST's response limit. */
export async function readCatalogRows<T>(
  ids: string[],
  readPage: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const keyLimit = 100;
  const pageSize = 500;
  const pages = [];
  for (let start = 0; start < ids.length; start += keyLimit) {
    const keys = ids.slice(start, start + keyLimit);
    pages.push((async () => {
      const rows: T[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await readPage(keys, from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) return rows;
      }
    })());
  }
  return (await Promise.all(pages)).flat();
}

export function createCatalogLookup<T>(read: (ids: string[]) => Promise<T[]>, keyOf: (row: T) => string) {
  const requests = new Map<string, Promise<T[]>>();
  return async (ids: string[]) => {
    const unique = [...new Set(ids)];
    const missing = unique.filter(id => !requests.has(id));
    if (missing.length) {
      const batch = read(missing).then(rows => {
        const grouped = new Map<string, T[]>();
        for (const row of rows) {
          const key = keyOf(row);
          const group = grouped.get(key);
          if (group) group.push(row);
          else grouped.set(key, [row]);
        }
        return grouped;
      });
      for (const id of missing) requests.set(id, batch.then(grouped => grouped.get(id) ?? []));
    }
    return new Map(await Promise.all(unique.map(async id => [id, await requests.get(id)!] as const)));
  };
}
