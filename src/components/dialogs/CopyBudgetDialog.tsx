import { getEventBudgets, copyEventBudget, type EventBudget } from '../../lib/eventBudgets';
import { useState, useEffect, useMemo } from 'react';
import { X, Search, Calendar, Copy, Loader2, User, MapPin } from 'lucide-react';
import { Event, getEvents, getEvent, updateEvent } from '../../lib/events';

interface CopyBudgetDialogProps {
  currentEventId: string;
  onClose: () => void;
  onSuccess: (eventData?: Partial<Event>, budgetId?: string) => void;
}

export function CopyBudgetDialog({ currentEventId, onClose, onSuccess }: CopyBudgetDialogProps) {
  const [events, setEvents] = useState<(Event & { sourceBudgets: EventBudget[] })[]>([]);
  const [selectedBudgets, setSelectedBudgets] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyEventData, setCopyEventData] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      const sources = await Promise.all(data.map(async event => ({ ...event, sourceBudgets: await getEventBudgets(event.id) })));
      setEvents(sources.filter(event => event.sourceBudgets.length > 0));
    } catch (error) {
      console.error('Error loading events:', error);
      setLoadError('Не удалось загрузить список смет. Закройте окно и повторите попытку.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch =
        event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.clients?.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.venues?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.sourceBudgets.some(budget => budget.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesDate = !dateFilter || event.event_date?.slice(0, 10).split('-').reverse().join('.').includes(dateFilter);

      return matchesSearch && matchesDate;
    });
  }, [events, searchTerm, dateFilter]);

  const handleCopy = async (sourceEventId: string, sourceBudgetId: string) => {
    try {
      if (copying || !sourceBudgetId) return;
      setCopying(true);

      const newBudgetId = await copyEventBudget(sourceBudgetId, currentEventId);

      // Если нужно, копируем данные мероприятия
      let updatedEventData: Partial<Event> | undefined;
      if (copyEventData) {
        const sourceEvent = await getEvent(sourceEventId);
        if (sourceEvent) {
          updatedEventData = {
            name: sourceEvent.name,
            event_type: sourceEvent.event_type,
            venue_id: sourceEvent.venue_id,
            client_id: sourceEvent.client_id,
            budget: sourceEvent.budget,
            specification: sourceEvent.specification,
            notes: sourceEvent.notes
          };
          await updateEvent(currentEventId, updatedEventData);
        }
      }

      onSuccess(updatedEventData, newBudgetId);
      onClose();
    } catch (error) {
      console.error('Error copying budget:', error);
      alert('Ошибка при копировании сметы');
    } finally {
      setCopying(false);
    }
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-cyan-400" />
            Скопировать в новую смету
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск по названию, заказчику, площадке..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Фильтр по дате (дд.мм.гггг)"
                aria-label="Дата мероприятия в формате дд.мм.гггг"
                inputMode="numeric"
                value={dateFilter}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setDateFilter(digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{2})(\d)/, '$1.$2'));
                }}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={copyEventData}
              onChange={(e) => setCopyEventData(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 cursor-pointer"
            />
            <span className="text-sm text-gray-300">Также скопировать данные мероприятия (название, тип, заказчик, площадка, примечания)</span>
          </label>

          <div className="text-xs text-gray-500">
            Найдено: {filteredEvents.length}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loadError ? <p role="alert" className="p-3 text-sm text-red-400">{loadError}</p> : loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Мероприятия не найдены
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-cyan-400 text-sm font-medium whitespace-nowrap">
                        {formatDate(event.event_date)}
                      </span>
                      <span className="text-white font-medium truncate">
                        {event.name || event.event_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                        {event.event_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                      {event.clients?.organization && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {event.clients.organization}
                        </span>
                      )}
                      {event.venues?.name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.venues.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {event.sourceBudgets.length > 1 ? <select
                    aria-label={`Смета для копирования из ${event.name || event.event_type}`}
                    value={selectedBudgets[event.id] || ''}
                    disabled={copying}
                    onChange={change => setSelectedBudgets(current => ({ ...current, [event.id]: change.target.value }))}
                    className="mt-2 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-white sm:mt-0 sm:w-56"
                  >
                    <option value="" disabled>Выберите смету</option>
                    {event.sourceBudgets.map(budget => <option key={budget.id} value={budget.id}>{budget.name}</option>)}
                  </select> : <span className="mt-2 text-sm text-gray-300 sm:mt-0">{event.sourceBudgets[0].name}</span>}
                  <button
                    onClick={() => handleCopy(event.id, event.sourceBudgets.length === 1 ? event.sourceBudgets[0].id : selectedBudgets[event.id])}
                    disabled={copying || (event.sourceBudgets.length > 1 && !selectedBudgets[event.id])}
                    className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {copying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Копировать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
