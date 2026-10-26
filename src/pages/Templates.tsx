import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useEffect, useState } from 'react';
import { Package, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { getTemplates, deleteTemplate, Template, getTemplateItemCounts } from '../lib/templates';
import { TemplateForm } from '../components/TemplateForm';

export function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateDetails, setTemplateDetails] = useState<Record<string, { itemCount: number }>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplates();
      setTemplates(data);

      // Один запрос получает количество позиций для всех шаблонов.
      // Раньше здесь выполнялся отдельный запрос на каждый шаблон.
      const itemCounts = await getTemplateItemCounts();
      const details: Record<string, { itemCount: number }> = {};
      data.forEach((template) => {
        details[template.id] = { itemCount: itemCounts[template.id] || 0 };
      });
      setTemplateDetails(details);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Ошибка загрузки шаблонов');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот шаблон?')) return;

    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleFormSave = () => {
    loadTemplates();
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div hidden>
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-6 h-6 text-cyan-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">Шаблоны для сметы</h1>
        </div>
        <MobileHeaderContent><button disabled={!canAccess(user, 'templates', 2)}
          onClick={() => {
            setEditingTemplate(null);
            setShowForm(true);
          }}
          className="flex w-auto shrink-0 items-center justify-center gap-2 px-3 py-2 sm:py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Создать
        </button></MobileHeaderContent>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 sm:p-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 bg-gray-900 rounded-lg border border-gray-800">
          <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 mb-4 text-sm">Нет шаблонов для отображения</p>
          <button disabled={!canAccess(user, 'templates', 2)}
            onClick={() => {
              setEditingTemplate(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Создать первый шаблон
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className="bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <h3 className="font-bold text-white text-base mb-1 truncate">{template.name}</h3>
              {template.description && (
                <p className="text-xs text-gray-400 mb-2 line-clamp-2 leading-tight">
                  {template.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                <Package className="w-3.5 h-3.5" />
                <span>
                  {templateDetails[template.id]?.itemCount || 0} элемент
                  {(templateDetails[template.id]?.itemCount || 0) % 10 === 1 && (templateDetails[template.id]?.itemCount || 0) % 100 !== 11 ? '' : 'ов'}
                </span>
              </div>

              <div className="flex gap-2">
                <button disabled={!canAccess(user, 'templates', 2)}
                  onClick={() => handleEdit(template)}
                  className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Правка
                </button>
                <button disabled={!canAccess(user, 'templates', 3)}
                  onClick={() => handleDelete(template.id)}
                  className="flex items-center justify-center px-2 py-1.5 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TemplateForm
          template={editingTemplate || undefined}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
