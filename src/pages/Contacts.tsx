import React, { useState, useEffect } from 'react';
import { Users, Building2, CircleUser as UserCircle, Plus, Pencil, Trash2, Search, Briefcase, Calendar } from 'lucide-react';
import { getClients, getVenues, getOrganizers, getEvents, getEventTypes, createEventType, updateEventType, deleteEventType, deleteClient, deleteVenue, deleteOrganizer, Client, Venue, Organizer, Event, EventTypeItem } from '../lib/events';
import { getWorkItems, createWorkItem, updateWorkItem, deleteWorkItem, WorkItem } from '../lib/personnel';

type Tab = 'clients' | 'venues' | 'organizers' | 'works' | 'events';

interface ContactsProps {
  onClientFormOpen?: (client?: Client) => void;
  onVenueFormOpen?: (venue?: Venue) => void;
  onOrganizerFormOpen?: (organizer?: Organizer) => void;
  refreshSignal?: number;
}

export function Contacts({ onClientFormOpen, onVenueFormOpen, onOrganizerFormOpen, refreshSignal }: ContactsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [workDialogOpen, setWorkDialogOpen] = useState(false);
  const [eventTypeDialogOpen, setEventTypeDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ kind: 'work' | 'eventType'; id: string; title: string } | null>(null);
  const [editingWork, setEditingWork] = useState<WorkItem | null>(null);
  const [editingEventType, setEditingEventType] = useState<EventTypeItem | null>(null);
  const [workName, setWorkName] = useState('');
  const [workUnit, setWorkUnit] = useState('шт');
  const [eventTypeName, setEventTypeName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsResult, venuesResult, organizersResult, workItemsResult, eventsResult, eventTypesResult] = await Promise.allSettled([
        getClients(),
        getVenues(),
        getOrganizers(),
        getWorkItems(),
        getEvents(),
        getEventTypes()
      ]);

      setClients(clientsResult.status === 'fulfilled' ? clientsResult.value : []);
      setVenues(venuesResult.status === 'fulfilled' ? venuesResult.value : []);
      setOrganizers(organizersResult.status === 'fulfilled' ? organizersResult.value : []);
      setWorkItems(workItemsResult.status === 'fulfilled' ? workItemsResult.value : []);
      setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value : []);
      setEventTypes(eventTypesResult.status === 'fulfilled' ? eventTypesResult.value : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Удалить этого заказчика?')) return;
    try {
      await deleteClient(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleDeleteVenue = async (id: string) => {
    if (!confirm('Удалить эту площадку?')) return;
    try {
      await deleteVenue(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting venue:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleDeleteOrganizer = async (id: string) => {
    if (!confirm('Удалить этого организатора?')) return;
    try {
      await deleteOrganizer(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting organizer:', error);
      alert('Ошибка при удалении');
    }
  };

  const filteredClients = clients.filter(c =>
    c.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.city && v.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredOrganizers = organizers.filter(o =>
    o.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWorkItems = workItems.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEventTypes = eventTypes.filter((type) => type.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDeleteWorkItem = async (id: string) => {
    try {
      await deleteWorkItem(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting work item:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleRenameEventType = async (eventType: EventTypeItem) => {
    try {
      await updateEventType(eventType.id, eventTypeName.trim());
      await loadData();
    } catch (error) {
      console.error('Error renaming event type:', error);
      alert('Ошибка при редактировании');
    }
  };

  const handleDeleteEventType = async (eventType: EventTypeItem) => {
    try {
      await deleteEventType(eventType.id);
      await loadData();
    } catch (error) {
      console.error('Error deleting event type:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleUpsertWorkItem = async (workItem?: WorkItem) => {
    try {
      if (!workName.trim()) return alert('Название не может быть пустым');
      if (workItem) await updateWorkItem(workItem.id, { name: workName.trim(), unit: workUnit.trim() || 'шт' });
      else await createWorkItem({ name: workName.trim(), unit: workUnit.trim() || 'шт' });
      await loadData();
    } catch (error) {
      console.error('Error saving work item:', error);
      alert('Ошибка при сохранении');
    }
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
          <Users className="w-6 h-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-white">Справочники</h1>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="border-b border-gray-800">
          <nav className="flex">
            <button
              onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'clients'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Заказчики ({clients.length})
            </button>
            <button
              onClick={() => { setActiveTab('venues'); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'venues'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Площадки ({venues.length})
            </button>
            <button
              onClick={() => { setActiveTab('organizers'); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'organizers'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <UserCircle className="w-4 h-4" />
              Организаторы ({organizers.length})
            </button>
            <button
              onClick={() => { setActiveTab('works'); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'works'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Работы ({workItems.length})
            </button>
            <button
              onClick={() => { setActiveTab('events'); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'events'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              События ({eventTypes.length})
            </button>
          </nav>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => {
                if (activeTab === 'clients') onClientFormOpen?.();
                if (activeTab === 'venues') onVenueFormOpen?.();
                if (activeTab === 'organizers') onOrganizerFormOpen?.();
                if (activeTab === 'works') { setEditingWork(null); setWorkName(''); setWorkUnit('шт'); setWorkDialogOpen(true); }
                if (activeTab === 'events') {
                  setEditingEventType(null); setEventTypeName(''); setEventTypeDialogOpen(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>

          {activeTab === 'clients' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Организация</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">ФИО</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Должность</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Телефон</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Email</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredClients.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">Заказчики не найдены</td></tr>
                    ) : (
                      filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 py-2 text-white font-medium text-sm">{client.organization}</td>
                          <td className="px-3 py-2 text-white text-sm">{client.full_name || '-'}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{client.position || '-'}</td>
                          <td className="px-3 py-2 text-cyan-400 text-sm">{client.phone || '-'}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{client.email || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => onClientFormOpen?.(client)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-800">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-8 text-center text-gray-500 text-sm">Заказчики не найдены</div>
                ) : (
                  filteredClients.map((client) => (
                    <div key={client.id} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{client.organization}</div>
                          {client.full_name && <div className="text-xs text-gray-400">{client.full_name}{client.position && ` · ${client.position}`}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onClientFormOpen?.(client)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {client.phone && <span className="text-cyan-400">{client.phone}</span>}
                        {client.email && <span className="text-gray-400">{client.email}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'venues' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Название</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Адрес</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Город</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Вместимость</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Контакт</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredVenues.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">Площадки не найдены</td></tr>
                    ) : (
                      filteredVenues.map((venue) => (
                        <tr key={venue.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 py-2 text-white font-medium text-sm">{venue.name}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{venue.address || '-'}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{venue.city || '-'}</td>
                          <td className="px-3 py-2 text-white text-sm">{venue.capacity || '-'}</td>
                          <td className="px-3 py-2 text-cyan-400 text-sm">{venue.contact || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => onVenueFormOpen?.(venue)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteVenue(venue.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-800">
                {filteredVenues.length === 0 ? (
                  <div className="px-3 py-8 text-center text-gray-500 text-sm">Площадки не найдены</div>
                ) : (
                  filteredVenues.map((venue) => (
                    <div key={venue.id} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{venue.name}</div>
                          {(venue.city || venue.address) && (
                            <div className="text-xs text-gray-400 truncate">{[venue.city, venue.address].filter(Boolean).join(', ')}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onVenueFormOpen?.(venue)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteVenue(venue.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {venue.capacity && <span className="text-gray-400">Вместимость: <span className="text-white">{venue.capacity}</span></span>}
                        {venue.contact && <span className="text-cyan-400">{venue.contact}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'organizers' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 border-b border-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">ФИО</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Должность</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Телефон</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Email</th>
                      <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Примечания</th>
                      <th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredOrganizers.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">Организаторы не найдены</td></tr>
                    ) : (
                      filteredOrganizers.map((organizer) => (
                        <tr key={organizer.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-3 py-2 text-white font-medium text-sm">{organizer.full_name}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{organizer.position || '-'}</td>
                          <td className="px-3 py-2 text-cyan-400 text-sm">{organizer.phone || '-'}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{organizer.email || '-'}</td>
                          <td className="px-3 py-2 text-gray-400 text-sm">{organizer.notes || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => onOrganizerFormOpen?.(organizer)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteOrganizer(organizer.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-800">
                {filteredOrganizers.length === 0 ? (
                  <div className="px-3 py-8 text-center text-gray-500 text-sm">Организаторы не найдены</div>
                ) : (
                  filteredOrganizers.map((organizer) => (
                    <div key={organizer.id} className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{organizer.full_name}</div>
                          {organizer.position && <div className="text-xs text-gray-400">{organizer.position}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onOrganizerFormOpen?.(organizer)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteOrganizer(organizer.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {organizer.phone && <span className="text-cyan-400">{organizer.phone}</span>}
                        {organizer.email && <span className="text-gray-400">{organizer.email}</span>}
                      </div>
                      {organizer.notes && <div className="text-xs text-gray-500">{organizer.notes}</div>}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'works' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800 border-b border-gray-700"><tr><th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Название</th><th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Единица</th><th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th></tr></thead>
                <tbody className="divide-y divide-gray-800">{filteredWorkItems.length === 0 ? <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-500 text-sm">Работы не найдены</td></tr> : filteredWorkItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50 transition-colors"><td className="px-3 py-2 text-white text-sm">{item.name}</td><td className="px-3 py-2 text-gray-400 text-sm">{item.unit}</td><td className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => { setEditingWork(item); setWorkName(item.name); setWorkUnit(item.unit); setWorkDialogOpen(true); }} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setDeleteDialog({ kind: 'work', id: item.id, title: item.name })} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800 border-b border-gray-700"><tr><th className="px-3 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">Тип мероприятия</th><th className="px-3 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">Действия</th></tr></thead>
                <tbody className="divide-y divide-gray-800">{filteredEventTypes.length === 0 ? <tr><td colSpan={2} className="px-3 py-8 text-center text-gray-500 text-sm">Типы мероприятий не найдены</td></tr> : filteredEventTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-800/50 transition-colors"><td className="px-3 py-2 text-white text-sm">{type.name}</td><td className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-1"><button onClick={() => { setEditingEventType(type); setEventTypeName(type.name); setEventTypeDialogOpen(true); }} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setDeleteDialog({ kind: 'eventType', id: type.id, title: type.name })} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {workDialogOpen && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-4 space-y-3"><h3 className="text-white font-semibold">{editingWork ? 'Редактировать работу' : 'Новая работа'}</h3><input value={workName} onChange={(e)=>setWorkName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" placeholder="Название" /><input value={workUnit} onChange={(e)=>setWorkUnit(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" placeholder="Ед. изм." /><div className="flex justify-end gap-2"><button onClick={()=>setWorkDialogOpen(false)} className="px-3 py-1.5 text-gray-300">Отмена</button><button onClick={async()=>{await handleUpsertWorkItem(editingWork||undefined); setWorkDialogOpen(false);}} className="px-3 py-1.5 bg-cyan-600 rounded text-white">Сохранить</button></div></div></div>}
      {eventTypeDialogOpen && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-4 space-y-3"><h3 className="text-white font-semibold">{editingEventType ? 'Редактировать тип мероприятия' : 'Новый тип мероприятия'}</h3><input value={eventTypeName} onChange={(e)=>setEventTypeName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white" placeholder="Название типа" /><div className="flex justify-end gap-2"><button onClick={()=>setEventTypeDialogOpen(false)} className="px-3 py-1.5 text-gray-300">Отмена</button><button onClick={async()=>{if(!eventTypeName.trim()) return; if(editingEventType) await updateEventType(editingEventType.id,eventTypeName.trim()); else await createEventType(eventTypeName.trim()); await loadData(); setEventTypeDialogOpen(false);}} className="px-3 py-1.5 bg-cyan-600 rounded text-white">Сохранить</button></div></div></div>}
      {deleteDialog && <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md p-4 space-y-3"><h3 className="text-white font-semibold">Удаление</h3><p className="text-gray-300 text-sm">Удалить «{deleteDialog.title}»?</p><div className="flex justify-end gap-2"><button onClick={()=>setDeleteDialog(null)} className="px-3 py-1.5 text-gray-300">Отмена</button><button onClick={async()=>{if(deleteDialog.kind==='work') await handleDeleteWorkItem(deleteDialog.id); else {const t=eventTypes.find(x=>x.id===deleteDialog.id); if(t) await handleDeleteEventType(t);} setDeleteDialog(null);}} className="px-3 py-1.5 bg-red-600 rounded text-white">Удалить</button></div></div></div>}
    </div>
  );
}
