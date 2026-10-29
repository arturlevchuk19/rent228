import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Calculator } from 'lucide-react';
import { createEventBudget, deleteEventBudget, renameEventBudget, type EventBudget } from '../lib/eventBudgets';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';

export function EventBudgetsPanel({ eventId, budgets, onChanged, onOpen, onSpecification }: {
  eventId?: string; budgets: EventBudget[]; onChanged: () => Promise<void>;
  onOpen: (id: string) => void; onSpecification: (id: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await task(); } catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); } };
  return <div className="space-y-3">
    {!eventId ? <p className="text-sm text-gray-500">Сохраните мероприятие, чтобы добавлять сметы.</p> : <>
      {canAccess(user, 'budgets', 2) && <button type="button" disabled={busy} onClick={() => { const name = window.prompt('Название сметы', budgets.length ? `Смета ${budgets.length + 1}` : 'Основная смета'); if (name?.trim()) void run(async () => { const budget = await createEventBudget(eventId, name, budgets.length === 0); await onChanged(); onOpen(budget.id); }); }} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"><Plus className="h-4 w-4" />Добавить смету</button>}
      {!budgets.length && <p className="text-sm text-gray-500">Сметы ещё не добавлены.</p>}
      {budgets.map(budget => <div key={budget.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 p-3">
        <button type="button" aria-label={`Открыть смету: ${budget.name}`} disabled={!canAccess(user, 'budgets')} onClick={() => onOpen(budget.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-gray-200"><Calculator className="h-4 w-4 shrink-0 text-cyan-400" /><span className="break-words">{budget.name}</span></button>
        {canAccess(user, 'specifications') && <button type="button" aria-label={`Открыть спецификацию: ${budget.name}`} onClick={() => onSpecification(budget.id)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1.5 text-xs text-gray-300"><FileText className="h-4 w-4" />Спецификация</button>}
        {canAccess(user, 'budgets', 2) && <button type="button" disabled={busy} aria-label={`Переименовать ${budget.name}`} onClick={() => { const name = window.prompt('Название сметы', budget.name); if (name?.trim()) void run(async () => { await renameEventBudget(budget.id, name); await onChanged(); }); }} className="p-2 text-gray-400"><Pencil className="h-4 w-4" /></button>}
        {canAccess(user, 'budgets', 3) && <button type="button" disabled={busy} aria-label={`Удалить ${budget.name}`} onClick={() => { if (window.confirm(`Удалить «${budget.name}» и её спецификацию?`)) void run(async () => { await deleteEventBudget(budget.id); await onChanged(); }); }} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>}
      </div>)}
    </>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </div>;
}
