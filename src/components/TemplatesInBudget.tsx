import React, { useState, useEffect } from 'react';
import { X, Package, Plus, Search } from 'lucide-react';
import { getTemplates, getTemplateById, applyTemplateToEvent, Template } from '../lib/templates';

interface TemplatesInBudgetProps {
  eventId: string;
  onClose: () => void;
  onApply: () => void;
}

export function TemplatesInBudget({ eventId, onClose, onApply }: TemplatesInBudgetProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [templateDetails, setTemplateDetails] = useState<Record<string, { itemCount: number }>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplates();
      setTemplates(data);

      const details: Record<string, { itemCount: number }> = {};
      for (const template of data) {
        try {
          const fullTemplate = await getTemplateById(template.id);
          details[template.id] = { itemCount: fullTemplate.items.length };
        } catch (error) {
          details[template.id] = { itemCount: 0 };
        }
      }
      setTemplateDetails(details);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    setCategoryName(template.name);
  };

  const handleConfirmApply = async (template: Template) => {
    try {
      setApplying(template.id);
      await applyTemplateToEvent(template.id, eventId, categoryName || template.name);
      onApply();
      onClose();
    } catch (error) {
      console.error('Error applying template:', error);
      alert('Ошибка при применении шаблона');
    } finally {
      setApplying(null);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg p-8 text-center">
          <div className="text-gray-400">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (selectedTemplate) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-lg font-bold text-white">Применить шаблон</h2>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-medium text-white mb-2">{selectedTemplate.name}</h3>
              <p className="text-sm text-gray-400">
                {templateDetails[selectedTemplate.id]?.itemCount || 0} элементов
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Название категории в смете
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Например: Звуковая система"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Оставьте пусто для использования названия шаблона
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleConfirmApply(selectedTemplate)}
                disabled={applying === selectedTemplate.id}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {applying === selectedTemplate.id ? 'Применение...' : 'Применить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Выбрать шаблон</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск шаблонов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-2">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                Шаблоны не найдены
              </div>
            ) : (
              filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-white">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-gray-400 line-clamp-1">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Package className="w-3 h-3" />
                      <span>
                        {templateDetails[template.id]?.itemCount || 0} элемент
                        {(templateDetails[template.id]?.itemCount || 0) % 10 === 1 && (templateDetails[template.id]?.itemCount || 0) % 100 !== 11 ? '' : 'ов'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyTemplate(template)}
                    disabled={applying === template.id}
                    className="ml-4 flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {applying === template.id ? 'Применение...' : 'Применить'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-gray-700 p-6 bg-gray-800/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
