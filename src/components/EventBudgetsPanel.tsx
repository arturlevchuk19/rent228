import { useState } from 'react';
import { Plus, Pencil, Trash2, Calculator, Check, X } from 'lucide-react';
import { createEventBudget, deleteEventBudget, renameEventBudget, type EventBudget } from '../lib/eventBudgets';
import { ProjectSection } from './ProjectSection';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';

export function EventBudgetsPanel({ eventId, budgets, onChanged, onOpen }: {
  eventId?: string; budgets: EventBudget[]; onChanged: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState<string>();
  const [nameDraft, setNameDraft] = useState('');
  const run = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await task(); } catch (caught) { setError(getErrorMessage(caught)); } finally { setBusy(false); } };
  return <ProjectSection title="Сметы мероприятия" defaultOpen count={budgets.length} titleActions={eventId && canAccess(user, 'budgets', 2) && <button type="button" disabled={busy} onClick={() => { const name = window.prompt('Название сметы', budgets.length ? `Смета ${budgets.length + 1}` : 'Основная смета'); if (name?.trim()) void run(async () => { const budget = await createEventBudget(eventId, name, budgets.length === 0); await onChanged(); onOpen(budget.id); }); }} aria-label="Добавить смету" title="Добавить смету" className="shrink-0 rounded-lg p-2 text-cyan-400 hover:bg-gray-800 disabled:opacity-40"><Plus className="h-4 w-4" /></button>}>
    <div className="space-y-3">
    {!eventId ? <p className="text-sm text-gray-500">Сохраните мероприятие, чтобы добавлять сметы.</p> : <>

      {!budgets.length && <p className="text-sm text-gray-500">Сметы ещё не добавлены.</p>}
      {budgets.map(budget => <div key={budget.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 p-3">
        {editingName === budget.id ? <div className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto sm:flex-1">
          <input autoFocus aria-label="Название сметы" value={nameDraft} disabled={busy} onChange={event => setNameDraft(event.target.value)} onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) setEditingName(undefined); }
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (!nameDraft.trim()) { setError('Укажите название сметы'); return; } void run(async () => { await renameEventBudget(budget.id, nameDraft); await onChanged(); setEditingName(undefined); }); }
          }} className="w-full min-w-0 rounded-lg border border-cyan-700 bg-gray-800 px-2 py-2 text-sm text-gray-200 outline-none" />
          <button type="button" aria-label="Сохранить название сметы" disabled={busy} onClick={() => { if (!nameDraft.trim()) { setError('Укажите название сметы'); return; } void run(async () => { await renameEventBudget(budget.id, nameDraft); await onChanged(); setEditingName(undefined); }); }} className="p-2 text-cyan-400"><Check className="h-4 w-4" /></button>
          <button type="button" aria-label="Отменить переименование" disabled={busy} onClick={() => setEditingName(undefined)} className="p-2 text-gray-400"><X className="h-4 w-4" /></button>
        </div> : <button type="button" aria-label={`Открыть смету: ${budget.name}`} disabled={!canAccess(user, 'budgets')} onClick={() => onOpen(budget.id)} className="flex min-w-0 basis-full items-center gap-2 text-left text-sm text-gray-200 sm:basis-auto sm:flex-1"><Calculator className="h-4 w-4 shrink-0 text-cyan-400" /><span className="break-words">{budget.name}</span></button>}
        {canAccess(user, 'budgets', 2) && editingName !== budget.id && <button type="button" disabled={busy} aria-label={`Переименовать ${budget.name}`} onClick={() => { setEditingName(budget.id); setNameDraft(budget.name); setError(''); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-1.5 text-xs text-gray-300"><Pencil className="h-4 w-4" /></button>}
        {canAccess(user, 'budgets', 3) && <button type="button" disabled={busy} aria-label={`Удалить ${budget.name}`} onClick={() => { if (window.confirm(`Удалить «${budget.name}» и её спецификацию?`)) void run(async () => { await deleteEventBudget(budget.id); await onChanged(); }); }} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>}
      </div>)}
    </>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  </ProjectSection>;
}
