import React, { useState, useEffect } from 'react';
import { Users, Building2, UserCircle, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { getClients, getVenues, getOrganizers, deleteClient, deleteVenue, deleteOrganizer, Client, Venue, Organizer } from '../lib/events';

type Tab = 'clients' | 'venues' | 'organizers';

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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

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
          <h1 className="text-2xl font-bold text-white">Контакты</h1>
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
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>

          {activeTab === 'clients' && (
            <div className="overflow-x-auto">
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
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">
                        Заказчики не найдены
                      </td>
                    </tr>
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
                            <button
                              onClick={() => onClientFormOpen?.(client)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'venues' && (
            <div className="overflow-x-auto">
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
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">
                        Площадки не найдены
                      </td>
                    </tr>
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
                            <button
                              onClick={() => onVenueFormOpen?.(venue)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVenue(venue.id)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'organizers' && (
            <div className="overflow-x-auto">
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
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-sm">
                        Организаторы не найдены
                      </td>
                    </tr>
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
                            <button
                              onClick={() => onOrganizerFormOpen?.(organizer)}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrganizer(organizer.id)}
                              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
