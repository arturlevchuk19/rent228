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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Выбрать оборудование</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск оборудования..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredEquipment.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Оборудование не найдено
              </div>
            ) : (
              filteredEquipment.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelectEquipment(item)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedEquipment?.id === item.id
                      ? 'bg-cyan-900/30 border-cyan-600'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{item.name}</div>
                      {item.rental_price && (
                        <div className="text-sm text-cyan-400 mt-1">
                          Цена: {item.rental_price} руб.
                        </div>
                      )}
                    </div>
                    {selectedEquipment?.id === item.id && (
                      <div className="text-cyan-400">✓</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 p-6 bg-gray-800/50">
          {selectedEquipment ? (
            <div className="space-y-4">
              {showModifications && (
                loadingModifications ? (
                  <div className="text-center py-3 text-gray-400 text-sm">
                    Загрузка модификаций...
                  </div>
                ) : modifications.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Модификация
                      <span className="ml-2 text-xs text-cyan-400">({modifications.length} доступно)</span>
                    </label>
                    <select
                      value={selectedModification || ''}
                      onChange={(e) => {
                        const value = e.target.value || null;
                        console.log('Selected modification changed:', value);
                        setSelectedModification(value);
                      }}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Без модификации (базовая комплектация)</option>
                      {modifications.map(mod => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name}{mod.description ? ` - ${mod.description}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedModification && (
                      <p className="text-xs text-cyan-400 mt-2 flex items-start gap-2">
                        <span>ℹ️</span>
                        <span>Компоненты выбранной модификации будут автоматически добавлены в складскую спецификацию</span>
                      </p>
                    )}
                  </div>
                ) : null
              )}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-300 mb-2">Количество</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedEquipment(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmSelection}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
