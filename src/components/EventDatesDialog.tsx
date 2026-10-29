import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CalendarX2, X } from 'lucide-react';
import { displayEventDate, parseEventDateInput } from '../lib/eventDates';

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState(false);
  const iso = parseEventDateInput(value);
  const calendarValue = iso && !iso.includes('-00') ? iso : '';
  return <div>
    <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-200">{label}</label>
    <div className="relative flex items-center rounded-xl border border-gray-700 bg-gray-800/50 focus-within:border-cyan-500">
      <input id={id} autoComplete="off" inputMode="numeric" placeholder="дд.мм.гггг" maxLength={10} value={value}
        onChange={event => onChange(event.target.value.replace(/[^\d.]/g, ''))}
        className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-3 text-base text-gray-200 outline-none" />
      <button type="button" aria-label={`Выбрать в календаре: ${label.toLowerCase()}`} onClick={() => {
        try { if (picker.current?.showPicker) picker.current.showPicker(); else setFallback(true); }
        catch { setFallback(true); }
      }} className="shrink-0 rounded-lg p-3 text-gray-300 hover:text-cyan-400"><CalendarDays className="h-5 w-5" /></button>
      <input ref={picker} type="date" tabIndex={-1} aria-label={`Календарь: ${label.toLowerCase()}`} value={calendarValue}
        onChange={event => { onChange(displayEventDate(event.target.value)); setFallback(false); }}
        className={fallback ? 'absolute left-0 top-full z-10 mt-1 rounded-lg border border-gray-600 bg-gray-800 p-2 text-white [color-scheme:dark]' : 'pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0'} />
    </div>
  </div>;
}

export function EventDatesDialog({ name, start, end, onApply, onClose }: {
  name: string; start: string; end: string;
  onApply: (start: string, end: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [from, setFrom] = useState(() => displayEventDate(start));
  const [to, setTo] = useState(() => displayEventDate(end));
  const [multiple, setMultiple] = useState(Boolean(end));
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  const apply = () => {
    const first = parseEventDateInput(from);
    const last = multiple ? parseEventDateInput(to) : '';
    if (first === null || last === null) { setError('Введите корректную дату в формате ДД.ММ.ГГГГ.'); return; }
    if (multiple && (!first || !last)) { setError('Укажите дату начала и окончания.'); return; }
    if (first && last && last < first) { setError('Дата окончания не может быть раньше даты начала.'); return; }
    onApply(first, last); onClose();
  };
  return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-800 bg-gray-900 p-0 text-gray-200 shadow-2xl backdrop:bg-black/70">
    <header className="flex items-center gap-3 border-b border-gray-800 px-4 py-3 sm:px-5">
      <h2 id={titleId} className="text-xl font-semibold">Даты</h2><span className="min-w-0 flex-1 truncate text-sm text-gray-400">{name || 'Мероприятие'}</span>
      <button type="button" aria-label="Закрыть даты" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"><X className="h-5 w-5" /></button>
    </header>
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); apply(); }} className="space-y-5 p-4 sm:p-5">
      <DateField label="Дата начала" value={from} onChange={value => { setFrom(value); setError(''); }} />
      <label className="flex w-fit cursor-pointer items-center gap-2 text-base"><input type="checkbox" checked={multiple} onChange={event => { setMultiple(event.target.checked); setError(''); }} className="h-5 w-5 accent-cyan-600" />Несколько дней</label>
      {multiple && <DateField label="Дата окончания" value={to} onChange={value => { setTo(value); setError(''); }} />}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { onApply('', ''); onClose(); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-3 text-sm text-gray-300 hover:bg-gray-800"><CalendarX2 className="h-4 w-4" />Убрать даты</button>
        <button type="submit" className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-medium text-white hover:bg-cyan-500">Готово</button>
      </footer>
    </form>
  </dialog>, document.body);
}
