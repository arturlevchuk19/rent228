/** Per-account durable read cache and ordered outbox. Tokens are never persisted here. */
type JsonRow = Record<string, unknown>;
type Cached = { body: string; status: number; headers: [string, string][] };
type Change = { id: string; url: string; method: string; body: string; rowId: string; table: string };
type State = { cache: Record<string, Cached>; queue: Change[] };
export type OfflineStatus = { pending: number; syncing: boolean; error: string; offline: boolean };
let status: OfflineStatus = { pending: 0, syncing: false, error: '', offline: !navigator.onLine };
const listeners = new Set<() => void>();
export const getOfflineStatus = () => status;
export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function publish(patch: Partial<OfflineStatus>) { status = { ...status, ...patch }; listeners.forEach(fn => fn()); }
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('rentmaster-offline-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('accounts');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read(account: string): Promise<State> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('accounts').objectStore('accounts').get(account);
    request.onsuccess = () => resolve(request.result || { cache: {}, queue: [] });
    request.onerror = () => reject(request.error);
  });
}
async function write(account: string, state: State) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('accounts', 'readwrite');
    tx.objectStore('accounts').put(state, account);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить данные на устройстве'));
  });
}
// Web Locks serialize all read/modify/write operations, including across tabs.
let serial = Promise.resolve();
async function locked<T>(fn: () => Promise<T>): Promise<T> {
  if (navigator.locks) return await navigator.locks.request('rentmaster-offline', fn);
  const next = serial.then(fn, fn); serial = next.then(() => {}, () => {}); return next;
}
function failure(message: string, code = 'OFFLINE_UNAVAILABLE') {
  return new Response(JSON.stringify({ message, code }), { status: 503, headers: { 'Content-Type': 'application/json' } });
}
function response(cached: Cached) { return new Response(cached.body, { status: cached.status, headers: cached.headers }); }
function patchTree(value: unknown, change: Change, patch: JsonRow): unknown {
  if (Array.isArray(value)) return value.filter(row => !(change.method === 'DELETE' && row?.id === change.rowId)).map(row => patchTree(row, change, patch));
  if (!value || typeof value !== 'object') return value;
  const row = value as JsonRow;
  if (row.id === change.rowId) return change.method === 'DELETE' ? null : { ...row, ...patch };
  return Object.fromEntries(Object.entries(row).map(([key, child]) => [key, patchTree(child, change, patch)]));
}
function apply(state: State, change: Change) {
  const patch = change.method === 'PATCH' ? JSON.parse(change.body) as JsonRow : {};
  for (const entry of Object.values(state.cache)) entry.body = JSON.stringify(patchTree(JSON.parse(entry.body), change, patch));
}
// The one offline-safe RPC changes a single checkbox idempotently. Restrict its
// optimistic cache update to a previously loaded event/budget snapshot.
function cacheGeneratedMark(state: State, root: string, body: Record<string, unknown>): boolean {
  if (!['picked', 'return_picked'].includes(String(body.p_field)) || typeof body.p_value !== 'boolean') return false;
  let cached = false;
  for (const [key, entry] of Object.entries(state.cache)) {
    if (!key.startsWith(`${root}specification_row_marks?`)) continue;
    const url = new URL(key.split('|')[0]);
    if (url.searchParams.get('event_id') !== `eq.${body.p_event_id}` || url.searchParams.get('budget_id') !== `eq.${body.p_budget_id}`) continue;
    const rows = JSON.parse(entry.body) as Record<string, unknown>[];
    if (!Array.isArray(rows)) continue;
    const existing = rows.find(row => row.row_key === body.p_row_key);
    if (existing) existing[String(body.p_field)] = body.p_value;
    else rows.push({ row_key: body.p_row_key, parent_id: body.p_parent_id, event_id: body.p_event_id, budget_id: body.p_budget_id, label: body.p_label, picked: false, return_picked: false, [String(body.p_field)]: body.p_value });
    entry.body = JSON.stringify(rows); cached = true;
  }
  return cached;
}

export function createOfflineTransport(baseUrl: string, nativeFetch: typeof fetch = fetch) {
  let account: string | null = null;
  let authHeaders = new Headers();
  const root = new URL('/rest/v1/', baseUrl).href;
  async function sync() {
    if (!account || !navigator.onLine) return;
    await locked(async () => {
      const owner = account;
      if (!owner) return;
      publish({ syncing: true, error: '' });
      try {
        const state = await read(owner);
        while (state.queue.length && account === owner) {
          const change = state.queue[0];
          const headers = new Headers(authHeaders);
          headers.set('Content-Type', 'application/json');
          headers.set('Prefer', 'return=representation');
          const result = await nativeFetch(change.url, { method: change.method, headers, body: change.method === 'DELETE' ? undefined : change.body });
          if (!result.ok) throw new Error(`Синхронизация остановлена (${result.status}). Изменения сохранены на устройстве.`);
          const rows = change.method === 'PATCH' ? await result.json() : null;
          if (change.method === 'PATCH' && (!Array.isArray(rows) || rows.length !== 1)) throw new Error('Запись удалена или доступ изменён. Правка сохранена на устройстве.');
          state.queue.shift();
          await write(owner, state);
          publish({ pending: state.queue.length, offline: false });
        }
      } catch (error) { publish({ error: error instanceof Error ? error.message : 'Нет связи с сервером' }); }
      finally { publish({ syncing: false }); }
    });
  }
  const transport: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(root) || !account) return nativeFetch(request);
    const owner = account;
    if (request.headers.has('authorization')) authHeaders = new Headers(request.headers);
    const method = request.method;
    const url = new URL(request.url);
    const key = `${request.url}|${request.headers.get('accept') || ''}|${request.headers.get('range') || ''}|${request.headers.get('prefer') || ''}`;
    return locked(async () => {
      let state: State;
      try { state = await read(owner); } catch {
        publish({ error: 'Локальное хранилище недоступно. Работа без сети невозможна.' });
        return navigator.onLine ? nativeFetch(request) : failure('Локальное хранилище недоступно. Подключитесь к интернету.');
      }
      const pending = state.queue.length > 0;
      if (navigator.onLine && !pending) {
        try {
          const result = await nativeFetch(request.clone());
          if (result.ok && method === 'GET') {
            const cached = { body: await result.clone().text(), status: result.status, headers: [...result.headers.entries()] };
            state.cache[key] = cached;
            // Bound cache size; outbox entries are never evicted.
            while (Object.keys(state.cache).length > 300) delete state.cache[Object.keys(state.cache)[0]];
            try { await write(owner, state); } catch { publish({ error: 'Не удалось обновить локальный кэш. Проверьте свободное место.' }); }
          }
          if (result.ok && ['PATCH', 'DELETE'].includes(method)) {
            const rowId = url.searchParams.get('id')?.match(/^eq\.([a-zA-Z0-9-]+)$/)?.[1];
            if (rowId) {
              apply(state, { id: '', url: request.url, method, rowId, table: url.pathname.split('/').pop() || '', body: method === 'PATCH' ? await request.clone().text() : '' });
              try { await write(owner, state); } catch { publish({ error: 'Не удалось обновить локальный кэш.' }); }
            }
          }
          if (result.ok && method === 'POST' && request.url.split('?')[0] === `${root}rpc/set_specification_row_mark`) {
            cacheGeneratedMark(state, root, JSON.parse(await request.clone().text()));
            try { await write(owner, state); } catch { publish({ error: 'Не удалось обновить локальный кэш отметок.' }); }
          }
          publish({ offline: false });
          return result;
        } catch (error) {
          if (request.signal.aborted) throw error;
          publish({ offline: true });
        }
      }
      if (method === 'GET') return state.cache[key] ? response(state.cache[key]) : failure('Эти данные ещё не сохранены на устройстве. Откройте раздел при подключённом интернете.');
      if (method === 'POST' && request.url.split('?')[0] === `${root}rpc/set_specification_row_mark`) {
        const body = await request.text();
        const patch = JSON.parse(body) as Record<string, unknown>;
        if (!cacheGeneratedMark(state, root, patch)) return failure('Сначала откройте спецификацию при подключённом интернете.');
        state.queue.push({ id: crypto.randomUUID(), url: request.url, method, body, rowId: String(patch.p_parent_id), table: 'specification_row_marks' });
        await write(owner, state);
        publish({ pending: state.queue.length });
        return new Response(null, {status: 204});
      }
      const table = url.pathname.split('/').pop() || '';
      const rowId = url.searchParams.get('id')?.match(/^eq\.([a-zA-Z0-9-]+)$/)?.[1];
      if (!['PATCH', 'DELETE'].includes(method) || !rowId || ['users', 'app_roles'].includes(table)) return failure('Для этой операции требуется соединение с сервером.');
      let row: JsonRow | undefined;
      for (const [cacheKey, entry] of Object.entries(state.cache)) {
        if (!cacheKey.startsWith(`${root}${table}?`)) continue;
        const data = JSON.parse(entry.body);
        row = (Array.isArray(data) ? data : [data]).find(item => item?.id === rowId);
        if (row) break;
      }
      if (!row) return failure('Сначала откройте эту запись при подключённом интернете.');
      const body = method === 'PATCH' ? await request.text() : '';
      const change: Change = { id: crypto.randomUUID(), url: request.url, method, body, rowId, table };
      state.queue.push(change);
      apply(state, change);
      await write(owner, state); // Only acknowledge after durable storage succeeds.
      publish({ pending: state.queue.length });
      const representation = request.headers.get('prefer')?.includes('return=representation');
      if (!representation) return new Response(null, { status: 204 });
      const value = method === 'DELETE' ? row : { ...row, ...JSON.parse(body) };
      return new Response(JSON.stringify(request.headers.get('accept')?.includes('object+json') ? value : [value]), { headers: { 'Content-Type': 'application/json' } });
    });
  };
  return {
    fetch: transport,
    setAccount(id: string | null, headers?: HeadersInit) {
      account = id;
      if (headers) authHeaders = new Headers(headers);
      publish({ pending: 0, error: '' });
      if (id) void locked(async () => { const state = await read(id); if (account === id) publish({ pending: state.queue.length }); }).then(() => sync()).catch(() => publish({ error: 'Локальное хранилище недоступно' }));
    },
    sync,
  };
}
