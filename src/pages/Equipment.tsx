import React, { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, Search, Filter, Upload, Eye } from 'lucide-react';
import { getEquipmentItems, getEquipmentCategories, deleteEquipmentItem, importEquipmentFromCSV, importWorkItemsFromCSV, EquipmentItem } from '../lib/equipment';
import { EquipmentForm } from '../components/EquipmentForm';
import { EquipmentDetails } from '../components/EquipmentDetails';

export function Equipment() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [viewingItem, setViewingItem] = useState<EquipmentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, categoriesData] = await Promise.all([
        getEquipmentItems(),
        getEquipmentCategories()
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это оборудование?')) return;

    try {
      await deleteEquipmentItem(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      let errorMessage = 'Ошибка при удалении оборудования';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const handleEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
    loadData();
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>, type: 'equipment' | 'work') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();

      if (type === 'equipment') {
        const count = await importEquipmentFromCSV(text);
        alert(`Импортировано ${count} позиций оборудования`);
      } else {
        const count = await importWorkItemsFromCSV(text);
        alert(`Импортировано ${count} видов работ`);
      }

      await loadData();
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Ошибка при импорте CSV');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const types = [...new Set(items.map(item => item.type).filter(Boolean))];

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
          <Package className="w-6 h-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-white">Оборудование</h1>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{importing ? 'Импорт...' : 'Импорт оборудования'}</span>
            <span className="sm:hidden">Обор.</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleImportCSV(e, 'equipment')}
              disabled={importing}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors cursor-pointer text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{importing ? 'Импорт...' : 'Импорт работ'}</span>
            <span className="sm:hidden">Раб.</span>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleImportCSV(e, 'work')}
              disabled={importing}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
            >
              <option value="all">Все категории</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
            >
              <option value="all">Все типы</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 bg-gray-900/50 rounded-lg border border-gray-800 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Всего единиц:</span>
          <span className="font-bold text-white">
            {items.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Позиций:</span>
          <span className="font-bold text-cyan-400">{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Категорий:</span>
          <span className="font-bold text-green-400">{categories.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Найдено:</span>
          <span className="font-bold text-yellow-400">{filteredItems.length}</span>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Наименование
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Категория / Тип
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Кол-во
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Цена $
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Оборудование не найдено
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm leading-tight">{item.name}</div>
                      {item.note && (
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{item.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white text-sm leading-tight">{item.category}</div>
                      <div className="text-xs text-gray-400 leading-tight">{item.type} {item.subtype && `/ ${item.subtype}`}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm">{item.quantity}</div>
                    </td>
                    <td className="px-4 py-2 text-white text-sm">
                      {item.rental_price > 0 ? `${item.rental_price}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition-colors"
                          title="Просмотр деталей"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                          title="Удалить"
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

      {showForm && (
        <EquipmentForm
          item={editingItem}
          categories={categories}
          onClose={handleFormClose}
        />
      )}

      {viewingItem && (
        <EquipmentDetails
          item={viewingItem}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  );
}
