import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Personnel, getPersonnel } from '../lib/personnel';

interface PersonnelSelectorProps {
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function PersonnelSelector({ selectedIds, onConfirm, onClose }: PersonnelSelectorProps) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [loading, setLoading] = useState(true);

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

  function toggleSelection(id: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  }

  function handleConfirm() {
    onConfirm(Array.from(selected));
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col border border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Выбрать исполнителей</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Загрузка...</div>
          ) : personnel.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              Нет доступного персонала
            </div>
          ) : (
            <div className="space-y-2">
              {personnel.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(person.id)}
                    onChange={() => toggleSelection(person.id)}
                    className="w-5 h-5 rounded border-gray-600 text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium">{person.full_name}</div>
                    <div className="text-sm text-gray-400">
                      {person.phone && <span>{person.phone}</span>}
                      {person.drivers_license && (
                        <span className="ml-3">Вод. удост.: {person.drivers_license}</span>
                      )}
                    </div>
                  </div>
                  {selected.has(person.id) && (
                    <Check className="w-5 h-5 text-cyan-500" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
          >
            Подтвердить ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
