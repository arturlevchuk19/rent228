import { useRef, useState } from 'react';

interface InlineQuantityAddProps {
  name: string;
  onAdd: (quantity: number) => Promise<boolean>;
  onClose: () => void;
}

export function InlineQuantityAdd({ name, onAdd, onClose }: InlineQuantityAddProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const cancelled = useRef(false);
  const commit = async () => {
    if (pending.current || cancelled.current || !value.trim()) return;
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Введите количество больше нуля');
      return;
    }
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      if (await onAdd(quantity)) {
        cancelled.current = true;
        onClose();
      } else {
        setError('Не удалось добавить позицию. Повторите попытку.');
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const cancel = () => {
    cancelled.current = true;
    onClose();
  };
  return <form className="space-y-1 bg-gray-800/60 px-3 pb-3 pt-1" onSubmit={event => { event.preventDefault(); void commit(); }}>
    <label className="flex items-center gap-2 text-xs text-gray-300">
      Количество
      <input autoFocus type="number" inputMode="decimal" step="any" min="0" aria-label={`Количество: ${name}`} value={value} disabled={saving} placeholder="Введите количество" onChange={event => { setValue(event.target.value); setError(''); }} onBlur={() => { void commit(); }} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      }} className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-white focus:border-cyan-500 focus:outline-none" />
    </label>
    <div className="flex items-center justify-end gap-2">
      <button type="button" disabled={saving} onPointerDown={event => event.preventDefault()} onClick={cancel} className="px-2 py-1 text-xs text-gray-400 hover:text-white">Отмена</button>
      <button type="submit" disabled={saving} className="rounded bg-cyan-600 px-2 py-1 text-xs text-white disabled:opacity-50">{saving ? 'Добавление...' : 'Добавить'}</button>
    </div>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </form>;
}
