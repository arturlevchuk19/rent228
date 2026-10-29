import { useEffect, useState, type ReactNode } from 'react';
import { getEventBudgets, createEventBudget } from '../lib/eventBudgets';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';

/** Legacy entry points resolve one budget before mounting any editor or specification. */
export function BudgetScope({ eventId, budgetId, onClose, children }: { eventId: string; budgetId?: string; onClose: () => void; children: (id: string, name: string) => ReactNode }) {
  const { user } = useAuth();
  const [resolved, setResolved] = useState<{ id: string; name: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setResolved(undefined); setError('');
    void (async () => {
      const budgets = await getEventBudgets(eventId);
      const primary = budgetId ? budgets.find(budget => budget.id === budgetId) : budgets[0] || (canAccess(user, 'budgets', 2) ? await createEventBudget(eventId, 'Основная смета', true) : undefined);
      if (primary?.is_primary) {
        // Migrate local preferences of the previous single-budget editor once.
        try {
          for (const prefix of ['budget_version','budget_payment_mode','budget_totals_mode','budget_sticky_notes','spec_sticky_notes','spec_composition_picked']) {
            const previous = localStorage.getItem(`${prefix}_${eventId}`);
            if (previous !== null && localStorage.getItem(`${prefix}_${primary.id}`) === null) localStorage.setItem(`${prefix}_${primary.id}`, previous);
          }
        } catch { /* Storage restrictions must not block the editor. */ }
      }
      if (active) { if (primary) setResolved({ id: primary.id, name: primary.name }); else setError('У мероприятия пока нет смет.'); }
    })().catch(caught => { if (active) setError(getErrorMessage(caught)); });
    return () => { active = false; };
  }, [eventId, budgetId, user]);
  if (!resolved) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><p role={error ? 'alert' : 'status'} className="rounded-xl border border-gray-700 bg-gray-900 p-5 text-gray-300">{error || 'Загрузка сметы...'}<button type="button" onClick={onClose} className="ml-3 text-cyan-400">Закрыть</button></p></div>;
  return children(resolved.id, resolved.name);
}
