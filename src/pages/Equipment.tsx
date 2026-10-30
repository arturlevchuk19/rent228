import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Package, Plus, Pencil, Trash2, Search, Filter, Eye } from 'lucide-react';
import {
  getEquipmentPage,
  getEquipmentCategories,
  getEquipmentSubtypes,
  getEquipmentTypes,
  deleteEquipmentItem,
  EquipmentItem
} from '../lib/equipment';
import { EquipmentForm } from '../components/EquipmentForm';
import { EquipmentDetails } from '../components/EquipmentDetails';

export function Equipment() {
  const { user } = useAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [typesDirectory, setTypesDirectory] = useState<string[]>([]);
  const [subtypesDirectory, setSubtypesDirectory] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [viewingItem, setViewingItem] = useState<EquipmentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const generation = useRef(0);
  const fetching = useRef(false);
  const pageSize = window.matchMedia('(max-width: 767px)').matches ? 12 : 30;

  useEffect(() => {
    let active = true;
    Promise.all([getEquipmentCategories(), getEquipmentTypes(), getEquipmentSubtypes()]).then(([cats, types, subtypes]) => {
      if (!active) return;
      setCategories(cats); setTypesDirectory(types); setSubtypesDirectory(subtypes);
    }).catch(() => { if (active) setError('Не удалось загрузить справочники оборудования.'); });
    return () => { active = false; };
  }, []);

  const loadPage = useCallback(async (reset: boolean, requestGeneration: number) => {
    if (!reset && fetching.current) return;
    fetching.current = true;
    setError('');
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const result = await getEquipmentPage({ offset: reset ? 0 : offset.current, limit: pageSize, search: searchTerm, category: filterCategory, type: filterType });
      if (generation.current !== requestGeneration) return;
      offset.current = (reset ? 0 : offset.current) + result.items.length;
      setTotal(result.total);
      setItems(previous => reset ? result.items : [...previous, ...result.items.filter(item => !previous.some(row => row.id === item.id))]);
    } catch (caught) {
      if (generation.current === requestGeneration) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить оборудование.');
    } finally {
      if (generation.current === requestGeneration) { fetching.current = false; setLoading(false); setLoadingMore(false); }
    }
  }, [searchTerm, filterCategory, filterType, pageSize]);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    offset.current = 0;
    fetching.current = false;
    setLoadingMore(false);
    setError('');
    setLoading(true);
    const timer = window.setTimeout(() => void loadPage(true, requestGeneration), 250);
    return () => { window.clearTimeout(timer); generation.current++; };
  }, [loadPage]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || loading || loadingMore || error || items.length >= total || showForm) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadPage(false, generation.current);
    }, { rootMargin: '160px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, loadingMore, error, items.length, total, showForm, loadPage]);

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить это оборудование?')) return;

    try {
      await deleteEquipmentItem(id);
      setItems(previous => previous.filter(item => item.id !== id));
      offset.current = Math.max(0, offset.current - 1);
      setTotal(previous => Math.max(0, previous - 1));
    } catch (error) {
      console.error('Error deleting equipment:', error);
      let errorMessage = 'Ошибка при удалении оборудования';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const handleEdit = (item: EquipmentItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);

  };

  const filteredItems = items;
  const types = typesDirectory;
  const visibleItems = items;
  const handleSaved = (saved: EquipmentItem) => {
    if (editingItem) {
      setItems(previous => previous.map(item => item.id === saved.id ? saved : item));
    } else {
      const matches = (!searchTerm.trim() || saved.name.toLowerCase().includes(searchTerm.trim().toLowerCase())) && (filterCategory === 'all' || saved.category === filterCategory) && (filterType === 'all' || saved.type === filterType);
      if (matches) { setItems(previous => [saved, ...previous]); offset.current++; setTotal(previous => previous + 1); }
    }
    setCategories(previous => previous.includes(saved.category) ? previous : [...previous, saved.category]);
    setTypesDirectory(previous => previous.includes(saved.type) ? previous : [...previous, saved.type]);
  };

  return (
    <div className="space-y-4">
      <div hidden>
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-white">Оборудование</h1>
        </div>
        <div className="flex gap-2">
          <MobileHeaderContent><button disabled={!canAccess(user, 'equipment', 2)}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button></MobileHeaderContent>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
            >
              <option value="all">Все категории</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none"
            >
              <option value="all">Все типы</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Наименование
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Категория / Тип
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Кол-во
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-400 tracking-wider">
                  Цена $
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-400 tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredItems.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Оборудование не найдено
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm leading-tight">{item.name}</div>
                      {item.note && (
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{item.note}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white text-sm leading-tight">{item.category}</div>
                      <div className="text-xs text-gray-400 leading-tight">{item.type} {item.subtype && `/ ${item.subtype}`}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm">{item.quantity} {item.unit}</div>
                    </td>
                    <td className="px-4 py-2 text-white text-sm">
                      {item.rental_price > 0 ? `${item.rental_price}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition-colors"
                          title="Просмотр деталей"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={!canAccess(user, 'equipment', 2)}
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={!canAccess(user, 'equipment', 3)}
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-gray-800">
          {filteredItems.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">Оборудование не найдено</div>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm leading-tight">{item.name}</div>
                    {item.note && <div className="text-xs text-gray-400 leading-tight mt-0.5">{item.note}</div>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setViewingItem(item)} className="p-1.5 text-gray-400 hover:bg-gray-700 rounded transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button disabled={!canAccess(user, 'equipment', 2)} onClick={() => handleEdit(item)} className="p-1.5 text-cyan-400 hover:bg-cyan-900/30 rounded transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button disabled={!canAccess(user, 'equipment', 3)} onClick={() => handleDelete(item.id)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">{item.category}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500">{item.type}{item.subtype && ` / ${item.subtype}`}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-400">Кол-во: <span className="text-white font-medium">{item.quantity} {item.unit}</span></span>
                  {item.rental_price > 0 && (
                    <span className="text-gray-400">Цена: <span className="text-cyan-400 font-medium">${item.rental_price}</span></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {loading && <p role="status" className="py-3 text-center text-sm text-gray-400">Загрузка...</p>}
      {error && <div role="alert" className="text-center text-sm text-red-400">{error}<button type="button" onClick={() => void loadPage(offset.current === 0, generation.current)} className="ml-2 text-cyan-400">Повторить</button></div>}
      {!error && !loading && items.length < total && <div ref={sentinel} className="h-10 text-center text-sm text-gray-400" role="status">{loadingMore ? 'Загрузка...' : 'Прокрутите для загрузки'}</div>}

      {showForm && (
            <EquipmentForm
              item={editingItem}
              categories={categories}
              types={typesDirectory}
              subtypes={subtypesDirectory}
              onSaved={handleSaved}
              onClose={handleFormClose}
            />
      )}

      {viewingItem && (
        <EquipmentDetails
          item={viewingItem}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  );
}
