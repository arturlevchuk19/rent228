import { useCallback, useEffect, useRef, useState } from 'react';
import { getBudgetEvent, updateBudgetSpecification } from './eventBudgets';
import { getErrorMessage } from './errors';

type Note = { id: string; content: string };
export function parseSpecificationNotes(value: unknown): Note[] | null {
  return Array.isArray(value) && value.every(note => note && typeof note.id === 'string' && typeof note.content === 'string') ? value : null;
}

export function useSpecificationNotes(eventId: string, budgetId: string, editable: boolean) {
  const [notes, setNotes] = useState<Note[]>([{ id: 'spec_note_1', content: '' }]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const queue = useRef(Promise.resolve());
  const key = `spec_sticky_notes_${budgetId}`;
  const save = useCallback((value: Note[]) => {
    try { localStorage.setItem(key, JSON.stringify(value)); localStorage.setItem(`${key}_pending`, JSON.stringify(value)); } catch { /* Server saving remains available. */ }
    queue.current = queue.current.catch(() => {}).then(async () => {
      await updateBudgetSpecification(eventId, budgetId, { spec_sticky_notes: value });
      try { if (localStorage.getItem(`${key}_pending`) === JSON.stringify(value)) localStorage.removeItem(`${key}_pending`); } catch { /* Optional cache. */ }
      setError('');
    }).catch(caught => { setError(`Не удалось сохранить заметки: ${getErrorMessage(caught)}. Откройте спецификацию повторно для повтора сохранения.`); });
  }, [key, eventId, budgetId]);
  useEffect(() => {
    let active = true;
    setReady(false);
    void (async () => {
      // Read the old browser copy before mounting the panel can change it.
      let local: Note[] | null = null;
      try { local = parseSpecificationNotes(JSON.parse(localStorage.getItem(key) || 'null')); } catch { /* No usable local notes. */ }
      const event = await getBudgetEvent(eventId, budgetId);
      if (!active) return;
      const remote = parseSpecificationNotes(event.spec_sticky_notes);
      let pending: Note[] | null = null;
      try { pending = parseSpecificationNotes(JSON.parse(localStorage.getItem(`${key}_pending`) || 'null')); } catch { /* Optional cache. */ }
      const value = pending ?? remote ?? local ?? [{ id: 'spec_note_1', content: '' }];
      setNotes(value.length ? value : [{ id: 'spec_note_1', content: '' }]);
      setReady(true);
      if (editable && (pending || (remote === null && local?.some(note => note.content.trim())))) save(value);
    })().catch(caught => { if (active) setError(`Не удалось загрузить заметки: ${getErrorMessage(caught)}`); });
    return () => { active = false; };
  }, [eventId, budgetId, editable, key, save]);
  return { notes, ready, error, changeNotes: (value: Note[]) => {
    if (!ready || !editable) return;
    setNotes(value);
    save(value);
  } };
}
