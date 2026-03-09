import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  Template,
  createTemplate,
  updateTemplate,
  addTemplateItem,
  updateTemplateItem,
  removeTemplateItem,
  getTemplateById,
  reorderTemplateItems
} from '../lib/templates';
import { EquipmentItem } from '../lib/equipment';
import { EquipmentSelector } from './EquipmentSelector';

interface TemplateFormProps {
  template?: Template;
  onClose: () => void;
  onSave: () => void;
}

export function TemplateForm({ template: initialTemplate, onClose, onSave }: TemplateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<Array<EquipmentItem & { templateItemId: string; quantity: number; price: number }>>([]);
  const [loading, setLoading] = useState(!!initialTemplate);
  const [saving, setSaving] = useState(false);
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate?.id || null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      loadTemplate();
    }
  }, [initialTemplate?.id]);

  const loadTemplate = async () => {
    if (!initialTemplate?.id) return;
    try {
      setLoading(true);
      const data = await getTemplateById(initialTemplate.id);
      setName(data.name);
      setDescription(data.description);
      setItems(
        data.items.map((item: any) => ({
          ...item.equipment_items,
          templateItemId: item.id,
          quantity: item.quantity,
          price: item.price || item.equipment_items.rental_price || 0
        }))
      );
    } catch (error) {
      console.error('Error loading template:', error);
      if (initialTemplate?.id) {
        setName(initialTemplate.name);
        setDescription('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddEquipment = async (equipment: EquipmentItem, quantity: number) => {
    if (templateId) {
      try {
        const templateItem = await addTemplateItem(templateId, equipment.id, quantity, equipment.rental_price || 0);
        setItems([
          ...items,
          {
            ...equipment,
            templateItemId: templateItem.id,
            quantity,
            price: templateItem.price || equipment.rental_price || 0
          }
        ]);
      } catch (error) {
        console.error('Error adding equipment:', error);
        alert('Ошибка добавления оборудования');
      }
    } else {
      setItems([
        ...items,
        {
          ...equipment,
          templateItemId: `new_${Date.now()}`,
          quantity,
          price: equipment.rental_price || 0
        }
      ]);
    }
    setShowEquipmentSelector(false);
  };

  const handleUpdateQuantity = async (index: number, newQuantity: number) => {
    const item = items[index];
    const updatedItems = [...items];
    updatedItems[index] = { ...item, quantity: newQuantity };
    setItems(updatedItems);

    if (templateId && item.templateItemId.startsWith('new_')) return;

    try {
      await updateTemplateItem(item.templateItemId, newQuantity);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleUpdatePrice = async (index: number, newPrice: number) => {
    const item = items[index];
    const updatedItems = [...items];
    updatedItems[index] = { ...item, price: newPrice };
    setItems(updatedItems);

    if (templateId && item.templateItemId.startsWith('new_')) return;

    try {
      await updateTemplateItem(item.templateItemId, item.quantity, newPrice);
    } catch (error) {
      console.error('Error updating price:', error);
    }
  };


  const handleRemoveItem = async (index: number) => {
    const item = items[index];
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);

    if (templateId && !item.templateItemId.startsWith('new_')) {
      try {
        await removeTemplateItem(item.templateItemId);
      } catch (error) {
        console.error('Error removing item:', error);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverItemIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverItemIndex(null);

    if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
      setDraggedItemIndex(null);
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedItemIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    setItems(newItems);

    if (templateId && !draggedItem.templateItemId.startsWith('new_')) {
      try {
        const reorderData = newItems
          .filter(item => !item.templateItemId.startsWith('new_'))
          .map((item, idx) => ({
            id: item.templateItemId,
            sort_order: idx
          }));
        await reorderTemplateItems(templateId, reorderData);
      } catch (error) {
        console.error('Error reordering items:', error);
      }
    }

    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Укажите название шаблона');
      return;
    }

    if (items.length === 0) {
      alert('Добавьте хотя бы одно оборудование');
      return;
    }

    try {
      setSaving(true);

      if (initialTemplate) {
        await updateTemplate(initialTemplate.id, name, description);
      } else {
        const newTemplate = await createTemplate(name, description);
        setTemplateId(newTemplate.id);

        for (const item of items.filter(i => i.templateItemId.startsWith('new_'))) {
          await addTemplateItem(newTemplate.id, item.id, item.quantity, item.price);
        }
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-gray-400">Загрузка...</div>
        </div>
      </div>
    );
  }

  const selectedIds = items.map(item => item.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">
              {initialTemplate ? 'Редактировать шаблон' : 'Создать шаблон'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Название шаблона *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Звуковая система"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Описание (опционально)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание шаблона..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Оборудование в шаблоне *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEquipmentSelector(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>

                <div className="space-y-2 bg-gray-800 rounded-lg border border-gray-700 p-3">
                  {items.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      Оборудование не добавлено
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div
                          key={item.templateItemId}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex flex-col gap-2 p-3 bg-gray-900 rounded border transition-all cursor-move ${
                            dragOverItemIndex === index && draggedItemIndex !== index
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-gray-600'
                          } ${draggedItemIndex === index ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white">{item.name}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm ml-7">
                            <div>
                              <label className="text-xs text-gray-400">Кол-во</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(index, Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-12 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                                />
                                <span className="text-gray-400">шт.</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs text-gray-400">Цена за ед.</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(e) => handleUpdatePrice(index, parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-700 bg-gray-800/50">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showEquipmentSelector && (
        <EquipmentSelector
          onSelect={handleAddEquipment}
          onClose={() => setShowEquipmentSelector(false)}
          selectedIds={selectedIds}
        />
      )}
    </>
  );
}
