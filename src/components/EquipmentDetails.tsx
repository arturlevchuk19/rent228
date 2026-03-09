import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Trash2, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import {
  EquipmentItem,
  EquipmentModification,
  ModificationComponent,
  getEquipmentModifications,
  getModificationComponents,
  createEquipmentModification,
  addModificationComponent,
  removeModificationComponent,
  deleteEquipmentModification
} from '../lib/equipment';
import {
  getEquipmentCompositions,
  addEquipmentComposition,
  deleteEquipmentComposition,
  EquipmentComposition
} from '../lib/equipmentCompositions';
import { EquipmentSelector } from './EquipmentSelector';

interface EquipmentDetailsProps {
  item: EquipmentItem;
  onClose: () => void;
}

type Tab = 'details' | 'composition' | 'modifications';

export function EquipmentDetails({ item, onClose }: EquipmentDetailsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [compositions, setCompositions] = useState<EquipmentComposition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddComposition, setShowAddComposition] = useState(false);

  const [modifications, setModifications] = useState<EquipmentModification[]>([]);
  const [expandedModificationId, setExpandedModificationId] = useState<string | null>(null);
  const [modificationComponents, setModificationComponents] = useState<Record<string, ModificationComponent[]>>({});
  const [showAddModification, setShowAddModification] = useState(false);
  const [newModificationName, setNewModificationName] = useState('');
  const [newModificationDescription, setNewModificationDescription] = useState('');
  const [showAddComponentForMod, setShowAddComponentForMod] = useState<string | null>(null);

  useEffect(() => {
    loadCompositions();
    loadModifications();
  }, [item.id]);

  const loadCompositions = async () => {
    try {
      const data = await getEquipmentCompositions(item.id);
      setCompositions(data);
    } catch (error) {
      console.error('Error loading compositions:', error);
    }
  };

  const handleAddComposition = async (equipment: EquipmentItem, quantity: number) => {
    try {
      setLoading(true);
      await addEquipmentComposition(item.id, equipment.id, quantity);
      await loadCompositions();
      setShowAddComposition(false);
    } catch (error) {
      console.error('Error adding composition:', error);
      alert('Ошибка при добавлении элемента');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComposition = async (compositionId: string) => {
    if (!confirm('Удалить этот элемент из состава?')) return;

    try {
      await deleteEquipmentComposition(compositionId);
      await loadCompositions();
    } catch (error) {
      console.error('Error deleting composition:', error);
      alert('Ошибка при удалении');
    }
  };

  const loadModifications = async () => {
    try {
      const mods = await getEquipmentModifications(item.id);
      setModifications(mods);
    } catch (error) {
      console.error('Error loading modifications:', error);
    }
  };

  const loadModificationComponents = async (modificationId: string) => {
    try {
      const components = await getModificationComponents(modificationId);
      setModificationComponents(prev => ({
        ...prev,
        [modificationId]: components
      }));
    } catch (error) {
      console.error('Error loading modification components:', error);
    }
  };

  const handleToggleModification = async (modificationId: string) => {
    if (expandedModificationId === modificationId) {
      setExpandedModificationId(null);
    } else {
      setExpandedModificationId(modificationId);
      if (!modificationComponents[modificationId]) {
        await loadModificationComponents(modificationId);
      }
    }
  };

  const handleAddModification = async () => {
    if (!newModificationName.trim()) {
      alert('Введите название модификации');
      return;
    }

    try {
      setLoading(true);
      await createEquipmentModification(item.id, newModificationName, newModificationDescription);
      await loadModifications();
      setShowAddModification(false);
      setNewModificationName('');
      setNewModificationDescription('');
    } catch (error) {
      console.error('Error creating modification:', error);
      alert('Ошибка при создании модификации');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModification = async (modificationId: string) => {
    if (!confirm('Удалить эту модификацию? Все её компоненты также будут удалены.')) return;

    try {
      await deleteEquipmentModification(modificationId);
      await loadModifications();
      if (expandedModificationId === modificationId) {
        setExpandedModificationId(null);
      }
      const newComponents = { ...modificationComponents };
      delete newComponents[modificationId];
      setModificationComponents(newComponents);
    } catch (error) {
      console.error('Error deleting modification:', error);
      alert('Ошибка при удалении модификации');
    }
  };

  const handleAddModificationComponent = async (equipment: EquipmentItem, quantity: number) => {
    if (!showAddComponentForMod) return;

    if (equipment.id === item.id) {
      alert('Нельзя добавить оборудование в свою же модификацию');
      return;
    }

    try {
      setLoading(true);
      await addModificationComponent(showAddComponentForMod, equipment.id, quantity);
      await loadModificationComponents(showAddComponentForMod);
      setShowAddComponentForMod(null);
    } catch (error) {
      console.error('Error adding modification component:', error);
      alert('Ошибка при добавлении компонента');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModificationComponent = async (componentId: string, modificationId: string) => {
    if (!confirm('Удалить этот компонент из модификации?')) return;

    try {
      await removeModificationComponent(componentId);
      await loadModificationComponents(modificationId);
    } catch (error) {
      console.error('Error deleting modification component:', error);
      alert('Ошибка при удалении компонента');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-cyan-500" />
            <div>
              <h2 className="text-xl font-bold text-white">{item.name}</h2>
              <p className="text-sm text-gray-400">{item.sku}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-800">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'details'
                  ? 'text-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Детали
              {activeTab === 'details' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('composition')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'composition'
                  ? 'text-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Содержимое
              {compositions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-cyan-600 text-white text-xs rounded-full">
                  {compositions.length}
                </span>
              )}
              {activeTab === 'composition' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('modifications')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'modifications'
                  ? 'text-cyan-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Модификации
              {modifications.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-cyan-600 text-white text-xs rounded-full">
                  {modifications.length}
                </span>
              )}
              {activeTab === 'modifications' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
              )}
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Категория
                  </label>
                  <div className="text-white">{item.category}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Тип
                  </label>
                  <div className="text-white">{item.type}</div>
                </div>
                {item.subtype && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Подтип
                    </label>
                    <div className="text-white">{item.subtype}</div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Количество
                  </label>
                  <div className="text-white font-semibold">{item.quantity}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Цена аренды
                  </label>
                  <div className="text-white">
                    {item.rental_price > 0 ? `$${item.rental_price}` : '-'}
                  </div>
                </div>
                {item.power && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Мощность
                    </label>
                    <div className="text-white">{item.power}</div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Тип объекта
                  </label>
                  <div className="text-white">
                    {item.object_type === 'physical' ? 'Физическое' : 'Виртуальная комбинация'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Тип аренды
                  </label>
                  <div className="text-white">
                    {item.rental_type === 'rental' ? 'Аренда' : 'Субаренда'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Имеет содержимое
                  </label>
                  <div className="text-white">
                    {item.has_composition ? 'Да' : 'Нет'}
                  </div>
                </div>
              </div>
              {item.note && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Примечание
                  </label>
                  <div className="text-white bg-gray-800 p-4 rounded-lg">{item.note}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'composition' && (
            <div className="space-y-4">
              {item.has_composition ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-sm">
                      Элементы, входящие в состав этого оборудования
                    </p>
                    <button
                      onClick={() => setShowAddComposition(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить элемент
                    </button>
                  </div>

                  {showAddComposition && (
                    <EquipmentSelector
                      onSelect={handleAddComposition}
                      onClose={() => setShowAddComposition(false)}
                      selectedIds={[item.id, ...compositions.map(c => c.child_id)]}
                      showModifications={false}
                    />
                  )}

                  {compositions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Содержимое пока не добавлено</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {compositions.map(comp => (
                        <div
                          key={comp.id}
                          className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="text-cyan-400 font-mono text-sm">{comp.child_sku}</div>
                              <div className="text-white font-medium">{comp.child_name}</div>
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              {comp.child_category} / {comp.child_type}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-gray-400">Количество</div>
                              <div className="text-white font-semibold">{comp.quantity}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteComposition(comp.id)}
                              className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Это оборудование не может иметь содержимого</p>
                  <p className="text-sm mt-2">
                    Включите опцию "Может иметь содержимое" при редактировании
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'modifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm">
                  Создавайте предустановленные конфигурации оборудования с компонентами
                </p>
                <button
                  onClick={() => setShowAddModification(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Добавить модификацию
                </button>
              </div>

              {showAddModification && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Название модификации
                      </label>
                      <input
                        type="text"
                        value={newModificationName}
                        onChange={(e) => setNewModificationName(e.target.value)}
                        placeholder="Например: Базовая, Расширенная, Премиум"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Описание (необязательно)
                      </label>
                      <textarea
                        value={newModificationDescription}
                        onChange={(e) => setNewModificationDescription(e.target.value)}
                        placeholder="Краткое описание модификации"
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setShowAddModification(false);
                        setNewModificationName('');
                        setNewModificationDescription('');
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleAddModification}
                      disabled={loading || !newModificationName.trim()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Создание...' : 'Создать'}
                    </button>
                  </div>
                </div>
              )}

              {modifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Модификации пока не созданы</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {modifications.map(mod => {
                    const components = modificationComponents[mod.id] || [];
                    const isExpanded = expandedModificationId === mod.id;

                    return (
                      <div
                        key={mod.id}
                        className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => handleToggleModification(mod.id)}
                              className="text-gray-400 hover:text-cyan-400 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5" />
                              ) : (
                                <ChevronRight className="w-5 h-5" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <Settings className="w-5 h-5 text-cyan-400" />
                                <div>
                                  <div className="text-white font-medium">{mod.name}</div>
                                  {mod.description && (
                                    <div className="text-sm text-gray-400 mt-0.5">{mod.description}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            {components.length > 0 && (
                              <span className="px-3 py-1 bg-cyan-600/20 text-cyan-400 text-xs rounded-full">
                                {components.length} компонентов
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteModification(mod.id)}
                            className="p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors ml-2"
                            title="Удалить модификацию"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-700 p-4 bg-gray-850">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-300">Компоненты модификации</h4>
                                <button
                                  onClick={() => setShowAddComponentForMod(mod.id)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Добавить компонент
                                </button>
                              </div>

                              {showAddComponentForMod === mod.id && (
                                <EquipmentSelector
                                  onSelect={handleAddModificationComponent}
                                  onClose={() => setShowAddComponentForMod(null)}
                                  selectedIds={[item.id, ...components.map(c => c.component_equipment_id)]}
                                  showModifications={false}
                                />
                              )}

                              {components.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 text-sm">
                                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <p>Компоненты не добавлены</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {components.map(comp => (
                                    <div
                                      key={comp.id}
                                      className="flex items-center justify-between p-3 bg-gray-900 border border-gray-700 rounded hover:border-gray-600 transition-colors"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <div className="text-cyan-400 font-mono text-xs">{comp.component?.sku}</div>
                                          <div className="text-white text-sm font-medium">{comp.component?.name}</div>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          {comp.component?.category} / {comp.component?.type}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <div className="text-xs text-gray-400">Количество</div>
                                          <div className="text-white font-semibold text-sm">{comp.quantity}</div>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteModificationComponent(comp.id, mod.id)}
                                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                                          title="Удалить"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
