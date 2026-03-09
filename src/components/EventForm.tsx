import React, { useState, useEffect } from 'react';
import { X, Calculator } from 'lucide-react';
import { BudgetEditor } from './BudgetEditor';
import {
  createEvent,
  updateEvent,
  Event,
  getClients,
  getVenues,
  getOrganizers,
  getBudgetItems,
  Client,
  Venue,
  Organizer,
  EVENT_TYPES,
  EVENT_STATUSES
} from '../lib/events';

interface EventFormProps {
  event?: Event;
  onClose: () => void;
  onSave: () => void;
}

export function EventForm({ event, onClose, onSave }: EventFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    event_date: string;
    event_type: string;
    venue_id: string | null;
    client_id: string | null;
    organizer_id: string | null;
    budget: string;
    specification: string;
    status: string;
    progress_budget_done: boolean;
    progress_equipment_reserved: boolean;
    progress_project_completed: boolean;
    progress_paid: boolean;
    notes: string;
  }>({
    name: event?.name || '',
    event_date: event?.event_date || '',
    event_type: event?.event_type || 'Концерт',
    venue_id: event?.venue_id || null,
    client_id: event?.client_id || null,
    organizer_id: event?.organizer_id || null,
    budget: event?.budget || '',
    specification: event?.specification || '',
    status: event?.status || 'Запрос',
    progress_budget_done: event?.progress_budget_done || false,
    progress_equipment_reserved: event?.progress_equipment_reserved || false,
    progress_project_completed: event?.progress_project_completed || false,
    progress_paid: event?.progress_paid || false,
    notes: event?.notes || ''
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [hasBudgetItems, setHasBudgetItems] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (event?.id) {
      checkBudgetItems();
    }
  }, [event?.id]);

  const checkBudgetItems = async () => {
    if (!event?.id) return;
    try {
      const items = await getBudgetItems(event.id);
      setHasBudgetItems(items.length > 0);
    } catch (error) {
      console.error('Error checking budget items:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData, venuesData, organizersData] = await Promise.all([
        getClients(),
        getVenues(),
        getOrganizers()
      ]);
      setClients(clientsData);
      setVenues(venuesData);
      setOrganizers(organizersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.event_date) {
      alert('Укажите дату мероприятия');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        event_date: formData.event_date,
        event_type: formData.event_type,
        venue_id: formData.venue_id || null,
        client_id: formData.client_id || null,
        organizer_id: formData.organizer_id || null,
        budget: formData.budget,
        specification: formData.specification,
        status: formData.status,
        progress_budget_done: formData.progress_budget_done,
        progress_equipment_reserved: formData.progress_equipment_reserved,
        progress_project_completed: formData.progress_project_completed,
        progress_paid: formData.progress_paid,
        notes: formData.notes
      };

      if (event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при сохранении: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">
            {event ? 'Редактировать мероприятие' : 'Новое мероприятие'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Дата <span className="text-red-400/80">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Статус <span className="text-red-400/80">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  {EVENT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Название мероприятия
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Название"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Тип <span className="text-red-400/80">*</span>
                </label>
                <select
                  required
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Заказчик
                </label>
                <select
                  value={formData.client_id || ''}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не выбран</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.organization}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Площадка
                </label>
                <select
                  value={formData.venue_id || ''}
                  onChange={(e) => setFormData({ ...formData, venue_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не выбрана</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>{venue.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Организатор
                </label>
                <select
                  value={formData.organizer_id || ''}
                  onChange={(e) => setFormData({ ...formData, organizer_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не выбран</option>
                  {organizers.map(organizer => (
                    <option key={organizer.id} value={organizer.id}>{organizer.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Прогресс проекта
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_budget_done}
                    onChange={(e) => setFormData({ ...formData, progress_budget_done: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Смета составлена</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_equipment_reserved}
                    onChange={(e) => setFormData({ ...formData, progress_equipment_reserved: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Оборудование зарезервировано</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_project_completed}
                    onChange={(e) => setFormData({ ...formData, progress_project_completed: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Проект выполнен</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_paid}
                    onChange={(e) => setFormData({ ...formData, progress_paid: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Оплачен</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Примечания
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-900 px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <div>
              {event && (
                <button
                  type="button"
                  onClick={() => setShowBudgetEditor(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded transition-colors ${
                    hasBudgetItems
                      ? 'bg-cyan-600 hover:bg-cyan-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  {hasBudgetItems ? 'Редактировать смету' : 'Составить смету'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showBudgetEditor && event && (
        <BudgetEditor
          eventId={event.id}
          eventName={event.name || 'Мероприятие'}
          onClose={() => {
            setShowBudgetEditor(false);
            checkBudgetItems();
          }}
        />
      )}
    </div>
  );
}
