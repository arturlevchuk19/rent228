import { searchInputProps } from '../lib/searchInput';
import { BudgetDocumentDialog } from '../components/BudgetDocumentDialog';
import { getEventBudgets, type EventBudget } from '../lib/eventBudgets';
import { getErrorMessage } from '../lib/errors';
import { canAccess } from '../lib/roles';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import React, { useEffect, useState, useRef } from 'react';
import { Calendar, Plus, Pencil, Trash2, Search, Filter, FileText, Truck, CheckCircle, CreditCard, ClipboardCheck, ReceiptText } from 'lucide-react';
import { getEvents, deleteEvent, Event, EVENT_TYPES } from '../lib/events';
import { useAuth } from '../contexts/authContext';

interface EventsProps {
  refreshSignal?: number;
  onEventFormOpen?: (event?: Event) => void;
  onSpecificationOpen?: (eventId: string, budgetId?: string) => void;
  lastCreatedEventId?: string | null;
}

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export function Events({ onEventFormOpen, onSpecificationOpen, lastCreatedEventId, refreshSignal = 0 }: EventsProps) {
  const { user } = useAuth();
  const [specificationChoice, setSpecificationChoice] = useState<{ eventId: string; budgets: EventBudget[] } | null>(null);
  const [loadingSpecifications, setLoadingSpecifications] = useState(false);
  const specificationRequest = useRef(false);
  const openSpecification = async (eventId: string) => {
    if (specificationRequest.current || !canAccess(user, 'specifications')) return;
    specificationRequest.current = true;
    setLoadingSpecifications(true);
    try {
      const budgets = await getEventBudgets(eventId);
      if (budgets.length === 1) onSpecificationOpen?.(eventId, budgets[0].id);
      else if (budgets.length > 1) setSpecificationChoice({ eventId, budgets });
      else alert('В мероприятии пока нет смет и спецификаций.');
    } catch (error) { alert(`Не удалось загрузить спецификации: ${getErrorMessage(error)}`); }
    finally { specificationRequest.current = false; setLoadingSpecifications(false); }
  };
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(() => String(new Date().getFullYear()));
  const [showCancelled, setShowCancelled] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleEventCount, setVisibleEventCount] = useState(50);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});
  const eventRefs = useRef<Record<string, HTMLElement | null>>({});
  const hasScrolled = useRef(false);

  useEffect(() => {
    let active = true;
    getEvents().then(data => { if (active) setEvents(data); })
      .catch(error => { if (active) console.error('Error loading events:', error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshSignal]);

  useEffect(() => {
    setVisibleEventCount(50);
  }, [searchTerm, filterType, filterMonth, filterYear, showCancelled]);

  useEffect(() => {
    if (!loading && events.length > 0 && !hasScrolled.current) {
      if (lastCreatedEventId) {
        const element = eventRefs.current[lastCreatedEventId] || eventRefs.current[lastCreatedEventId + '-mobile'];
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
          hasScrolled.current = true;
          return;
        }
      }

      const nearestEventIndex = events.findIndex(isNearestEvent);
      if (nearestEventIndex >= 0 && nearestEventIndex >= visibleEventCount) {
        setVisibleEventCount(nearestEventIndex + 1);
        return;
      }

      const nearestEvent = events.find(isNearestEvent);
      const nearestEventElement = nearestEvent
        ? (eventRefs.current[nearestEvent.id] || eventRefs.current[nearestEvent.id + '-mobile'])
        : null;

      if (nearestEventElement) {
        setTimeout(() => {
          nearestEventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        hasScrolled.current = true;
      }
    }
  }, [loading, events, lastCreatedEventId, visibleEventCount]);

  const loadEvents = async () => {
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const canEditDelete = canAccess(user, 'events', 2);
  const canSeeEventProgress = canAccess(user, 'budgets');

  const getEventDateKey = (event: Event): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.event_date || '')) return null;
    const timestamp = Date.parse(event.event_date + 'T00:00:00');
    return Number.isNaN(timestamp) ? null : event.event_date;
  };

  const nearestEventDateKey = (() => {
    const activeEvents = events.filter((event) => event.status !== 'Отменено');
    const candidates = activeEvents.length > 0 ? activeEvents : events;
    const datedEvents = candidates
      .map((event) => ({ event, dateKey: getEventDateKey(event) }))
      .filter((item): item is { event: Event; dateKey: string } => Boolean(item.dateKey));
    if (datedEvents.length === 0) return null;

    const todayKey = new Date().toISOString().slice(0, 10);
    const upcoming = datedEvents
      .filter((item) => item.dateKey >= todayKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return (upcoming[0] || datedEvents.sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]).dateKey;
  })();

  const isNearestEvent = (event: Event) => getEventDateKey(event) === nearestEventDateKey;

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это мероприятие?')) return;

    try {
      await deleteEvent(id);
      await loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Ошибка при удалении');
    }
  };

  const getEventMonthTitle = (event: Event) => {
    if (!event.event_date) return 'Дата не установлена';
    const parts = event.event_date.split('-');
    if (parts.length === 3) {
      const m = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12) {
        return `${monthNames[m - 1]} ${parts[0]}`;
      }
    }
    return 'Дата не установлена';
  };

  const availableYears = Array.from(new Set(
    events
      .map(event => event.event_date?.slice(0, 4))
      .filter((year): year is string => Boolean(year && /^\d{4}$/.test(year)))
  )).sort((a, b) => Number(b) - Number(a));

  const availableMonths = Array.from(new Set(events.map(getEventMonthTitle)))
    .filter(title => title !== 'Дата не установлена')
    .sort((a, b) => {
      const partsA = a.split(' ');
      const partsB = b.split(' ');
      if (partsA[1] !== partsB[1]) return parseInt(partsB[1]) - parseInt(partsA[1]);
      return monthNames.indexOf(partsB[0]) - monthNames.indexOf(partsA[0]);
    });

  const filteredEvents = events.filter(event => {
    const matchesSearch =
      event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.clients?.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venues?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || event.event_type === filterType;
    const matchesMonth = filterMonth === 'all' || getEventMonthTitle(event) === filterMonth;
    const matchesYear = filterYear === 'all' || event.event_date?.slice(0, 4) === filterYear;
    const matchesCancelled = showCancelled || event.status !== 'Отменено';
    return matchesSearch && matchesType && matchesMonth && matchesYear && matchesCancelled;
  });

  const visibleEvents = filteredEvents.slice(0, visibleEventCount);

  const groupsMap = new Map<string, Event[]>();
  const titlesOrder: string[] = [];

  visibleEvents.forEach(event => {
    let title = 'Дата не установлена';
    if (event.event_date) {
      const parts = event.event_date.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        if (m >= 1 && m <= 12) {
          title = `${monthNames[m - 1]} ${parts[0]}`;
        }
      }
    }
    
    if (!groupsMap.has(title)) {
      groupsMap.set(title, []);
      if (title !== 'Дата не установлена') {
        titlesOrder.push(title);
      }
    }
    groupsMap.get(title)!.push(event);
  });

  const groupedEvents = titlesOrder.map(title => ({
    title,
    events: groupsMap.get(title)!
  }));
  
  if (groupsMap.has('Дата не установлена')) {
    groupedEvents.push({
      title: 'Дата не установлена',
      events: groupsMap.get('Дата не установлена')!
    });
  }

  const getStatusColor = (status: string) => {
    const colors = {
      'Запрос': 'bg-accent-900/50 text-accent-200 border-accent-700/60',
      'Подтверждено': 'bg-green-900/30 text-green-400 border-green-600',
      'Отменено': 'bg-red-900/30 text-red-400 border-red-600',
      'Выполнено': 'bg-gray-800 text-gray-400 border-gray-600'
    };
    return colors[status as keyof typeof colors] || colors['Запрос'];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}.${month}.${year}`;
    }
    return dateString;
  };

  const formatDateRange = (event: Event) => {
    const start = formatDate(event.event_date);
    if (event.event_end_date) {
      return `${start} - ${formatDate(event.event_end_date)}`;
    }
    return start;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div hidden>
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-accent-500" />
          <h1 className="text-2xl font-bold text-white">Мероприятия</h1>
        </div>
        {canEditDelete && (
          <MobileHeaderContent><button disabled={!canAccess(user, 'events', 2)}
            onClick={() => onEventFormOpen?.()}
            className="flex items-center gap-2 min-h-11 px-4 py-2 bg-accent-500 hover:bg-accent-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button></MobileHeaderContent>
        )}
      </div>

      <div className="hidden md:block bg-gray-900 rounded-xl p-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск..."
              {...searchInputProps} value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent-500 appearance-none"
            >
              <option value="all">Все типы</option>
              {EVENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent-500 appearance-none"
            >
              <option value="all">Все года</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent-500 appearance-none"
            >
              <option value="all">Все месяцы</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-3 text-sm">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-accent-600 focus:ring-accent-500 focus:ring-offset-gray-900 cursor-pointer"
          />
          <span className="text-gray-400 select-none">Показывать отмененные</span>
        </label>
      </div>

      <div className="md:hidden">
        <button type="button" onClick={() => setShowMobileFilters(true)} className="min-h-11 w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-200">
          <Filter className="w-4 h-4" /> Фильтр
        </button>
      </div>
      {showMobileFilters && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 p-4" onClick={() => setShowMobileFilters(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mt-16 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Фильтры</h2>
              <button type="button" onClick={() => setShowMobileFilters(false)} className="text-gray-400 hover:text-white">Закрыть</button>
            </div>
            <input type="text" placeholder="Поиск..." {...searchInputProps} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="min-h-11 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="min-h-11 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="all">Все типы</option>{EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="min-h-11 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="all">Все года</option>{availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="min-h-11 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="all">Все месяцы</option>{availableMonths.map(month => <option key={month} value={month}>{month}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="w-4 h-4" />Показывать отмененные</label>
            <button type="button" onClick={() => setShowMobileFilters(false)} className="min-h-11 w-full px-3 py-2 bg-accent-500 text-gray-950 font-semibold rounded-lg text-sm">Применить</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-gray-900">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Дата
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Площадка
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Заказчик
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Название / Тип
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Статус
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Прогресс
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {groupedEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Мероприятия не найдены
                  </td>
                </tr>
              ) : (
                groupedEvents.map((group) => (
                  <React.Fragment key={group.title}>
                    <tr 
                      ref={el => monthRefs.current[group.title] = el}
                      className="scroll-mt-4 bg-gray-950"
                    >
                      <td colSpan={7} className="px-4 pb-3 pt-7">
                        <div className="flex items-center gap-4">
                          <h2 className="shrink-0 text-xl font-semibold tracking-tight text-gray-100">{group.title}</h2>
                          <span className="h-px flex-1 bg-gray-700" aria-hidden="true" />
                          <span className="text-sm tabular-nums text-gray-400" aria-label={`Мероприятий: ${group.events.length}`}>{group.events.length}</span>
                        </div>
                      </td>
                    </tr>
                    {group.events.map((event) => (
                      <tr 
                        key={event.id} 
                        ref={el => eventRefs.current[event.id] = el}
                        onClick={() => { if (canAccess(user, 'events')) onEventFormOpen?.(event); }}
                        tabIndex={canAccess(user, 'events') ? 0 : undefined}
                        aria-label={canAccess(user, 'events') ? `Открыть мероприятие: ${event.name || event.venues?.name || event.event_type}` : undefined}
                        onKeyDown={keyEvent => {
                          if (canAccess(user, 'events') && keyEvent.target === keyEvent.currentTarget && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
                            keyEvent.preventDefault();
                            onEventFormOpen?.(event);
                          }
                        }}
                        className={`transition-colors group ${canAccess(user, 'events') ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500' : ''} ${isNearestEvent(event) ? 'bg-gray-800/70 ring-1 ring-inset ring-accent-700/50' : 'hover:bg-gray-800/50'}`}
                      >
                        <td className="px-4 py-2">
                          <div className="text-gray-100 font-medium text-sm tabular-nums">{formatDateRange(event)}</div>
                          {isNearestEvent(event) && <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent-300"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />В фокусе</span>}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {event.venues?.name || '-'}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {event.clients?.organization || '-'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-white font-medium text-sm leading-tight">{event.name || '-'}</div>
                          <div className="text-xs text-gray-400 leading-tight">{event.event_type}</div>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {canSeeEventProgress && (
                          <div className="flex items-center gap-1.5">
                            <ReceiptText
                              className={`w-3.5 h-3.5 transition-colors ${event.progress_budget_done ? 'text-green-400' : 'text-gray-500'}`}
                              >
                                <title>{event.progress_budget_done ? 'Смета составлена' : 'Смета не составлена'}</title>
                            </ReceiptText>
                            <CheckCircle
                              className={`w-3.5 h-3.5 transition-colors ${event.progress_equipment_reserved ? 'text-accent-400' : 'text-gray-500'}`}
                              >
                                <title>{event.progress_equipment_reserved ? 'Смета подтверждена' : 'Смета не подтверждена'}</title>
                            </CheckCircle>
                            <ClipboardCheck
                              className={`w-3.5 h-3.5 transition-colors ${event.progress_project_completed ? 'text-gray-200' : 'text-gray-500'}`}
                              >
                                <title>{event.progress_project_completed ? 'Проект выполнен' : 'Проект не выполнен'}</title>
                            </ClipboardCheck>
                            <CreditCard
                              className={`w-3.5 h-3.5 transition-colors ${event.progress_paid ? 'text-accent-300' : 'text-gray-500'}`}
                              >
                                <title>{event.progress_paid ? 'Оплачен' : 'Не оплачен'}</title>
                            </CreditCard>
                          </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right" onClick={clickEvent => clickEvent.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              title={event.equipment_shipped ? 'Оборудование отгружено' : 'Отгрузка не выполнена'}
                              className={`transition-colors ${event.equipment_shipped ? 'text-red-400' : 'text-gray-500'}`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </span>
                            <span
                              title={event.equipment_returned ? 'Оборудование принято' : 'Возврат не выполнен'}
                              className={`inline-flex transition-colors ${event.equipment_returned ? 'text-green-400' : 'text-gray-500'}`}
                              style={{ transform: 'scaleX(-1)' }}
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </span>
                            <span className="w-px h-3.5 bg-gray-700 mx-0.5" />
                            <button
                              onClick={() => { void openSpecification(event.id); }}
                              disabled={loadingSpecifications || !['Подтверждено', 'Выполнено'].includes(event.status) || !canAccess(user, 'specifications')}
                              className={`inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center rounded-lg transition-colors ${['Подтверждено', 'Выполнено'].includes(event.status) ? 'text-green-400 hover:bg-gray-700 cursor-pointer' : 'text-gray-500 cursor-not-allowed'}`}
                              title={['Подтверждено', 'Выполнено'].includes(event.status) ? 'Открыть спецификацию' : 'Мероприятие не подтверждено'}
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            {canEditDelete && (
                              <>
                                <button disabled={!canAccess(user, 'events', 2)}
                                  onClick={() => onEventFormOpen?.(event)}
                                  className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded-lg transition-colors"
                                  title="Редактировать"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button disabled={!canAccess(user, 'events', 3)}
                                  onClick={() => handleDelete(event.id)}
                                  className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-800">
          {groupedEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Мероприятия не найдены
            </div>
          ) : (
            groupedEvents.map((group) => (
              <React.Fragment key={group.title}>
                <div 
                  ref={el => monthRefs.current[group.title + '-mobile'] = el}
                  className="scroll-mt-4 flex items-center gap-3 bg-gray-950 px-4 pb-3 pt-7"
                >
                  <h2 className="shrink-0 text-xl font-semibold tracking-tight text-gray-100">{group.title}</h2>
                  <span className="h-px flex-1 bg-gray-700" aria-hidden="true" />
                  <span className="text-sm tabular-nums text-gray-400" aria-label={`Мероприятий: ${group.events.length}`}>{group.events.length}</span>
                </div>
                {group.events.map((event) => (
                  <div 
                    key={event.id} 
                    ref={el => eventRefs.current[event.id + '-mobile'] = el}
                        onClick={() => { if (canAccess(user, 'events')) onEventFormOpen?.(event); }}
                        tabIndex={canAccess(user, 'events') ? 0 : undefined}
                        aria-label={canAccess(user, 'events') ? `Открыть мероприятие: ${event.name || event.venues?.name || event.event_type}` : undefined}
                        onKeyDown={keyEvent => {
                          if (canAccess(user, 'events') && keyEvent.target === keyEvent.currentTarget && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
                            keyEvent.preventDefault();
                            onEventFormOpen?.(event);
                          }
                        }}
                    className={`p-4 space-y-3 ${canAccess(user, 'events') ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500' : ''} ${isNearestEvent(event) ? 'bg-gray-800/70 ring-1 ring-inset ring-accent-700/50' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-[160px] flex-1">
                        <div className="text-gray-100 font-semibold text-base leading-snug break-words">{event.venues?.name || '-'}</div>
                        <div className="text-xs text-gray-400 leading-tight mt-0.5">{event.name || '-'} ({event.event_type})</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={clickEvent => clickEvent.stopPropagation()}>
                        <span
                          title={event.equipment_shipped ? 'Оборудование отгружено' : 'Отгрузка не выполнена'}
                          className={`transition-colors ${event.equipment_shipped ? 'text-red-400' : 'text-gray-500'}`}
                        >
                          <Truck className="w-4 h-4" />
                        </span>
                        <span
                          title={event.equipment_returned ? 'Оборудование принято' : 'Возврат не выполнен'}
                          className={`inline-flex transition-colors ${event.equipment_returned ? 'text-green-400' : 'text-gray-500'}`}
                          style={{ transform: 'scaleX(-1)' }}
                        >
                          <Truck className="w-4 h-4" />
                        </span>
                        <span className="w-px h-4 bg-gray-700 mx-0.5" />
                        <button
                          onClick={() => { void openSpecification(event.id); }}
                          disabled={loadingSpecifications || !['Подтверждено', 'Выполнено'].includes(event.status) || !canAccess(user, 'specifications')}
                          className={`inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center rounded-lg transition-colors ${['Подтверждено', 'Выполнено'].includes(event.status) ? 'text-green-400 hover:bg-gray-700 cursor-pointer' : 'text-gray-500 cursor-not-allowed'}`}
                          title={['Подтверждено', 'Выполнено'].includes(event.status) ? 'Открыть спецификацию' : 'Мероприятие не подтверждено'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        {canEditDelete && (
                          <>
                            <button disabled={!canAccess(user, 'events', 2)}
                              onClick={() => onEventFormOpen?.(event)}
                              className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Редактировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button disabled={!canAccess(user, 'events', 3)}
                              onClick={() => handleDelete(event.id)}
                              className="inline-flex min-h-11 min-w-11 md:min-h-8 md:min-w-8 items-center justify-center text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-100 font-medium text-sm tabular-nums">{formatDateRange(event)}</span>
                      {isNearestEvent(event) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-300"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" aria-hidden="true" />В фокусе</span>}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </div>
                    {(event.clients?.organization || event.venues?.name) && (
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {event.clients?.organization && (
                          <div className="truncate">{event.clients.organization}</div>
                        )}
                      </div>
                    )}
                    {canSeeEventProgress && (
                    <div className="flex items-center gap-1.5">
                      <ReceiptText
                        className={`w-3.5 h-3.5 transition-colors ${event.progress_budget_done ? 'text-green-400' : 'text-gray-500'}`}
                        >
                          <title>{event.progress_budget_done ? 'Смета составлена' : 'Смета не составлена'}</title>
                      </ReceiptText>
                      <CheckCircle
                        className={`w-3.5 h-3.5 transition-colors ${event.progress_equipment_reserved ? 'text-accent-400' : 'text-gray-500'}`}
                        >
                          <title>{event.progress_equipment_reserved ? 'Смета подтверждена' : 'Смета не подтверждена'}</title>
                      </CheckCircle>
                      <ClipboardCheck
                        className={`w-3.5 h-3.5 transition-colors ${event.progress_project_completed ? 'text-gray-200' : 'text-gray-500'}`}
                        >
                          <title>{event.progress_project_completed ? 'Проект выполнен' : 'Проект не выполнен'}</title>
                      </ClipboardCheck>
                      <CreditCard
                        className={`w-3.5 h-3.5 transition-colors ${event.progress_paid ? 'text-accent-300' : 'text-gray-500'}`}
                        >
                          <title>{event.progress_paid ? 'Оплачен' : 'Не оплачен'}</title>
                      </CreditCard>
                    </div>
                    )}
                  </div>
                ))}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {filteredEvents.length > visibleEventCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleEventCount((count) => count + 50)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm"
          >
            Показать ещё ({filteredEvents.length - visibleEventCount})
          </button>
        </div>
      )}
      {loadingSpecifications && <div role="status" className="fixed bottom-4 right-4 z-50 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-200">Загрузка спецификаций…</div>}
      {specificationChoice && <BudgetDocumentDialog budgets={specificationChoice.budgets} kind="specification" onClose={() => setSpecificationChoice(null)} onSelect={budgetId => { const eventId = specificationChoice.eventId; setSpecificationChoice(null); onSpecificationOpen?.(eventId, budgetId); }} />}
    </div>
  );
}
