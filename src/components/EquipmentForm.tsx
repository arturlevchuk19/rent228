import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createEquipmentItem, updateEquipmentItem, EquipmentItem } from '../lib/equipment';

interface EquipmentFormProps {
  item: EquipmentItem | null;
  categories: string[];
  onClose: () => void;
}

export function EquipmentForm({ item, categories, onClose }: EquipmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    category: item?.category || '',
    type: item?.type || '',
    subtype: item?.subtype || '',
    name: item?.name || '',
    note: item?.note || '',
    attribute: item?.attribute || '',
    sku: item?.sku || '',
    quantity: item?.quantity || 0,
    rental_price: item?.rental_price || 0,
    power: item?.power || '',
    object_type: item?.object_type || 'physical' as 'physical' | 'virtual',
    rental_type: item?.rental_type || 'rental' as 'rental' | 'sublease',
    has_composition: item?.has_composition || false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (item) {
        await updateEquipmentItem(item.id, formData);
      } else {
        await createEquipmentItem(formData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleRadioChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {item ? 'Редактировать оборудование' : 'Добавить оборудование'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Основная информация</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Категория *
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">Выберите категорию</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Тип *
                </label>
                <input
                  type="text"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  placeholder="Оборудование, Крепление, Стойка..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Подтип
                </label>
                <input
                  type="text"
                  name="subtype"
                  value={formData.subtype}
                  onChange={handleChange}
                  placeholder="Микрофон, Колонка, Рама..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Наименование *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Примечание
                </label>
                <textarea
                  name="note"
                  value={formData.note}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Детали</h3>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Атрибут
                </label>
                <input
                  type="text"
                  name="attribute"
                  value={formData.attribute}
                  onChange={handleChange}
                  placeholder="Короткое название/код"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Артикул (SKU)
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  placeholder="VI_FIX_FRM"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Количество *
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Цена аренды ($)
                </label>
                <input
                  type="number"
                  name="rental_price"
                  value={formData.rental_price}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Мощность
                </label>
                <input
                  type="text"
                  name="power"
                  value={formData.power}
                  onChange={handleChange}
                  placeholder="Для электрооборудования"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-6">Характеристики объекта</h3>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Тип объекта
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleRadioChange('object_type', 'physical')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.object_type === 'physical'
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.object_type === 'physical'
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.object_type === 'physical' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Физическое оборудование</div>
                        <div className="text-sm text-gray-400">
                          Физический предмет, который может дополнительно включать другие материалы
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRadioChange('object_type', 'virtual')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.object_type === 'virtual'
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.object_type === 'virtual'
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.object_type === 'virtual' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Виртуальная комбинация</div>
                        <div className="text-sm text-gray-400">
                          Комбинация отдельных материалов. Запас рассчитывается на основе содержимого комбинации
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Тип аренды
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleRadioChange('rental_type', 'rental')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.rental_type === 'rental'
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.rental_type === 'rental'
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.rental_type === 'rental' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Аренда</div>
                        <div className="text-sm text-gray-400">
                          Оборудование, которое используется и затем возвращается на склад
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRadioChange('rental_type', 'sublease')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.rental_type === 'sublease'
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.rental_type === 'sublease'
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.rental_type === 'sublease' && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Субаренда</div>
                        <div className="text-sm text-gray-400">
                          Оборудование, которое не возвращается на склад после проекта
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Оборудование может иметь содержимое
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleRadioChange('has_composition', false)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.has_composition === false
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.has_composition === false
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.has_composition === false && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Нет</div>
                        <div className="text-sm text-gray-400">
                          Это отдельный предмет оборудования
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRadioChange('has_composition', true)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.has_composition === true
                        ? 'border-cyan-500 bg-cyan-900/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        formData.has_composition === true
                          ? 'border-cyan-500 bg-cyan-500'
                          : 'border-gray-600'
                      }`}>
                        {formData.has_composition === true && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Да</div>
                        <div className="text-sm text-gray-400">
                          Может иметь состав (включать в себя другие элементы)
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : item ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
