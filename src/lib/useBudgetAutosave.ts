import { useCallback, useEffect, useRef, useState } from 'react';
import { createBudgetAutosave, type AutosaveStatus } from './budgetAutosave';
import { getErrorMessage } from './errors';

export function useBudgetAutosave<T extends object>(key: string, snapshot: T, initial: T | null, enabled: boolean, write: (patch: Partial<T>) => Promise<unknown>) {
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const writer = useRef(write);
  writer.current = write;
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const [queue] = useState(() => createBudgetAutosave<T>(patch => writer.current(patch), (state, caught, pending) => {
    try {
      if (state === 'saved') localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(pending));
    } catch { /* Optional recovery cache; network saving remains active. */ }
    if (mounted.current) { setStatus(state); setError(caught ? getErrorMessage(caught) : ''); }
  }));
  const stage = useCallback(() => {
    if (!enabled || !initial) return;
    queue.initialize(initial);
    queue.stage(latest.current);
  }, [enabled, initial, queue]);
  const serialized = JSON.stringify(snapshot);
  useEffect(() => { stage(); }, [serialized, stage]);
  useEffect(() => {
    mounted.current = true;
    const retry = () => { void queue.flush().catch(() => {}); };
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    window.addEventListener('pagehide', retry);
    return () => {
      mounted.current = false;
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      window.removeEventListener('pagehide', retry);
      retry();
    };
  }, [queue]);
  return { status, error, flush: () => { stage(); return queue.flush(); } };
}
