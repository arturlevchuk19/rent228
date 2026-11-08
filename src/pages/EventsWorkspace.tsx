import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, List, Plus, Search } from 'lucide-react';
import { Calendar } from './Calendar';
import { Events } from './Events';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getEvents, EVENT_TYPES, type Event } from '../lib/events';
import { readEventsPreferences, writeEventsPreferences, type EventsCalendarView } from '../lib/eventsPreferences';
import { dayNumber } from '../lib/calendar';
import { searchInputProps } from '../lib/searchInput';

type View = 'calendar' | 'list';
const preferenceKey = 'events-display-mode';
const monthRange = (year: number, month: number): [number, number] => [Date.UTC(year, month, 1) / 86400000, Date.UTC(year, month + 1, 0) / 86400000];

export function EventsWorkspace({ refreshSignal = 0, onEventFormOpen, onSpecificationOpen, lastCreatedEventId }: {
  refreshSignal?: number;
  onEventFormOpen: (event?: Event) => void;
  onSpecificationOpen: (eventId: string, budgetId?: string) => void;
  lastCreatedEventId?: string | null;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const [saved] = useState(() => readEventsPreferences(userId));
  const [calendarView, setCalendarView] = useState<EventsCalendarView>(saved.calendarView);
  const calendarAllowed = canAccess(user, 'calendar');
  const listAllowed = canAccess(user, 'events');
  const [view, setView] = useState<View>(() => {
    try {
      if (new URL(location.href).searchParams.get('page') === 'calendar') return 'calendar';
      return saved.view;
    } catch { return 'calendar'; }
  });
  const mode = view === 'calendar' && calendarAllowed ? 'calendar' : listAllowed ? 'list' : 'calendar';
  const [period, setPeriod] = useState(saved.period);
  const [range, setRange] = useState<[number, number]>(() => {
    if (saved.calendarView === 'month') return monthRange(period.year, period.month);
    const start = Date.UTC(period.year,period.month,period.day) / 86400000;
    return [start, start + (saved.calendarView === 'fortnight' ? 13 : saved.calendarView === 'week' ? 6 : 0)];
  });
  const [filtersOpen, setFiltersOpen] = useState(saved.filtersOpen);
  const focusSearchOnOpen = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState(saved.search);
  const [type, setType] = useState(saved.type);
  const [status, setStatus] = useState(saved.status);
  const [allDates, setAllDates] = useState(saved.allDates);
  const [showCancelled, setShowCancelled] = useState(saved.showCancelled);
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
  const reportRange = useCallback((start: number, end: number) => {
    setRange(previous => previous[0] === start && previous[1] === end ? previous : [start, end]);
  }, []);
  useEffect(() => {
    if (filtersOpen && focusSearchOnOpen.current) searchRef.current?.focus();
    focusSearchOnOpen.current = false;
  }, [filtersOpen]);
  const activeFilters = Number(Boolean(search.trim())) + Number(type !== 'all') + Number(status !== 'all') + Number(showCancelled);
  const resetFilters = () => { setAllDates(false); setSearch(''); setType('all'); setStatus('all'); setShowCancelled(false); };
  useEffect(() => {
    writeEventsPreferences(userId, {view, calendarView, period, search, type, status, allDates, showCancelled, filtersOpen});
  }, [userId, view, calendarView, period, search, type, status, allDates, showCancelled, filtersOpen]);
  const field = 'min-h-11 min-w-0 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100';
  return <section aria-label="Мероприятия" className="flex h-full min-h-0 flex-col gap-3">
    {canAccess(user, 'events', 2) && <MobileHeaderContent><button type="button" aria-label="Добавить мероприятие" onClick={() => onEventFormOpen()} className="flex min-h-11 items-center gap-2 rounded-lg bg-accent-500 px-3 text-sm font-semibold text-gray-950 hover:bg-accent-400"><Plus className="h-4 w-4" /><span className="hidden md:inline">Добавить</span></button></MobileHeaderContent>}
    <MobileHeaderContent slot="afterTitle">
      <div role="group" aria-label="Режим отображения мероприятий" className="inline-flex shrink-0 gap-0.5 rounded-lg border border-gray-700 bg-gray-950 p-0.5">
        {([['calendar','Календарь',CalendarDays,calendarAllowed],['list','Список',List,listAllowed]] as const).filter(([, , , allowed]) => allowed).map(([value,label,Icon]) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={mode===value} onClick={() => changeMode(value)} className={`flex h-10 min-w-9 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold lg:px-3 ${mode===value ? 'bg-accent-500 text-gray-950' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'}`}><Icon className="h-4 w-4" /><span className="hidden lg:inline">{label}</span></button>)}
      </div>
    </MobileHeaderContent>
    <div id="event-search-filters" hidden={!filtersOpen} className={filtersOpen ? 'grid shrink-0 grid-cols-2 gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3 lg:grid-cols-[minmax(200px,1fr)_180px_180px_auto]' : 'hidden'} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setFiltersOpen(false); searchButtonRef.current?.focus(); }
    }}>
      <label className="relative col-span-2 lg:col-span-1"><span className="sr-only">Поиск мероприятий</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input ref={searchRef} {...searchInputProps} value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск мероприятий…" className={`${field} w-full pl-9`} /></label>
      <select aria-label="Статус мероприятий" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="all">Все статусы</option>{['Запрос','Подтверждено','Выполнено','Отменено'].map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Тип мероприятий" value={type} onChange={event => setType(event.target.value)} className={field}><option value="all">Все типы</option>{EVENT_TYPES.map(value => <option key={value}>{value}</option>)}</select>
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-xs text-gray-400 lg:col-span-1"><input type="checkbox" checked={showCancelled} onChange={event => setShowCancelled(event.target.checked)} className="h-4 w-4 accent-accent-500" />Показывать отменённые</label>
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 lg:col-span-4">
        {mode === 'list' && <button type="button" aria-pressed={allDates} onClick={() => setAllDates(value => !value)} className={`${field} mr-auto ${allDates ? 'ring-1 ring-inset ring-accent-500 text-accent-300' : 'hover:bg-gray-800'}`}>Все даты</button>}
        {activeFilters > 0 && <button type="button" onClick={resetFilters} className="min-h-11 rounded-lg px-3 text-sm text-gray-300 hover:bg-gray-800">Сбросить</button>}
        <button type="button" onClick={() => { setFiltersOpen(false); searchButtonRef.current?.focus(); }} className="min-h-11 rounded-lg px-3 text-sm text-gray-300 hover:bg-gray-800">Свернуть</button>
      </div>
    </div>
    {mode === 'list' && <p className="shrink-0 text-xs text-gray-400">{allDates ? 'Все даты, включая мероприятия без назначенной даты' : `Период: ${new Date(range[0] * 86400000).toLocaleDateString('ru-RU', {timeZone:'UTC'})} — ${new Date(range[1] * 86400000).toLocaleDateString('ru-RU', {timeZone:'UTC'})}`}</p>}
    {error && <div role="alert" className="shrink-0 rounded-lg border border-red-900 p-3 text-sm text-red-300">{error}<button type="button" onClick={() => setAttempt(value=>value+1)} className="ml-3 underline">Повторить</button></div>}
    {loading ? <div role="status" className="py-12 text-center text-gray-400">Загрузка мероприятий…</div> : <>
      <div className="min-h-0 flex-1"><Calendar initialView={calendarView} onViewChange={value => { setCalendarView(value); setAllDates(false); }} hideHeader eventsData={filtered} selectedPeriod={period} onPeriodChange={changeCalendarPeriod} onRangeChange={reportRange} onEventFormOpen={onEventFormOpen} onSpecificationOpen={onSpecificationOpen}
        toolbarActions={<>
          <button ref={searchButtonRef} type="button" aria-label={filtersOpen ? 'Свернуть поиск и фильтры' : 'Поиск и фильтры'} title="Поиск и фильтры" aria-expanded={filtersOpen} aria-controls="event-search-filters" onClick={() => { focusSearchOnOpen.current = !filtersOpen; setFiltersOpen(value => !value); }} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${filtersOpen || activeFilters ? 'border-accent-700 bg-accent-900/40 text-accent-300' : 'border-gray-700 text-gray-300 hover:bg-gray-800'}`}><Search className="h-5 w-5" />{activeFilters > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold text-gray-950">{activeFilters}<span className="sr-only"> активных фильтров</span></span>}</button>
</>}
        listContent={mode === 'list' && listAllowed ? <Events hideToolbar eventsData={listEvents} onRefresh={() => setAttempt(value=>value+1)} onEventFormOpen={onEventFormOpen} onSpecificationOpen={onSpecificationOpen} lastCreatedEventId={lastCreatedEventId} /> : undefined}
      /></div>
    </>}
  </section>;
}
