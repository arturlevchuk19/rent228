import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EquipmentModification } from '../lib/equipment';

interface ModificationSelectorProps {
  equipmentName: string;
  modifications: EquipmentModification[];
  onSelect: (modificationId: string | null, quantity: number) => void;
  onClose: () => void;
}

export function ModificationSelector({
  equipmentName,
  modifications,
  onSelect,
  onClose
}: ModificationSelectorProps) {
  const [selectedModification, setSelectedModification] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const handleConfirm = () => {
    onSelect(selectedModification, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Выбор модификации</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Оборудование
            </label>
            <div className="text-white font-medium">{equipmentName}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Количество
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {modifications.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Модификация (опционально)
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedModification(null)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedModification === null
                      ? 'bg-cyan-600 border-cyan-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  Без модификации
                </button>
                {modifications.map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModification(mod.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedModification === mod.id
                        ? 'bg-cyan-600 border-cyan-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-750'
                    }`}
                  >
                    <div className="font-medium">{mod.name}</div>
                    {mod.description && (
                      <div className="text-sm text-gray-400 mt-1">{mod.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
