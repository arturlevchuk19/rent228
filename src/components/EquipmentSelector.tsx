import React, { useState, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { getEquipmentItems, getEquipmentCategories, EquipmentItem, getEquipmentModifications, EquipmentModification } from '../lib/equipment';

interface EquipmentSelectorProps {
  onSelect: (equipment: EquipmentItem, quantity: number, modificationId?: string) => void;
  onClose: () => void;
  selectedIds?: string[];
  showModifications?: boolean;
}

export function EquipmentSelector({
  onSelect,
  onClose,
  selectedIds = [],
  showModifications = true
}: EquipmentSelectorProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [modifications, setModifications] = useState<EquipmentModification[]>([]);
  const [selectedModification, setSelectedModification] = useState<string | null>(null);
  const [loadingModifications, setLoadingModifications] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [equipmentData, categoriesData] = await Promise.all([
        getEquipmentItems(),
        getEquipmentCategories()
      ]);
      setEquipment(equipmentData);
      setCategories(['Все', ...categoriesData]);
    } catch (error) {
      console.error('Error loading equipment:', error);
      alert('Ошибка загрузки оборудования');
    } finally {
      setLoading(false);
    }
  };

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Все' || item.category === selectedCategory;
    const isNotSelected = !selectedIds.includes(item.id);
    return matchesSearch && matchesCategory && isNotSelected;
  });

  const handleSelectEquipment = async (item: EquipmentItem) => {
    setSelectedEquipment(item);
    setQuantity(1);
    setSelectedModification(null);
    setModifications([]);

    try {
      setLoadingModifications(true);
      const mods = await getEquipmentModifications(item.id);
      setModifications(mods);
      console.log('Loaded modifications for', item.name, ':', mods);
    } catch (error) {
      console.error('Error loading modifications:', error);
      setModifications([]);
    } finally {
      setLoadingModifications(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedEquipment) {
      console.log('Confirming selection:', {
        equipment: selectedEquipment.name,
        quantity,
        selectedModification,
        modificationId: selectedModification || undefined
      });
      onSelect(selectedEquipment, quantity, selectedModification || undefined);
      setSelectedEquipment(null);
      setQuantity(1);
      setModifications([]);
      setSelectedModification(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
        <div className="bg-gray-900 rounded-lg p-8 max-w-md text-center">
          <div className="text-gray-400">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100]">
      <div className="bg-gray-900 border border-gray-700 w-full sm:max-w-2xl sm:rounded-lg rounded-t-xl max-h-[92vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Выбрать оборудование</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск оборудования..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none min-w-[110px]"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            {filteredEquipment.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Оборудование не найдено
              </div>
            ) : (
              filteredEquipment.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelectEquipment(item)}
                  className={`px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedEquipment?.id === item.id
                      ? 'bg-cyan-900/30 border-cyan-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-white text-sm">{item.name}</div>
                    {selectedEquipment?.id === item.id && (
                      <div className="text-cyan-400 text-sm">✓</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 p-4 bg-gray-800/50">
          {selectedEquipment ? (
            <div className="space-y-3">
              {showModifications && (
                loadingModifications ? (
                  <div className="text-center py-2 text-gray-400 text-sm">
                    Загрузка модификаций...
                  </div>
                ) : modifications.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Модификация
                    </label>
                    <select
                      value={selectedModification || ''}
                      onChange={(e) => setSelectedModification(e.target.value || null)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Без модификации</option>
                      {modifications.map(mod => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name}{mod.description ? ` - ${mod.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null
              )}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Количество</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEquipment(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmSelection}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
