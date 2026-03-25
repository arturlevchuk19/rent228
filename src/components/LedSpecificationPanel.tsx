import React, { useState, useEffect } from 'react';
import { X, Calculator, Plus, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { BudgetItem, getBudgetItems } from '../lib/events';
import { getEquipmentCompositions, addEquipmentComposition, getAvailableLedModules, findCasesForModules } from '../lib/equipmentCompositions';
import { EquipmentComposition, EquipmentModule } from '../lib/equipmentCompositions';

export interface CalculatedCase {
  caseId: string;
  name: string;
  sku: string;
  category: string;
  moduleCapacity: number;
  modulesCount: number;
  caseCount: number;
}

interface LedSpecificationPanelProps {
  budgetItemId: string;
  budgetItems: BudgetItem[];
  allBudgetItems?: BudgetItem[];
  eventId: string;
  onClose: () => void;
  onSaveWithCases?: (cases: CalculatedCase[]) => void;
}

export function LedSpecificationPanel({ budgetItemId, budgetItems, allBudgetItems, eventId, onClose, onSaveWithCases }: LedSpecificationPanelProps) {
  const budgetItem = budgetItems.find(b => b.id === budgetItemId);

  console.log('LedSpecificationPanel props:', {
    budgetItemId,
    budgetItem,
    budgetItemsCount: budgetItems.length
  });

  const [modules, setModules] = useState<EquipmentComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [availableModules, setAvailableModules] = useState<EquipmentModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [existingCases, setExistingCases] = useState<BudgetItem[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  
  // Determine screen type from equipment name or notes
  const equipmentName = budgetItem?.equipment?.name || '';
  const notes = budgetItem?.notes || '';
  const screenType: 'P2.6' | 'P3.91' = 
    equipmentName.includes('P2,6') || equipmentName.includes('P2.6') || equipmentName.includes('P2') ||
    notes.includes('P2,6') || notes.includes('P2.6') || notes.includes('P2')
      ? 'P2.6' 
      : 'P3.91';
  
  useEffect(() => {
    const loadModules = async () => {
      if (!budgetItem?.equipment_id) {
        setLoading(false);
        return;
      }

      console.log('Loading modules for equipment_id:', budgetItem.equipment_id);
      try {
        const compositions = await getEquipmentCompositions(budgetItem.equipment_id, true);
        console.log('Loaded compositions:', compositions);

        // Display all compositions - they are already the modules stored in this LED screen
        setModules(compositions);

        // Load existing LED cases directly from the database
        try {
          const allItems = await getBudgetItems(eventId);
          const cases = allItems.filter(item => item.parent_budget_item_id === budgetItemId);
          console.log('Found existing LED cases:', cases);
          setExistingCases(cases);
        } catch (err) {
          console.error('Error loading existing LED cases:', err);
        }
      } catch (error) {
        console.error('Error loading modules:', error);
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, [budgetItem?.equipment_id, budgetItemId, eventId]);

  const handleQuantityChange = (moduleId: string, newQuantity: number) => {
    setModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, quantity: Math.max(0, newQuantity) } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSaveWithCases && budgetItem && modules.length > 0) {
        const moduleIds = modules.map(m => m.child_id);
        const cases = await findCasesForModules(moduleIds);

        const casesById: Record<string, { caseInfo: typeof cases[0], totalModuleQty: number }> = {};

        for (const module of modules) {
          if (module.quantity <= 0) continue;

          const totalModuleQty = module.quantity * budgetItem.quantity;
          const matchingCase = cases.find(c => c.moduleChildId === module.child_id);

          if (matchingCase) {
            if (casesById[matchingCase.id]) {
              casesById[matchingCase.id].totalModuleQty += totalModuleQty;
            } else {
              casesById[matchingCase.id] = {
                caseInfo: matchingCase,
                totalModuleQty
              };
            }
          }
        }

        const calculatedCases: CalculatedCase[] = Object.entries(casesById).map(([caseId, data]) => ({
          caseId,
          name: data.caseInfo.name,
          sku: data.caseInfo.sku,
          category: data.caseInfo.category,
          moduleCapacity: data.caseInfo.moduleCapacity,
          modulesCount: data.totalModuleQty,
          caseCount: Math.ceil(data.totalModuleQty / data.caseInfo.moduleCapacity)
        })).filter(c => c.caseCount > 0);

        onSaveWithCases(calculatedCases);
      }

      onClose();
    } catch (error) {
      console.error('Error saving modules:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddModule = async (moduleModule: EquipmentModule, quantity: number = 1) => {
    if (!budgetItem?.equipment_id) return;
    
    try {
      const newCompositionId = await addEquipmentComposition(budgetItem.equipment_id, moduleModule.id, quantity);
      // Reload modules to get the new composition
      const compositions = await getEquipmentCompositions(budgetItem.equipment_id, true);
      setModules(compositions);
      setShowAddModule(false);
    } catch (error) {
      console.error('Error adding module:', error);
    }
  };

  const handleLoadAvailableModules = async () => {
    setLoadingModules(true);
    try {
      const modules = await getAvailableLedModules(screenType);
      console.log('Found modules for screen type:', screenType, modules);
      
      // If no modules found, try to get all LED modules
      let finalModules = modules;
      if (modules.length === 0) {
        console.log('No modules found, falling back to all LED modules');
        const { getLedModules } = await import('../lib/equipmentCompositions');
        finalModules = await getLedModules();
        console.log('Fallback modules:', finalModules);
      }
      
      setAvailableModules(finalModules);
    } catch (error) {
      console.error('Error loading available modules:', error);
    } finally {
      setLoadingModules(false);
    }
  };

  // Extract screen dimensions from notes (format: (4x3м)) or area (format: 6м² or 6 м²)
  const getScreenDimensions = () => {
    const text = budgetItem?.notes || '';
    const dimMatch = text.match(/\((\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)м\)/);
    if (dimMatch) {
      return {
        width: parseFloat(dimMatch[1].replace(',', '.')),
        height: parseFloat(dimMatch[2].replace(',', '.')),
        area: parseFloat(dimMatch[1].replace(',', '.')) * parseFloat(dimMatch[2].replace(',', '.'))
      };
    }
    const areaMatch = text.match(/(\d+(?:[.,]\d+)?)\s*м²/);
    if (areaMatch) {
      const area = parseFloat(areaMatch[1].replace(',', '.'));
      return { width: null, height: null, area };
    }
    return null;
  };

  const screenDimensions = getScreenDimensions();
  const totalModules = modules.reduce((sum, m) => sum + m.quantity, 0);

  // Helper function to extract module dimensions from name or note
  const getModuleDimensions = (name: string, note: string) => {
    // Try to extract dimensions from name or note (format: 0,5x0,5, 0.5x1, etc.)
    const text = `${name} ${note}`;
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);
    if (match) {
      return {
        width: parseFloat(match[1].replace(',', '.')),
        height: parseFloat(match[2].replace(',', '.'))
      };
    }
    return null;
  };

  // Calculate total area covered by modules using actual module dimensions
  let totalModuleArea = 0;
  let totalModuleCount = 0;

  modules.forEach(module => {
    const dimensions = getModuleDimensions(module.child_name, module.child_sku);
    if (dimensions) {
      totalModuleArea += module.quantity * (dimensions.width * dimensions.height);
    } else {
      // Fallback to 0.25 m² if no dimensions found
      totalModuleArea += module.quantity * 0.25;
    }
    totalModuleCount += module.quantity;
  });

  const requiredArea = screenDimensions?.area || 0;
  const progress = requiredArea > 0 ? Math.min((totalModuleArea / requiredArea) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[500px] overflow-hidden">
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
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
            <Calculator className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-bold text-white">
              Спецификация модулей LED экрана
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
              {budgetItem?.equipment?.name || 'LED экран'}
              {screenDimensions && (
                <span className="text-green-400 ml-2">
                  {screenDimensions.width !== null && screenDimensions.height !== null
                    ? `${screenDimensions.width}×${screenDimensions.height}м (${screenDimensions.area.toFixed(2)} м²)`
                    : `${screenDimensions.area.toFixed(2)} м²`}
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-400">
              Отредактируйте количество модулей для подбора оптимальной конфигурации
            </p>
          </div>

          {screenDimensions && (
            <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Заполнение модулями</span>
                <span className="text-xs font-medium text-white">
                  {totalModuleArea.toFixed(2)} / {requiredArea.toFixed(2)} м² ({Math.round(progress)}%)
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
                <span>Добавлено: {totalModules} шт.</span>
                <span>Покрытие: {totalModuleArea.toFixed(2)} м²</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-white">
                      {module.child_name}
                    </h5>
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
                      value={draftValues[module.id] ?? String(module.quantity)}
                      onChange={(e) => setDraftValues(prev => ({ ...prev, [module.id]: e.target.value }))}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value);
                        if (!isNaN(n)) handleQuantityChange(module.id, n);
                        setDraftValues(prev => { const copy = { ...prev }; delete copy[module.id]; return copy; });
                      }}
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

            {existingCases.length > 0 && (
              <div className="pt-4 border-t border-gray-700">
                <h5 className="text-sm font-medium text-green-400 mb-3">Кейсы (сохранены)</h5>
                <div className="space-y-2">
                  {existingCases.map((caseItem) => (
                    <div key={caseItem.id} className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm text-white">{caseItem.name || caseItem.notes}</div>
                          {caseItem.notes && <div className="text-xs text-gray-500">{caseItem.notes}</div>}
                        </div>
                        <div className="text-sm font-bold text-green-400">
                          {caseItem.quantity} шт.
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {modules.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">Модули не найдены</div>
                <div className="text-xs text-gray-500">
                  Возможно, состав экрана еще не настроен в системе
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
                Добавить модуль из справочника
              </button>
              
              {showAddModule && (
                <div className="mt-4 bg-gray-800/30 rounded-lg p-4">
                  {loadingModules ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-gray-400">
                        Доступные модули для экрана {screenType}
                      </div>
                      {availableModules.map((module) => (
                        <div key={module.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{module.name}</div>
                            {module.note && (
                              <div className="text-xs text-gray-500 mt-1">{module.note}</div>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddModule(module, 1)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                          >
                            Добавить
                          </button>
                        </div>
                      ))}
                      {availableModules.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Модули не найдены
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
              Общее количество модулей: 
              <span className="text-white font-bold ml-1">{totalModules}</span>
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
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
