import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { getPersonnel, createPersonnel, updatePersonnel, deletePersonnel, Personnel } from '../lib/personnel';

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    salary: 0,
    rate_percentage: 100,
    drivers_license: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    loadPersonnel();
  }, []);

  async function loadPersonnel() {
    try {
      const data = await getPersonnel();
      setPersonnel(data);
    } catch (error) {
      console.error('Error loading personnel:', error);
    } finally {
      setLoading(false);
    }
  }

  function openForm(person?: Personnel) {
    if (person) {
      setEditingPerson(person);
      setFormData({
        full_name: person.full_name,
        salary: person.salary,
        rate_percentage: person.rate_percentage,
        drivers_license: person.drivers_license,
        phone: person.phone,
        address: person.address
      });
    } else {
      setEditingPerson(null);
      setFormData({
        full_name: '',
        salary: 0,
        rate_percentage: 100,
        drivers_license: '',
        phone: '',
        address: ''
      });
    }
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingPerson(null);
    setFormData({
      full_name: '',
      salary: 0,
      rate_percentage: 100,
      drivers_license: '',
      phone: '',
      address: ''
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingPerson) {
        await updatePersonnel(editingPerson.id, formData);
      } else {
        await createPersonnel(formData);
      }
      await loadPersonnel();
      closeForm();
    } catch (error) {
      console.error('Error saving personnel:', error);
      alert('Ошибка при сохранении данных персонала');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить сотрудника?')) return;

    try {
      await deletePersonnel(id);
      await loadPersonnel();
    } catch (error) {
      console.error('Error deleting personnel:', error);
      alert('Ошибка при удалении сотрудника');
    }
  }

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
          <h1 className="text-2xl font-bold text-white">Персонал</h1>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  ФИО
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Оклад
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  % ставка
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Вод. удостоверение
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Телефон
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Адрес
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {personnel.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Нет данных о персонале
                  </td>
                </tr>
              ) : (
                personnel.map((person) => (
                  <tr key={person.id} className="hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-white">
                      {person.full_name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                      {person.salary.toFixed(2)} BYN
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                      {person.rate_percentage}%
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                      {person.drivers_license || '—'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                      {person.phone || '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-300 max-w-xs truncate">
                      {person.address || '—'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openForm(person)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(person.id)}
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
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full p-6 border border-gray-800">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingPerson ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    ФИО *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Оклад (BYN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    % ставка
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.rate_percentage}
                    onChange={(e) => setFormData({ ...formData, rate_percentage: parseFloat(e.target.value) || 100 })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Водительское удостоверение
                  </label>
                  <input
                    type="text"
                    value={formData.drivers_license}
                    onChange={(e) => setFormData({ ...formData, drivers_license: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Адрес
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  {editingPerson ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
