import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getEvents, type Event } from '../lib/events';
import { dateFromDay, dayNumber, monthWeeks, weekSegments } from '../lib/calendar';
import { useAuth } from '../contexts/authContext';

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const shortMonths = ['Янв.', 'Февр.', 'Март', 'Апр.', 'Май', 'Июнь', 'Июль', 'Авг.', 'Сент.', 'Окт.', 'Нояб.', 'Дек.'];
const statuses: Record<string, string> = {
  'Запрос': 'bg-blue-600',
  'Подтверждено': 'bg-emerald-700', 'Выполнено': 'bg-gray-600 line-through'
};
const formatDate = (value: string) => {
  const day = dayNumber(value);
  return day === null ? 'Дата не указана' : dateFromDay(day).toLocaleDateString('ru-RU', { timeZone: 'UTC' });
};
interface CalendarProps {
  refreshSignal?: number;
  onEventFormOpen: (event: Event) => void;
  onSpecificationOpen: (eventId: string) => void;
}
export function Calendar({ onEventFormOpen, onSpecificationOpen, refreshSignal = 0 }: CalendarProps) {
  const { user } = useAuth();
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const selectedMonthRef = useRef<HTMLButtonElement>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Event | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoaded = useRef(false);
  useEffect(() => {
    let active = true;
    if (!hasLoaded.current) setLoading(true);
    setError('');
    getEvents().then(data => { if (active) { setEvents(data.filter(event => event.status !== 'Отменено')); hasLoaded.current = true; } })
      .catch(() => { if (active) setError('Не удалось загрузить мероприятия'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, refreshSignal]);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [selected]);
  useEffect(() => {
    if (!pickerOpen) return;
    selectedMonthRef.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false);
        pickerButtonRef.current?.focus();
      }
    };
    const focusOutside = (event: FocusEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('focusin', focusOutside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('focusin', focusOutside);
    };
  }, [pickerOpen]);
  const moveMonth = (direction: number) => {
    const next = new Date(year, month + direction, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
    setPickerOpen(false);
  };
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
  const weeks = monthWeeks(year, month);
  const count = events.filter(event => {
    const start = dayNumber(event.event_date);
    if (start === null) return false;
    const end = Math.max(start, dayNumber(event.event_end_date || '') ?? start);
    return start <= Date.UTC(year, month + 1, 0) / 86400000 && end >= Date.UTC(year, month, 1) / 86400000;
  }).length;
  const canEdit = user?.role !== 'warehouse' && user?.role !== 'staff';
  return <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
    <header className="relative hidden shrink-0 sm:flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-cyan-500" /><h1 className="text-2xl font-bold text-white">Календарь</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <MobileHeaderContent slot="title"><div ref={pickerRef} className="relative flex min-w-0 items-center gap-1">
          <button ref={pickerButtonRef} type="button" aria-haspopup="dialog" aria-expanded={pickerOpen} aria-controls="calendar-month-picker" onClick={() => {
            if (!pickerOpen) setPickerYear(year);
            setPickerOpen(value => !value);
          }} className="min-w-0 flex-1 truncate sm:min-w-44 rounded-lg border border-gray-700 bg-gray-900 px-2 sm:px-4 py-2 text-left text-sm sm:text-base font-medium text-white hover:border-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
            {months[month]} {year}
          </button>
          <button type="button" aria-label="Предыдущий месяц" disabled={year === 100 && month === 0} onClick={() => moveMonth(-1)} className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Следующий месяц" disabled={year === 9999 && month === 11} onClick={() => moveMonth(1)} className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
          {pickerOpen && <div id="calendar-month-picker" role="dialog" aria-label="Выбор месяца и года" className="fixed left-4 right-4 top-14 z-30 mt-2 w-auto sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-700 bg-[#10151e] p-3 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3 px-1 py-2">
              <button type="button" aria-label="Предыдущий год" disabled={pickerYear <= 100} onClick={() => setPickerYear(value => value - 1)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30"><ChevronLeft className="h-6 w-6" /></button>
              <span aria-live="polite" className="text-2xl font-semibold text-gray-100">{pickerYear}</span>
              <button type="button" aria-label="Следующий год" disabled={pickerYear >= 9999} onClick={() => setPickerYear(value => value + 1)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30"><ChevronRight className="h-6 w-6" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {shortMonths.map((name, index) => <button key={name} ref={index === month ? selectedMonthRef : undefined} type="button" aria-label={`${months[index]} ${pickerYear}`} aria-pressed={month === index && year === pickerYear} onClick={() => {
                setMonth(index); setYear(pickerYear); setPickerOpen(false); pickerButtonRef.current?.focus();
              }} className={`rounded-xl px-2 py-4 text-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${month === index && year === pickerYear ? 'bg-amber-500/15 font-semibold text-amber-300' : 'text-gray-200 hover:bg-gray-800'}`}>{name}</button>)}
            </div>
          </div>}
        </div></MobileHeaderContent>
      </div>
    </header>
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-gray-400">{Object.entries(statuses).map(([status, color]) => <span key={status} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}</span>)}</div>
    {!loading && !error && <p className="shrink-0 text-[10px] sm:text-xs text-gray-400">{count ? `Мероприятий в этом месяце: ${count}` : 'В этом месяце мероприятий нет'}</p>}
    {loading ? <div className="py-20 text-center text-gray-400" role="status">Загрузка календаря...</div> : error ? <div role="alert" className="rounded-lg border border-red-900 p-6 text-red-300">{error}<button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-3 underline">Повторить</button></div> : <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid shrink-0 grid-cols-7 border-b border-gray-700">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => <div key={day} className={`py-1 sm:py-2 text-center text-[10px] sm:text-xs font-medium uppercase ${index > 4 ? 'text-gray-500' : 'text-gray-300'}`}>{day}</div>)}</div>
          <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map(week => {
            const segments = weekSegments(events, week);
            return <div key={week} className="relative min-h-0 min-w-0 overflow-hidden border-b border-gray-700 last:border-b-0">
              <div className="absolute inset-0 grid grid-cols-7">{Array.from({ length: 7 }, (_, index) => {
                const day = week + index; const date = dateFromDay(day);
                const current = date.getUTCMonth() === month;
                return <div key={day} className={`border-r border-gray-800 p-0.5 sm:p-1 last:border-r-0 ${!current ? 'bg-black/20' : index > 4 ? 'bg-gray-950/30' : ''}`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${day === todayDay ? 'bg-cyan-600 font-bold text-white' : current ? 'text-gray-200' : 'text-gray-600'}`}>{date.getUTCDate()}</span></div>;
              })}</div>
              <div className="absolute inset-x-0 bottom-0 top-7 overflow-x-hidden overflow-y-auto overscroll-contain">
              <div className="grid min-w-0 grid-cols-7 gap-y-0.5 pb-1" style={{ gridAutoRows: 22 }}>
                {segments.map(segment => <button key={segment.event.id} type="button" onClick={() => setSelected(segment.event)} title={`${segment.event.name || segment.event.event_type}\n${formatDate(segment.event.event_date)} — ${formatDate(segment.event.event_end_date || segment.event.event_date)}${segment.event.venues?.name ? `\n${segment.event.venues.name}` : ''}`} style={{ gridColumn: `${segment.start + 1} / ${segment.end + 2}`, gridRow: segment.lane + 1 }} className={`mx-px min-w-0 truncate px-0.5 sm:px-2 text-left text-[10px] sm:text-xs font-medium text-white hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${statuses[segment.event.status] || 'bg-blue-600'} ${segment.continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'}`}>
                  {segment.continuesBefore && '‹ '}{segment.event.venues?.name || 'Место не указано'}{segment.continuesAfter && ' ›'}
                </button>)}
              </div>
              </div>
            </div>;
          })}
          </div>
        </div>
      </div>
    </>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3"><h2 id="calendar-event-title" className="text-xl font-semibold text-white">{selected.name || selected.event_type || 'Мероприятие'}</h2><button autoFocus type="button" aria-label="Закрыть" onClick={() => setSelected(null)} className="rounded p-1 text-gray-400 hover:bg-gray-800"><X className="h-5 w-5" /></button></div>
        <div className="space-y-3 text-sm text-gray-300"><p>{formatDate(selected.event_date)}{selected.event_end_date && selected.event_end_date !== selected.event_date ? ` — ${formatDate(selected.event_end_date)}` : ''}</p><p><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${statuses[selected.status] || 'bg-blue-600'}`} />{selected.status}</p>{selected.venues?.name && <p>Площадка: {selected.venues.name}</p>}{selected.event_type && <p>Тип: {selected.event_type}</p>}{selected.notes && <p className="whitespace-pre-wrap">{selected.notes}</p>}</div>
        <div className="mt-5 flex flex-wrap gap-2">{canEdit && <button type="button" onClick={() => { onEventFormOpen(selected); setSelected(null); }} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700">Открыть мероприятие</button>}{selected.status === 'Подтверждено' && <button type="button" onClick={() => { onSpecificationOpen(selected.id); setSelected(null); }} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800">Спецификация</button>}</div>
      </section>
    </div>}
  </div>;
}
