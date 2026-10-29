import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X } from 'lucide-react';
import type { EventBudget } from '../lib/eventBudgets';

export function BudgetDocumentDialog({ budgets, kind, onSelect, onClose }: {
  budgets: EventBudget[]; kind: 'pdf' | 'contract'; onSelect: (id: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[85dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-0 text-gray-200 backdrop:bg-black/70">
    <header className="flex items-center justify-between gap-3 border-b border-gray-800 p-4"><h2 id={titleId} className="text-lg font-semibold">{kind === 'pdf' ? 'Какую спецификацию сохранить?' : 'Для какой сметы создать договор?'}</h2><button type="button" aria-label="Закрыть выбор документа" onClick={onClose} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X className="h-5 w-5" /></button></header>
    <div className="space-y-2 p-4">{budgets.map(budget => <button key={budget.id} type="button" onClick={() => onSelect(budget.id)} className="flex w-full items-center gap-3 rounded-xl border border-gray-700 p-3 text-left text-sm hover:border-cyan-600 hover:bg-gray-800"><FileText className="h-5 w-5 shrink-0 text-cyan-400" /><span className="min-w-0 break-words">{budget.name}</span></button>)}</div>
  </dialog>, document.body);
}
