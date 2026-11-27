import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Calculator, Minus, Plus, X } from 'lucide-react';

export function SpecificationCalculatorDialog({ title, children, onClose, onSave }: {
  title: string; children: ReactNode; onClose: () => void; onSave: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-[600px] flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 p-0 text-gray-100 shadow-2xl backdrop:bg-black/50 open:flex">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 shrink-0 text-accent-500" aria-hidden="true" />
          <h3 id={titleId} className="text-lg font-bold text-white">{title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть калькулятор" className="grid min-h-11 min-w-11 shrink-0 place-items-center text-gray-400 transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-gray-800 bg-gray-800/30 px-4 py-3 sm:px-6">
        <button type="button" onClick={onClose} className="min-h-11 px-4 text-sm font-medium text-gray-400 transition-colors hover:text-white">Отмена</button>
        <button type="button" onClick={onSave} className="min-h-11 rounded-lg bg-accent-500 px-6 text-sm font-medium text-gray-950 transition-colors hover:bg-accent-400">Сохранить</button>
      </div>
    </dialog>
  );
}

export function SpecificationCalculatorQuantity({ name, quantity, onChange, descriptionId }: {
  name: string; quantity: number; onChange: (quantity: number) => void; descriptionId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-700">
      <button type="button" onClick={() => onChange(Math.max(0, quantity - 1))} disabled={quantity <= 0}
        aria-label={`Уменьшить количество: ${name}`} className="grid min-h-11 w-8 place-items-center text-gray-300 hover:text-white disabled:opacity-40">
        <Minus className="h-4 w-4" />
      </button>
      <input type="number" min="0" aria-label={`Количество: ${name}`} aria-describedby={descriptionId} value={draft ?? quantity}
        onChange={event => {
          const value = event.target.value;
          setDraft(value);
          if (/^\d+$/.test(value) && Number.isSafeInteger(Number(value))) onChange(Number(value));
        }}
        onBlur={() => setDraft(null)} className="h-11 w-14 bg-transparent text-center text-sm tabular-nums text-white" />
      <button type="button" onClick={() => onChange(quantity + 1)} aria-label={`Увеличить количество: ${name}`}
        className="grid min-h-11 w-8 place-items-center text-gray-300 hover:text-white">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
