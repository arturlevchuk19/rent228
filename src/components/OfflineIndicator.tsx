import { useEffect, useState, useSyncExternalStore } from 'react';
import { getOfflineStatus, subscribeOffline } from '../lib/offline';
import { offlineTransport } from '../lib/supabase';

export function OfflineIndicator() {
  const status = useSyncExternalStore(subscribeOffline, getOfflineStatus);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (online && !status.offline && !status.pending && !status.error) return null;
  return <div role="status" aria-live="polite" className="sticky top-0 z-[100] border-b border-amber-800 bg-gray-950 px-4 py-2 text-sm text-amber-200">
    {!online || status.offline ? 'Нет связи. Доступны ранее открытые данные.' : status.syncing ? 'Отправка изменений…' : 'Ожидание синхронизации.'}
    {status.pending > 0 && <span> На устройстве: {status.pending} несинхронизированных правок.</span>}
    {status.error && <span> {status.error}</span>}
    {online && status.pending > 0 && <button type="button" disabled={status.syncing} onClick={() => void offlineTransport.sync()} className="ml-3 underline disabled:opacity-50">Повторить отправку</button>}
  </div>;
}
