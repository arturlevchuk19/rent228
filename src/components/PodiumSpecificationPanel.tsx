import React, { useState, useEffect } from 'react';
import { X, Calculator, Plus, Minus, ChevronDown } from 'lucide-react';
import { BudgetItem } from '../lib/events';
import { getEquipmentCompositions, updateEquipmentComposition, addEquipmentComposition, deleteEquipmentComposition } from '../lib/equipmentCompositions';
import { EquipmentComposition, EquipmentModule } from '../lib/equipmentCompositions';
import { getEquipmentItems } from '../lib/equipment';

interface PodiumSpecificationPanelProps {
  budgetItemId: string;
  budgetItems: BudgetItem[];
  eventId: string;
  onClose: () => void;
  onSaveWithComposition?: () => void;
}

export function PodiumSpecificationPanel({ budgetItemId, budgetItems, eventId, onClose, onSaveWithComposition }: PodiumSpecificationPanelProps) {
  const budgetItem = budgetItems.find(b => b.id === budgetItemId);

  const [modules, setModules] = useState<EquipmentComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [availableModules, setAvailableModules] = useState<EquipmentModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [activeModulesTab, setActiveModulesTab] = useState<'platform' | 'legs'>('platform');
  const [activeAvailableTab, setActiveAvailableTab] = useState<'platform' | 'legs'>('platform');

  const isLegItem = (name: string) => name.toLowerCase().includes('нога');

  useEffect(() => {
    const loadModules = async () => {
      if (!budgetItem?.equipment_id) {
        setLoading(false);
        return;
      }

      try {
        const compositions = await getEquipmentCompositions(budgetItem.equipment_id);
        setModules(compositions);
      } catch (error) {
        console.error('Error loading compositions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [budgetItem?.equipment_id]);

  const handleQuantityChange = (moduleId: string, newQuantity: number) => {
    setModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, quantity: Math.max(0, newQuantity) } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const module of modules) {
        if (module.quantity > 0) {
          await updateEquipmentComposition(module.id, module.quantity);
        } else {
          // quantity=0 violates DB constraint, so remove composition row
          await deleteEquipmentComposition(module.id);
        }
      }
      
      if (onSaveWithComposition) {
        onSaveWithComposition();
      }
      onClose();
    } catch (error) {
      console.error('Error saving compositions:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async (moduleItem: EquipmentModule, quantity: number = 1) => {
    if (!budgetItem?.equipment_id) return;
    
    try {
      await addEquipmentComposition(budgetItem.equipment_id, moduleItem.id, quantity);
      const compositions = await getEquipmentCompositions(budgetItem.equipment_id);
      setModules(compositions);
      setShowAddModule(false);
    } catch (error) {
      console.error('Error adding module:', error);
    }
  };

  const handleLoadAvailableModules = async () => {
    setLoadingModules(true);
    try {
      const equipmentItems = await getEquipmentItems();
      // Filter items that might be part of a podium (legs, panels, clamps etc.)
      const filtered = equipmentItems
        .filter(item => 
          item.category === 'Конструкции' || 
          item.name.toLowerCase().includes('нога') || 
          item.name.toLowerCase().includes('зажим') ||
          item.name.toLowerCase().includes('подиум')
        )
        .map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          type: item.type,
          subtype: item.subtype || '',
          note: item.note || ''
        }));
      setAvailableModules(filtered);
    } catch (error) {
      console.error('Error loading available items:', error);
    } finally {
      setLoadingModules(false);
    }
  };

  const getPodiumDimensions = () => {
    const texts = [
      budgetItem?.notes,
      budgetItem?.name,
      budgetItem?.equipment?.name
    ].filter(Boolean) as string[];

    const parseFromText = (text: string) => {
      // Formats like: (4x3x0.6), 4x3x0,6, 4×3×0.6
      const threeDimMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
      if (threeDimMatch) {
        const width = parseFloat(threeDimMatch[1].replace(',', '.'));
        const depth = parseFloat(threeDimMatch[2].replace(',', '.'));
        const height = parseFloat(threeDimMatch[3].replace(',', '.'));

        return {
          width,
          depth,
          height,
          area: width * depth
        };
      }

      return null;
    };

    for (const text of texts) {
      const parsed = parseFromText(text);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  };

  const dimensions = getPodiumDimensions();

  // Helper function to extract element dimensions from name or sku
  const getElementDimensions = (name: string, sku: string) => {
    // Try to extract dimensions from name first, then from sku (format: 0,5x1, 1x1, 2x1, etc.)
    const text = `${name} ${sku}`;
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
    if (match) {
      return {
        width: parseFloat(match[1].replace(',', '.')),
        depth: parseFloat(match[2].replace(',', '.'))
      };
    }
    return null;
  };

  // Calculate total area covered by elements using actual element dimensions
  let totalElementArea = 0;
  let totalElementCount = 0;
  let totalLegsCount = 0;

  modules.forEach(module => {
    if (isLegItem(module.child_name)) {
      totalLegsCount += module.quantity;
      return;
    }

    const elementDims = getElementDimensions(module.child_name, module.child_sku);
    if (elementDims) {
      totalElementArea += module.quantity * (elementDims.width * elementDims.depth);
    }
    totalElementCount += module.quantity;
  });

  const platformModules = modules.filter(module => !isLegItem(module.child_name));
  const legModules = modules.filter(module => isLegItem(module.child_name));

  const availablePlatformModules = availableModules.filter(module => !isLegItem(module.name));
  const availableLegModules = availableModules.filter(module => isLegItem(module.name));

  const visibleModules = activeModulesTab === 'platform' ? platformModules : legModules;
  const visibleAvailableModules = activeAvailableTab === 'platform' ? availablePlatformModules : availableLegModules;

  const requiredArea = dimensions?.area || 0;
  const progress = requiredArea > 0 ? Math.min((totalElementArea / requiredArea) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[500px] overflow-hidden">
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[600px] overflow-hidden max-h-[80vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">
              Спецификация подиума
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-white mb-2">
              {budgetItem?.equipment?.name || budgetItem?.name || 'Подиум'}
              {dimensions && (
                <span className="text-cyan-400 ml-2">
                  {dimensions.width}×{dimensions.depth}м ({dimensions.area.toFixed(2)} м²)
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-400">
              Состав элементов для сборки конструкции
            </p>
          </div>

          {dimensions && (
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Заполнение элементами</span>
                <span className="text-xs font-medium text-white">
                  {totalElementArea.toFixed(2)} / {requiredArea.toFixed(2)} м² ({Math.round(progress)}%)
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-cyan-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Добавлено: {totalElementCount} шт.</span>
                <span>Покрытие: {totalElementArea.toFixed(2)} м²</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveModulesTab('platform')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeModulesTab === 'platform' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Площадка ({platformModules.length})
              </button>
              <button
                onClick={() => setActiveModulesTab('legs')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  activeModulesTab === 'legs' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Ноги ({legModules.length})
              </button>
            </div>

            {visibleModules.map((module) => (
              <div key={module.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-white">
                      {module.child_name}
                    </h5>
                    <p className="text-xs text-gray-500">{module.child_sku}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5">
                    <button
                      onClick={() => handleQuantityChange(module.id, module.quantity - 1)}
                      className="text-gray-400 hover:text-white transition-colors"
                      disabled={module.quantity <= 0}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={module.quantity}
                      onChange={(e) => handleQuantityChange(module.id, parseInt(e.target.value) || 0)}
                      className="w-16 bg-transparent text-white text-sm text-center outline-none"
                    />
                    <button
                      onClick={() => handleQuantityChange(module.id, module.quantity + 1)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">шт.</div>
                </div>
              </div>
            ))}

            {visibleModules.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  {activeModulesTab === 'platform' ? 'Элементы площадки не заданы' : 'Ноги не заданы'}
                </div>
                <div className="text-xs text-gray-500">
                  Добавьте элементы конструкции из справочника
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowAddModule(!showAddModule);
                  if (!showAddModule && availableModules.length === 0) {
                    handleLoadAvailableModules();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              >
                {showAddModule ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                Добавить элемент из справочника
              </button>
              
              {showAddModule && (
                <div className="mt-4 bg-gray-800/30 rounded-lg p-4">
                  {loadingModules ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setActiveAvailableTab('platform')}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            activeAvailableTab === 'platform' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          Площадка ({availablePlatformModules.length})
                        </button>
                        <button
                          onClick={() => setActiveAvailableTab('legs')}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            activeAvailableTab === 'legs' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          Ноги ({availableLegModules.length})
                        </button>
                      </div>

                      {visibleAvailableModules.map((module) => (
                        <div key={module.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{module.name}</div>
                            {module.note && (
                              <div className="text-xs text-gray-500 mt-1">{module.note}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddModule(module, 1)}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-colors"
                          >
                            Добавить
                          </button>
                        </div>
                      ))}

                      {visibleAvailableModules.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Элементы не найдены
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-800 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Элементов площадки: 
              <span className="text-white font-bold ml-1">{totalElementCount}</span>
              <span className="text-gray-500 ml-3">Ног: {totalLegsCount}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
