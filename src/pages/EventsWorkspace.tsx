import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, List, Plus, Search } from 'lucide-react';
import { Calendar } from './Calendar';
import { Events } from './Events';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getEvents, EVENT_TYPES, type Event } from '../lib/events';
import { dayNumber } from '../lib/calendar';
import { searchInputProps } from '../lib/searchInput';

type View = 'calendar' | 'list';
const preferenceKey = 'events-display-mode';
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const monthRange = (year: number, month: number): [number, number] => [Date.UTC(year, month, 1) / 86400000, Date.UTC(year, month + 1, 0) / 86400000];

export function EventsWorkspace({ refreshSignal = 0, onEventFormOpen, onSpecificationOpen, lastCreatedEventId }: {
  refreshSignal?: number;
  onEventFormOpen: (event?: Event) => void;
  onSpecificationOpen: (eventId: string, budgetId?: string) => void;
  lastCreatedEventId?: string | null;
}) {
  const { user } = useAuth();
  const calendarAllowed = canAccess(user, 'calendar');
  const listAllowed = canAccess(user, 'events');
  const [view, setView] = useState<View>(() => {
    try {
      if (new URL(location.href).searchParams.get('page') === 'calendar') return 'calendar';
      return localStorage.getItem(preferenceKey) === 'list' ? 'list' : 'calendar';
    } catch { return 'calendar'; }
  });
  const mode = view === 'calendar' && calendarAllowed ? 'calendar' : listAllowed ? 'list' : 'calendar';
  const [period, setPeriod] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth(), day: new Date().getDate() }));
  const [range, setRange] = useState<[number, number]>(() => monthRange(period.year, period.month));
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [allDates, setAllDates] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const revealedEvent = useRef<string | null>(null);
  useEffect(() => {
    if (!lastCreatedEventId || revealedEvent.current === lastCreatedEventId) return;
    const created = events.find(event => event.id === lastCreatedEventId);
    const start = created && dayNumber(created.event_date);
    if (start === null || start === undefined) return;
    const date = new Date(start * 86400000);
    const next = {year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate()};
    setPeriod(next); setRange(monthRange(next.year, next.month)); setAllDates(false);
    revealedEvent.current = lastCreatedEventId;
  }, [lastCreatedEventId, events]);
  useEffect(() => {
    let active = true;
    setError('');
    getEvents().then(data => { if (active) setEvents(data); })
      .catch(() => { if (active) setError('Не удалось загрузить мероприятия. Попробуйте ещё раз.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshSignal, attempt]);
  const changeMode = (value: View) => {
    setView(value);
    try { localStorage.setItem(preferenceKey, value); } catch { /* Storage is optional. */ }
  };
  const changeCalendarPeriod = (value: {year: number; month: number; day?: number}) => {
    setPeriod(previous => previous.year === value.year && previous.month === value.month && previous.day === (value.day ?? 1) ? previous : {...value, day: value.day ?? 1});
    setAllDates(false);
  };
  const changePeriod = (value: {year: number; month: number; day?: number}) => {
    changeCalendarPeriod(value);
    if (!calendarAllowed) setRange(monthRange(value.year, value.month));
    setAllDates(false);
  };
  const filtered = useMemo(() => events.filter(event => {
    if (status !== 'all' && event.status !== status) return false;
    if (status === 'all' && !showCancelled && event.status === 'Отменено') return false;
    if (type !== 'all' && event.event_type !== type) return false;
    const query = search.trim().toLocaleLowerCase('ru-RU');
    return !query || [event.name, event.event_type, event.venues?.name, event.clients?.organization, event.clients?.full_name].some(value => value?.toLocaleLowerCase('ru-RU').includes(query));
  }), [events, search, type, status, showCancelled]);
  const listEvents = useMemo(() => filtered.filter(event => {
    if (allDates) return true;
    const start = dayNumber(event.event_date);
    if (start === null) return false;
    const end = Math.max(start, dayNumber(event.event_end_date || '') ?? start);
    return start <= range[1] && end >= range[0];
  }), [filtered, range, allDates]);
  const reportRange = useCallback((start: number, end: number) => setRange(previous => previous[0] === start && previous[1] === end ? previous : [start, end]), []);
  const field = 'min-h-11 min-w-0 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100';
  const years = [...new Set([period.year - 1, period.year, period.year + 1, ...events.map(event => Number(event.event_date?.slice(0, 4))).filter(year => year >= 100 && year <= 9999)])].sort((a,b) => b-a);
  return <section aria-label="Мероприятия" className="flex h-full min-h-0 flex-col gap-3">
    {canAccess(user, 'events', 2) && <MobileHeaderContent><button type="button" onClick={() => onEventFormOpen()} className="flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-3 text-sm font-semibold text-gray-950 hover:bg-accent-400"><Plus className="h-4 w-4" />Добавить</button></MobileHeaderContent>}
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Режим отображения мероприятий" className="inline-flex w-full gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1 sm:w-auto">
        {([['calendar','Календарь',CalendarDays,calendarAllowed],['list','Список',List,listAllowed]] as const).filter(([, , , allowed]) => allowed).map(([value,label,Icon]) => <button key={value} type="button" aria-pressed={mode===value} onClick={() => changeMode(value)} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold sm:flex-none ${mode===value ? 'bg-accent-500 text-gray-950' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      <div className={`flex w-full flex-wrap gap-2 sm:w-auto ${mode === 'calendar' ? 'hidden' : ''}`}>
        <select aria-label="Месяц мероприятий" value={period.month} onChange={event => changePeriod({...period,month:Number(event.target.value),day:1})} className={`${field} flex-1 sm:w-40`}>{months.map((month,index) => <option key={month} value={index}>{month}</option>)}</select>
        <select aria-label="Год мероприятий" value={period.year} onChange={event => changePeriod({...period,year:Number(event.target.value),day:1})} className={field}>{years.map(year => <option key={year}>{year}</option>)}</select>
        <button type="button" onClick={() => changePeriod({year:new Date().getFullYear(),month:new Date().getMonth(),day:new Date().getDate()})} className={`${field} hover:bg-gray-800`}>Сегодня</button>
        <button type="button" aria-pressed={allDates} onClick={() => setAllDates(value => !value)} className={`${field} ${allDates ? 'ring-1 ring-inset ring-accent-500 text-accent-300' : 'hover:bg-gray-800'}`}>Все даты</button>
      </div>
    </div>
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-[minmax(200px,1fr)_180px_180px_auto]">
      <label className="relative col-span-2 lg:col-span-1"><span className="sr-only">Поиск мероприятий</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input {...searchInputProps} value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск мероприятий…" className={`${field} w-full pl-9`} /></label>
      <select aria-label="Статус мероприятий" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="all">Все статусы</option>{['Запрос','Подтверждено','Выполнено','Отменено'].map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Тип мероприятий" value={type} onChange={event => setType(event.target.value)} className={field}><option value="all">Все типы</option>{EVENT_TYPES.map(value => <option key={value}>{value}</option>)}</select>
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-xs text-gray-400 lg:col-span-1"><input type="checkbox" checked={showCancelled} onChange={event => setShowCancelled(event.target.checked)} className="h-4 w-4 accent-accent-500" />Показывать отменённые</label>
    </div>
    {mode === 'list' && <p className="shrink-0 text-xs text-gray-400">{allDates ? 'Все даты, включая мероприятия без назначенной даты' : `Период: ${new Date(range[0] * 86400000).toLocaleDateString('ru-RU', {timeZone:'UTC'})} — ${new Date(range[1] * 86400000).toLocaleDateString('ru-RU', {timeZone:'UTC'})}`}</p>}
    {error && <div role="alert" className="shrink-0 rounded-lg border border-red-900 p-3 text-sm text-red-300">{error}<button type="button" onClick={() => setAttempt(value=>value+1)} className="ml-3 underline">Повторить</button></div>}
    {loading ? <div role="status" className="py-12 text-center text-gray-400">Загрузка мероприятий…</div> : <>
      {calendarAllowed && <div hidden={mode !== 'calendar'} className={mode === 'calendar' ? 'min-h-0 flex-1' : 'hidden'}><Calendar hideHeader eventsData={filtered} selectedPeriod={period} onPeriodChange={changeCalendarPeriod} onRangeChange={reportRange} onEventFormOpen={onEventFormOpen} onSpecificationOpen={onSpecificationOpen} /></div>}
      {mode === 'list' && listAllowed && <div className="min-h-0 flex-1 overflow-y-auto"><Events hideToolbar eventsData={listEvents} onRefresh={() => setAttempt(value=>value+1)} onEventFormOpen={onEventFormOpen} onSpecificationOpen={onSpecificationOpen} lastCreatedEventId={lastCreatedEventId} /></div>}
    </>}
  </section>;
}
