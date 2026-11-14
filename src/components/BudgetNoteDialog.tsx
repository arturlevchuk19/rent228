import { useEffect, useId, useRef, useState } from 'react';

interface BudgetNoteDialogProps {
  text: string;
  onSave: (text: string) => Promise<boolean>;
  onClose: () => void;
}

export function BudgetNoteDialog({ text, onSave, onClose }: BudgetNoteDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState(text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const close = () => dialog.current?.close();
  const save = async () => {
    setSaving(true);
    setError(false);
    try {
      if (await onSave(value)) close();
      else setError(true);
    } catch { setError(true); }
    finally { setSaving(false); }
  };
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onClose={onClose}
      onCancel={event => { if (saving) event.preventDefault(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-4 text-gray-100 backdrop:bg-black/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold">Примечание</h2>
        <button type="button" autoFocus disabled={saving} onClick={close}
          className="min-h-11 px-3 text-sm text-gray-300 focus-visible:outline-accent-500">Закрыть</button>
      </div>
      <textarea aria-label="Текст примечания" value={value} disabled={saving}
        onChange={event => setValue(event.target.value)} rows={12}
        className="w-full resize-y rounded-lg border border-gray-700 bg-gray-800 p-3 text-base leading-relaxed text-gray-100 focus-visible:outline-accent-500 [overflow-wrap:anywhere]" />
      {error && <p role="alert" className="mt-2 text-sm text-accent-300">Не удалось сохранить. Текст оставлен в окне — попробуйте ещё раз.</p>}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={saving} onClick={() => void save()}
          className="min-h-11 rounded-lg bg-accent-500 px-4 text-sm font-medium text-gray-950 hover:bg-accent-400 disabled:opacity-50">
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </dialog>
  );
}
