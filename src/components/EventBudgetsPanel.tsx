import { useRef, useState } from 'react';
import { Plus, Pencil, Copy, Trash2, Calculator, Check, X } from 'lucide-react';
import { createEventBudget, duplicateEventBudget, deleteEventBudget, renameEventBudget, setPrimaryEventBudget, type EventBudget } from '../lib/eventBudgets';
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
  const running = useRef(false);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState<string>();
  const [nameDraft, setNameDraft] = useState('');
  const run = async (task: () => Promise<void>) => { if (running.current) return; running.current = true; setBusy(true); setError(''); try { await task(); } catch (caught) { setError(getErrorMessage(caught)); } finally { running.current = false; setBusy(false); } };
  const canEdit = canAccess(user, 'budgets', 2);
  const canDelete = canAccess(user, 'budgets', 3);
  const canOpen = canAccess(user, 'budgets');
  const iconButton = 'inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-40 min-[360px]:w-11 sm:h-9 sm:w-9';
  const secondaryButton = `${iconButton} text-gray-400 hover:bg-gray-800 hover:text-gray-100`;

  const saveName = (id: string) => {
    if (!nameDraft.trim()) {
      setError('Укажите название сметы');
      return;
    }
    void run(async () => {
      await renameEventBudget(id, nameDraft);
      await onChanged();
      setEditingName(undefined);
    });
  };

  return <ProjectSection title="Сметы мероприятия" defaultOpen count={budgets.length} titleActions={eventId && canEdit &&
    <button type="button" disabled={busy} onClick={() => {
      const name = window.prompt('Название сметы', budgets.length ? `Смета ${budgets.length + 1}` : 'Основная смета');
      if (name?.trim()) void run(async () => {
        const budget = await createEventBudget(eventId, name, budgets.length === 0);
        await onChanged();
        onOpen(budget.id);
      });
    }} aria-label="Добавить смету" title="Добавить смету" className={`${iconButton} text-accent-400 hover:bg-gray-800`}>
      <Plus aria-hidden="true" className="h-4 w-4" />
    </button>}>
    <div className="space-y-2">
      {!eventId ? <p className="text-sm text-gray-400">Сохраните мероприятие, чтобы добавлять сметы.</p> :
        !budgets.length ? <p className="text-sm text-gray-400">Сметы ещё не добавлены.</p> :
        budgets.map(budget => <div key={budget.id} className={`relative rounded-xl border px-2 py-1 sm:px-3 ${budget.is_primary
          ? 'border-accent-700/60 bg-accent-500/5'
          : 'border-gray-800 bg-gray-950/30'}`}>
          {editingName === budget.id ? <div className="flex min-w-0 items-center gap-1">
            <input autoFocus aria-label="Название сметы" value={nameDraft} disabled={busy}
              onChange={event => setNameDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!busy) setEditingName(undefined);
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  saveName(budget.id);
                }
              }} className="min-h-11 min-w-0 flex-1 rounded-lg border border-accent-700 bg-gray-950 px-2 text-base text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 sm:min-h-9 sm:text-sm" />
            <button type="button" aria-label="Сохранить название сметы" disabled={busy} onClick={() => saveName(budget.id)}
              className={`${iconButton} text-accent-400 hover:bg-gray-800`}><Check aria-hidden="true" className="h-4 w-4" /></button>
            <button type="button" aria-label="Отменить переименование" disabled={busy} onClick={() => setEditingName(undefined)}
              className={secondaryButton}><X aria-hidden="true" className="h-4 w-4" /></button>
          </div> : <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center">
            <button type="button" aria-label={`Открыть смету: ${budget.name}`} disabled={busy || !canOpen}
              onClick={() => onOpen(budget.id)}
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left before:absolute before:inset-0 before:rounded-xl hover:before:bg-white/[.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:hover:before:bg-transparent">
              <Calculator aria-hidden="true" className={`h-4 w-4 shrink-0 ${budget.is_primary ? 'text-accent-400' : 'text-gray-400'}`} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold leading-snug sm:text-sm text-gray-100 [overflow-wrap:anywhere]">{budget.name}</span>
                {budget.is_primary && <span className="text-xs leading-tight text-accent-300">Основная</span>}
              </span>
            </button>

            <div className="relative flex items-center">
              {canEdit && <>
                <button type="button" disabled={busy} aria-label={`Переименовать ${budget.name}`} title="Переименовать смету"
                  onClick={() => { setEditingName(budget.id); setNameDraft(budget.name); setError(''); }}
                  className={secondaryButton}><Pencil aria-hidden="true" className="h-4 w-4" /></button>
                <button type="button" disabled={busy} aria-label={`Копировать ${budget.name}`} title="Копировать смету"
                  onClick={() => void run(async () => { await duplicateEventBudget(budget.id); await onChanged(); })}
                  className={secondaryButton}><Copy aria-hidden="true" className="h-4 w-4" /></button>
              </>}
              {canDelete && <button type="button" disabled={busy} aria-label={`Удалить ${budget.name}`} title="Удалить смету"
                onClick={() => {
                  if (window.confirm(`Удалить «${budget.name}» и её спецификацию?`)) void run(async () => {
                    await deleteEventBudget(budget.id);
                    await onChanged();
                  });
                }} className={`${iconButton} text-red-400 hover:bg-red-900/20`}><Trash2 aria-hidden="true" className="h-4 w-4" /></button>}
            </div>

            {!budget.is_primary && canEdit && <button type="button" disabled={busy}
              onClick={() => void run(async () => { await setPrimaryEventBudget(eventId, budget.id); await onChanged(); })}
              className="relative col-span-2 ml-5 min-h-8 justify-self-start rounded-lg px-1 text-left text-xs text-gray-300 hover:bg-gray-800 hover:text-accent-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-40">
              Сделать основной
            </button>}
          </div>}
        </div>)}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  </ProjectSection>;
}
