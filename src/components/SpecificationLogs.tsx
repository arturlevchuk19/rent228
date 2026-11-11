import { useCallback, useEffect, useRef, useState } from 'react';
import { activityDescription, getSpecificationActivity, type SpecificationActivity } from '../lib/specificationCollaboration';

export function SpecificationLogs({ eventId, budgetId, onClose }: {eventId: string; budgetId: string; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<SpecificationActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const alive = useRef(true);
  const fetching = useRef(false);
  const read = useCallback(async (before?: number) => {
    if (fetching.current) return;
    fetching.current = true; setBusy(true); setError('');
    try {
      const page = await getSpecificationActivity(eventId, budgetId, before);
      if (alive.current) { setEntries(previous => before === undefined ? page : [...previous, ...page]); setMore(page.length === 50); }
    } catch { if (alive.current) setError('Не удалось загрузить журнал. Проверьте связь и доступ к спецификации.'); }
    finally { fetching.current = false; if (alive.current) setBusy(false); }
  }, [eventId, budgetId]);
  useEffect(() => { alive.current = true; dialog.current?.showModal(); void read(); return () => { alive.current = false; }; }, [read]);
  return <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="specification-logs-title" className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4 text-gray-200 backdrop:bg-black/70">
    <div className="flex items-center justify-between gap-3"><h2 id="specification-logs-title" className="text-lg font-semibold">Логи спецификации</h2><button type="button" autoFocus onClick={onClose} className="min-h-11 rounded px-3 hover:bg-gray-800">Закрыть</button></div>
    <p className="mt-1 text-sm text-gray-400">Кто и что изменил. Новые действия отображаются сверху. История ведётся с момента включения журнала.</p>
    <button type="button" disabled={busy} onClick={() => void read()} className="my-3 min-h-11 rounded border border-gray-700 px-3 text-sm hover:bg-gray-800 disabled:opacity-50">{busy ? 'Загрузка…' : 'Обновить'}</button>
    {error && <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
    {!busy && !error && entries.length === 0 && <p className="py-8 text-center text-gray-400">Действий пока нет.</p>}
    <ol className="divide-y divide-gray-800">{entries.map(entry => <li key={entry.id} className="py-3"><div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="font-medium text-white">{entry.actor_name}</span><time dateTime={entry.created_at} className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString('ru-RU')}</time></div><p className="mt-1 break-words text-sm text-accent-400">{entry.row_name}</p><ul className="mt-1 space-y-1 text-sm">{activityDescription(entry).map((line,index) => <li key={index} className="whitespace-pre-wrap break-words">{line}</li>)}</ul></li>)}</ol>
    {more && <button type="button" disabled={busy} onClick={() => void read(entries[entries.length-1]?.id)} className="mt-3 min-h-11 w-full rounded border border-gray-700 px-3 disabled:opacity-50">Показать ещё</button>}
  </dialog>;
}
