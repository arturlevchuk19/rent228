import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { getCollaborationSnapshot, sharedSpecificationTables, specificationStructureKey, type CollaborationSnapshot } from './specificationCollaboration';

/** Realtime invalidation plus polling covers missed events and reconnects. */
export function useSpecificationCollaboration(eventId: string, budgetId: string, enabled: boolean, apply: (snapshot: CollaborationSnapshot, structureChanged: boolean) => void) {
  const callback = useRef(apply); callback.current = apply;
  const request = useRef<() => void>(() => {});
  const [error, setError] = useState('');
  const refresh = useCallback(() => request.current(), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true, busy = false, again = false, version = 0;
    let structure: string | undefined;
    const read = async () => {
      version++;
      if (busy) { again = true; return; }
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      busy = true;
      const current = version;
      try {
        const snapshot = await getCollaborationSnapshot(eventId, budgetId);
        if (!active || current !== version) return;
        const next = specificationStructureKey(snapshot);
        callback.current(snapshot, structure !== undefined && next !== structure);
        structure = next;
        setError('');
      } catch { if (active) setError('Не удалось обновить общие отметки. Проверьте соединение; повторим автоматически.'); }
      finally { busy = false; if (active && again) { again = false; void read(); } }
    };
    request.current = () => { void read(); };
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const changed = () => { clearTimeout(debounce); debounce = setTimeout(() => { void read(); }, 150); };
    const channel = supabase.channel(`specification:${budgetId}:${Math.random().toString(36).slice(2)}`);
    for (const table of sharedSpecificationTables) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `budget_id=eq.${budgetId}` }, changed);
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'event_budgets', filter: `id=eq.${budgetId}` }, changed);
    channel.subscribe(status => { if (status === 'SUBSCRIBED') void read(); });
    const timer = setInterval(() => { void read(); }, 10000);
    const resume = () => { void read(); };
    window.addEventListener('focus', resume); window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    void read();
    return () => { active = false; request.current = () => {}; clearTimeout(debounce); clearInterval(timer); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); void supabase.removeChannel(channel); };
  }, [eventId, budgetId, enabled]);
  return { error, refresh };
}
