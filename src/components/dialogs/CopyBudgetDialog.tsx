import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Calendar, Copy, Loader2 } from 'lucide-react';
import { Event, getEvents, copyBudgetFromEvent } from '../../lib/events';

interface CopyBudgetDialogProps {
  currentEventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CopyBudgetDialog({ currentEventId, onClose, onSuccess }: CopyBudgetDialogProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data.filter(e => e.id !== currentEventId));
    } catch (error) {
      console.error('Error loading events:', error);
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
        event.event_type?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = !dateFilter || event.event_date?.includes(dateFilter);

      return matchesSearch && matchesDate;
    });
  }, [events, searchTerm, dateFilter]);

  const handleCopy = async (sourceEventId: string) => {
    try {
      setCopying(true);
      await copyBudgetFromEvent(sourceEventId, currentEventId);
      onSuccess();
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
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-cyan-400" />
            Скопировать смету из другого мероприятия
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-800 space-y-3">
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
                placeholder="Фильтр по дате (YYYY-MM-DD)"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Найдено: {filteredEvents.length}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
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
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-400 text-sm font-medium">
                        {formatDate(event.event_date)}
                      </span>
                      <span className="text-white font-medium truncate">
                        {event.name || event.event_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                        {event.event_type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {event.clients?.organization && (
                        <span className="mr-3">Заказчик: {event.clients.organization}</span>
                      )}
                      {event.venues?.name && (
                        <span>Площадка: {event.venues.name}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(event.id)}
                    disabled={copying}
                    className="ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
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
