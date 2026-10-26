import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getEvents, type Event } from '../lib/events';
import { dateFromDay, dayNumber, monthWeeks, weekSegments } from '../lib/calendar';
import { useAuth } from '../contexts/authContext';

const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const statuses: Record<string, string> = {
  'Запрос': 'bg-blue-600', 'На рассмотрении': 'bg-amber-600',
  'Подтверждено': 'bg-emerald-700', 'Отменено': 'bg-gray-700 line-through opacity-70'
};
const formatDate = (value: string) => {
  const day = dayNumber(value);
  return day === null ? 'Дата не указана' : dateFromDay(day).toLocaleDateString('ru-RU', { timeZone: 'UTC' });
};
interface CalendarProps {
  onEventFormOpen: (event: Event) => void;
  onSpecificationOpen: (eventId: string) => void;
}
export function Calendar({ onEventFormOpen, onSpecificationOpen }: CalendarProps) {
  const { user } = useAuth();
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Event | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getEvents().then(data => { if (active) setEvents(data); })
      .catch(() => { if (active) setError('Не удалось загрузить мероприятия'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [selected]);
  const moveMonth = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setMonth(date.getMonth()); setYear(date.getFullYear());
  };
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
  const years = [...new Set([today.getFullYear(), year, ...events.flatMap(event =>
    [event.event_date, event.event_end_date].flatMap(value => {
      const day = dayNumber(value || ''); return day === null ? [] : [dateFromDay(day).getUTCFullYear()];
    })), ...Array.from({ length: 11 }, (_, index) => today.getFullYear() - 5 + index)])].sort((a, b) => a - b);
  const weeks = monthWeeks(year, month);
  const count = events.filter(event => {
    const start = dayNumber(event.event_date);
    if (start === null) return false;
    const end = Math.max(start, dayNumber(event.event_end_date || '') ?? start);
    return start <= Date.UTC(year, month + 1, 0) / 86400000 && end >= Date.UTC(year, month, 1) / 86400000;
  }).length;
  const canEdit = user?.role !== 'warehouse' && user?.role !== 'staff';
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><CalendarDays className="h-6 w-6 text-cyan-500" /><h1 className="text-2xl font-bold text-white">Календарь</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800">Сегодня</button>
        <button type="button" aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)} className="rounded p-2 text-gray-300 hover:bg-gray-800"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label="Следующий месяц" onClick={() => moveMonth(1)} className="rounded p-2 text-gray-300 hover:bg-gray-800"><ChevronRight className="h-5 w-5" /></button>
        <select aria-label="Месяц" value={month} onChange={event => setMonth(Number(event.target.value))} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white">{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
        <select aria-label="Год" value={year} onChange={event => setYear(Number(event.target.value))} className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white">{years.map(value => <option key={value}>{value}</option>)}</select>
      </div>
    </header>
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">{Object.entries(statuses).map(([status, color]) => <span key={status} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}</span>)}</div>
    {loading ? <div className="py-20 text-center text-gray-400" role="status">Загрузка календаря...</div> : error ? <div role="alert" className="rounded-lg border border-red-900 p-6 text-red-300">{error}<button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-3 underline">Повторить</button></div> : <>
      <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-gray-700">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => <div key={day} className={`py-3 text-center text-xs font-medium uppercase ${index > 4 ? 'text-gray-500' : 'text-gray-300'}`}>{day}</div>)}</div>
          {weeks.map(week => {
            const segments = weekSegments(events, week);
            const laneCount = Math.max(0, ...segments.map(segment => segment.lane + 1));
            return <div key={week} className="relative border-b border-gray-700 last:border-b-0" style={{ minHeight: Math.max(118, 44 + laneCount * 29) }}>
              <div className="absolute inset-0 grid grid-cols-7">{Array.from({ length: 7 }, (_, index) => {
                const day = week + index; const date = dateFromDay(day);
                const current = date.getUTCMonth() === month;
                return <div key={day} className={`border-r border-gray-800 p-2 last:border-r-0 ${!current ? 'bg-black/20' : index > 4 ? 'bg-gray-950/30' : ''}`}><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${day === todayDay ? 'bg-cyan-600 font-bold text-white' : current ? 'text-gray-200' : 'text-gray-600'}`}>{date.getUTCDate()}</span></div>;
              })}</div>
              <div className="relative grid grid-cols-7 gap-y-1 px-0.5 pb-3 pt-10" style={{ gridAutoRows: 25 }}>
                {segments.map(segment => <button key={segment.event.id} type="button" onClick={() => setSelected(segment.event)} title={`${segment.event.name || segment.event.event_type}\n${formatDate(segment.event.event_date)} — ${formatDate(segment.event.event_end_date || segment.event.event_date)}${segment.event.venues?.name ? `\n${segment.event.venues.name}` : ''}`} style={{ gridColumn: `${segment.start + 1} / ${segment.end + 2}`, gridRow: segment.lane + 1 }} className={`mx-0.5 truncate px-2 text-left text-xs font-medium text-white hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${statuses[segment.event.status] || 'bg-blue-600'} ${segment.continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'}`}>
                  {segment.continuesBefore && '‹ '}{segment.event.name || segment.event.event_type || 'Мероприятие'}{segment.continuesAfter && ' ›'}
                </button>)}
              </div>
            </div>;
          })}
        </div>
      </div>
      <p className="text-sm text-gray-400">{count ? `Мероприятий в этом месяце: ${count}` : 'В этом месяце мероприятий нет'}<span className="mt-1 block text-xs sm:hidden">Проведите по календарю влево или вправо для просмотра всех дней.</span></p>
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
