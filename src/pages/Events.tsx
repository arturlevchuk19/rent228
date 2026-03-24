import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Pencil, Trash2, Search, Filter, FileText, Truck, Package, CreditCard, ClipboardCheck, ReceiptText } from 'lucide-react';
import { getEvents, deleteEvent, Event, EVENT_TYPES, EVENT_STATUSES } from '../lib/events';
import { useAuth } from '../contexts/AuthContext';

interface EventsProps {
  onEventFormOpen?: (event?: Event) => void;
  onSpecificationOpen?: (eventId: string) => void;
}

export function Events({ onEventFormOpen, onSpecificationOpen }: EventsProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const canEditDelete = user?.role !== 'warehouse' && user?.role !== 'staff';

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

  const filteredEvents = events.filter(event => {
    const matchesSearch =
      event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.clients?.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.venues?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || event.event_type === filterType;
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'Запрос': 'bg-yellow-900/30 text-yellow-400 border-yellow-600',
      'На рассмотрении': 'bg-blue-900/30 text-blue-400 border-blue-600',
      'Подтверждено': 'bg-green-900/30 text-green-400 border-green-600'
    };
    return colors[status as keyof typeof colors] || colors['Запрос'];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-white">Мероприятия</h1>
        </div>
        {canEditDelete && (
          <button
            onClick={() => onEventFormOpen?.()}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        )}
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
            >
              <option value="all">Все статусы</option>
              {EVENT_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-800 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Всего:</span>
          <span className="font-bold text-white">{events.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Запросы:</span>
          <span className="font-bold text-yellow-400">
            {events.filter(e => e.status === 'Запрос').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Рассмотрение:</span>
          <span className="font-bold text-blue-400">
            {events.filter(e => e.status === 'На рассмотрении').length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Подтверждено:</span>
          <span className="font-bold text-green-400">
            {events.filter(e => e.status === 'Подтверждено').length}
          </span>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Дата
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Название / Тип
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Заказчик
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Площадка
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Статус
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Мероприятия не найдены
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="text-cyan-400 font-medium text-sm">{formatDate(event.event_date)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm leading-tight">{event.name || '-'}</div>
                      <div className="text-xs text-gray-400 leading-tight">{event.event_type}</div>
                    </td>
                    <td className="px-4 py-2 text-white text-sm">
                      {event.clients?.organization || '-'}
                    </td>
                    <td className="px-4 py-2 text-white text-sm">
                      {event.venues?.name || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <ReceiptText
                          className={`w-3.5 h-3.5 transition-colors ${event.progress_budget_done ? 'text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600'}`}
                          title={event.progress_budget_done ? 'Смета составлена' : 'Смета не составлена'}
                        />
                        <Package
                          className={`w-3.5 h-3.5 transition-colors ${event.progress_equipment_reserved ? 'text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.7)]' : 'text-gray-600'}`}
                          title={event.progress_equipment_reserved ? 'Оборудование зарезервировано' : 'Оборудование не зарезервировано'}
                        />
                        <ClipboardCheck
                          className={`w-3.5 h-3.5 transition-colors ${event.progress_project_completed ? 'text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.7)]' : 'text-gray-600'}`}
                          title={event.progress_project_completed ? 'Проект выполнен' : 'Проект не выполнен'}
                        />
                        <CreditCard
                          className={`w-3.5 h-3.5 transition-colors ${event.progress_paid ? 'text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]' : 'text-gray-600'}`}
                          title={event.progress_paid ? 'Оплачен' : 'Не оплачен'}
                        />
                        <span className="w-px h-3.5 bg-gray-700 mx-0.5" />
                        <span
                          title={event.equipment_shipped ? 'Оборудование отгружено' : 'Отгрузка не выполнена'}
                          className={`transition-colors ${event.equipment_shipped ? 'text-red-400 drop-shadow-[0_0_4px_rgba(248,113,113,0.7)]' : 'text-gray-600'}`}
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </span>
                        <span
                          title={event.equipment_returned ? 'Оборудование принято' : 'Возврат не выполнен'}
                          className={`inline-flex transition-colors ${event.equipment_returned ? 'text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600'}`}
                          style={{ transform: 'scaleX(-1)' }}
                        >
                          <Truck className="w-3.5 h-3.5" />
                        </span>
                        <span className="w-px h-3.5 bg-gray-700 mx-0.5" />
                        <button
                          onClick={() => onSpecificationOpen?.(event.id)}
                          disabled={!event.specification_confirmed}
                          className={`p-1 rounded transition-colors ${event.specification_confirmed ? 'text-green-400 hover:bg-gray-700 cursor-pointer drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600 cursor-not-allowed'}`}
                          title={event.specification_confirmed ? 'Спецификация подтверждена' : 'Спецификация не составлена'}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {canEditDelete && (
                          <>
                            <button
                              onClick={() => onEventFormOpen?.(event)}
                              className="p-1 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                              title="Редактировать"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-800">
          {filteredEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Мероприятия не найдены
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div key={event.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm leading-tight truncate">{event.name || '-'}</div>
                    <div className="text-xs text-gray-400 leading-tight mt-0.5">{event.event_type}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <ReceiptText
                      className={`w-4 h-4 transition-colors ${event.progress_budget_done ? 'text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600'}`}
                      title={event.progress_budget_done ? 'Смета составлена' : 'Смета не составлена'}
                    />
                    <Package
                      className={`w-4 h-4 transition-colors ${event.progress_equipment_reserved ? 'text-cyan-400 drop-shadow-[0_0_4px_rgba(34,211,238,0.7)]' : 'text-gray-600'}`}
                      title={event.progress_equipment_reserved ? 'Оборудование зарезервировано' : 'Оборудование не зарезервировано'}
                    />
                    <ClipboardCheck
                      className={`w-4 h-4 transition-colors ${event.progress_project_completed ? 'text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.7)]' : 'text-gray-600'}`}
                      title={event.progress_project_completed ? 'Проект выполнен' : 'Проект не выполнен'}
                    />
                    <CreditCard
                      className={`w-4 h-4 transition-colors ${event.progress_paid ? 'text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.7)]' : 'text-gray-600'}`}
                      title={event.progress_paid ? 'Оплачен' : 'Не оплачен'}
                    />
                    <span className="w-px h-4 bg-gray-700 mx-0.5" />
                    <span
                      title={event.equipment_shipped ? 'Оборудование отгружено' : 'Отгрузка не выполнена'}
                      className={`transition-colors ${event.equipment_shipped ? 'text-red-400 drop-shadow-[0_0_4px_rgba(248,113,113,0.7)]' : 'text-gray-600'}`}
                    >
                      <Truck className="w-4 h-4" />
                    </span>
                    <span
                      title={event.equipment_returned ? 'Оборудование принято' : 'Возврат не выполнен'}
                      className={`inline-flex transition-colors ${event.equipment_returned ? 'text-green-400 drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600'}`}
                      style={{ transform: 'scaleX(-1)' }}
                    >
                      <Truck className="w-4 h-4" />
                    </span>
                    <span className="w-px h-4 bg-gray-700 mx-0.5" />
                    <button
                      onClick={() => onSpecificationOpen?.(event.id)}
                      disabled={!event.specification_confirmed}
                      className={`p-1 rounded transition-colors ${event.specification_confirmed ? 'text-green-400 hover:bg-gray-700 cursor-pointer drop-shadow-[0_0_4px_rgba(74,222,128,0.7)]' : 'text-gray-600 cursor-not-allowed'}`}
                      title={event.specification_confirmed ? 'Спецификация подтверждена' : 'Спецификация не составлена'}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    {canEditDelete && (
                      <>
                        <button
                          onClick={() => onEventFormOpen?.(event)}
                          className="p-1 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-cyan-400 font-medium text-xs">{formatDate(event.event_date)}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>
                {(event.clients?.organization || event.venues?.name) && (
                  <div className="text-xs text-gray-400 space-y-0.5">
                    {event.clients?.organization && (
                      <div className="truncate">{event.clients.organization}</div>
                    )}
                    {event.venues?.name && (
                      <div className="truncate">{event.venues.name}</div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
