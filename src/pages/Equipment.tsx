import { normalizeEquipmentSearch } from '../lib/equipmentSearch';
import { searchInputProps } from '../lib/searchInput';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { useEffect, useState, useRef, useCallback, useId } from 'react';
import { Plus, Pencil, Trash2, Search, SlidersHorizontal, ClipboardCheck, X } from 'lucide-react';
import {
  getEquipmentPage,
  getEquipmentCategories,
  getEquipmentClassifications,
  equipmentTypeOptions,
  equipmentSubtypeOptions,
  type EquipmentClassification,
  deleteEquipmentItem,
  EquipmentItem
} from '../lib/equipment';
import { EquipmentForm } from '../components/EquipmentForm';
import { EquipmentDetails } from '../components/EquipmentDetails';

function readInventoryMarks(key: string): Set<string> {
  const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  return new Set(Array.isArray(stored) ? stored.filter(id => typeof id === 'string') : []);
}

function isVirtualType(type: string) {
  return /виртуальн/i.test(type);
}

export function Equipment() {
  const { user } = useAuth();
  const showPriceAndActions = user?.role === 'admin' || user?.role === 'superuser';
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifications, setClassifications] = useState<EquipmentClassification[]>([]);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryReady, setDirectoryReady] = useState(false);
  const [inventory, setInventory] = useState(false);
  const inventoryKey = `rentmaster-inventory-v1:${user?.id}`;
  const [marks, setMarks] = useState<Set<string>>(() => {
    try { return readInventoryMarks(inventoryKey); } catch { return new Set(); }
  });
  const [inventoryError, setInventoryError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [viewingItem, setViewingItem] = useState<EquipmentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSubtype, setFilterSubtype] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const resetFilters = () => {
    setFilterCategory('all');
    setFilterType('all');
    setFilterSubtype('all');
  };
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const generation = useRef(0);
  const fetching = useRef(false);
  const pageSize = window.matchMedia('(max-width: 767px)').matches ? 12 : 30;

  const loadDirectories = useCallback(async () => {
    setDirectoryError('');
    try {
      const [cats, rows] = await Promise.all([getEquipmentCategories(), getEquipmentClassifications()]);
      setCategories(cats);
      setClassifications(rows);
      setDirectoryReady(true);
    } catch {
      setDirectoryError('Не удалось загрузить справочник оборудования.');
    }
  }, []);

  useEffect(() => { void loadDirectories(); }, [loadDirectories]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== inventoryKey && event.key !== null) return;
      try { setMarks(readInventoryMarks(inventoryKey)); } catch { setInventoryError('Не удалось прочитать отметки на устройстве.'); }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [inventoryKey]);

  const saveMarks = (update: (current: Set<string>) => void) => {
    try {
      const current = readInventoryMarks(inventoryKey);
      update(current);
      localStorage.setItem(inventoryKey, JSON.stringify([...current]));
      setMarks(current);
      setInventoryError('');
    } catch {
      setInventoryError('Не удалось сохранить отметки на устройстве.');
    }
  };

  const markItem = (item: EquipmentItem) => <label
    className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-800"
    onClick={event => event.stopPropagation()}>
    <input type="checkbox" checked={marks.has(item.id)} aria-label={`Найдено: ${item.name}`}
      className="h-5 w-5 accent-accent-500"
      onChange={event => {
        const checked = event.currentTarget.checked;
        saveMarks(current => { if (checked) current.add(item.id); else current.delete(item.id); });
      }} />
  </label>;

  const loadPage = useCallback(async (reset: boolean, requestGeneration: number) => {
    if (!reset && fetching.current) return;
    fetching.current = true;
    setError('');
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const result = await getEquipmentPage({ offset: reset ? 0 : offset.current, limit: pageSize, search: searchTerm, category: filterCategory, type: filterType, subtype: filterSubtype, inventory });
      if (generation.current !== requestGeneration) return;
      offset.current = (reset ? 0 : offset.current) + result.items.length;
      setTotal(result.total);
      setItems(previous => reset ? result.items : [...previous, ...result.items.filter(item => !previous.some(row => row.id === item.id))]);
    } catch (caught) {
      if (generation.current === requestGeneration) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить оборудование.');
    } finally {
      if (generation.current === requestGeneration) { fetching.current = false; setLoading(false); setLoadingMore(false); }
    }
  }, [searchTerm, filterCategory, filterType, filterSubtype, pageSize, inventory]);

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

  const filterRows = inventory ? classifications.filter(row => !isVirtualType(row.type)) : classifications;
  const categoryScope = filterCategory === 'all' ? undefined : filterCategory;
  const typeScope = filterType === 'all' ? undefined : filterType;
  const types = equipmentTypeOptions(filterRows, categoryScope);
  const subtypes = equipmentSubtypeOptions(filterRows, categoryScope, typeScope);
  const activeFilters = [filterCategory, filterType, filterSubtype].filter(value => value !== 'all').length;
  const visibleItems = inventory ? items.filter(item => item.object_type !== 'virtual' && !isVirtualType(item.type)) : items;
  const showRowActions = showPriceAndActions && !inventory;
  const handleSaved = (saved: EquipmentItem) => {
    const matches = normalizeEquipmentSearch(saved.name).includes(normalizeEquipmentSearch(searchTerm)) &&
      (filterCategory === 'all' || saved.category === filterCategory) &&
      (filterType === 'all' || saved.type === filterType) &&
      (filterSubtype === 'all' || saved.subtype === filterSubtype);
    if (editingItem) {
      setItems(previous => matches ? previous.map(item => item.id === saved.id ? saved : item) : previous.filter(item => item.id !== saved.id));
      if (!matches) {
        offset.current = Math.max(0, offset.current - 1);
        setTotal(previous => Math.max(0, previous - 1));
      }
    } else if (matches) {
      setItems(previous => [saved, ...previous]);
      offset.current++;
      setTotal(previous => previous + 1);
    }
    setCategories(previous => previous.includes(saved.category) ? previous : [...previous, saved.category]);
  };
  const inventoryLabel = inventory ? 'Завершить проверку' : 'Инвентаризация';
  const filterFields = [
    { label: 'Категория', allLabel: 'Все категории', value: filterCategory, options: categories, change: (value: string) => {
      setFilterCategory(value);
      setFilterType('all');
      setFilterSubtype('all');
    } },
    { label: 'Тип', allLabel: 'Все типы', value: filterType, options: types, change: (value: string) => {
      setFilterType(value);
      setFilterSubtype('all');
    } },
    { label: 'Подтип', allLabel: 'Все подтипы', value: filterSubtype, options: subtypes, change: setFilterSubtype },
  ];

  return (
    <div className="space-y-4">
      <MobileHeaderContent>
        <button type="button" aria-label={inventoryLabel} title={inventoryLabel} aria-pressed={inventory} onClick={() => {
          setInventory(!inventory);
          resetFilters();
          setSearchTerm('');
        }} className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 ${inventory
          ? 'bg-accent-500/10 text-accent-300'
          : 'text-gray-200 hover:bg-gray-800'}`}>
          <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">{inventoryLabel}</span>
        </button>
        {!inventory && <button type="button" aria-label="Добавить оборудование" title="Добавить оборудование"
          disabled={!directoryReady || !canAccess(user, 'equipment', 2)}
          onClick={() => setShowForm(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent-500 px-3 text-sm font-medium text-gray-950 hover:bg-accent-400 disabled:opacity-50">
          <Plus aria-hidden="true" className="h-5 w-5" />
          <span className="hidden sm:inline">Добавить</span>
        </button>}
      </MobileHeaderContent>

      {inventory && <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
        <span role="status" className="w-full font-medium tabular-nums text-gray-100">Отмечено: {marks.size}</span>
        <p className="text-sm text-gray-300">Отмечайте найденные позиции. Нажмите на название, чтобы открыть карточку. Отметки сохраняются на этом устройстве.</p>
        {marks.size > 0 && <button type="button" className="min-h-11 text-sm text-gray-300 underline hover:text-white"
          onClick={() => { if (window.confirm('Сбросить все отметки инвентаризации на этом устройстве?')) saveMarks(current => current.clear()); }}>Сбросить отметки</button>}
        {inventoryError && <p role="alert" className="text-sm text-red-400">{inventoryError}</p>}
      </div>}
      {directoryError && <div role="alert" className="text-sm text-red-400">{directoryError} <button type="button" onClick={() => void loadDirectories()} className="min-h-11 text-accent-400 underline">Повторить</button></div>}

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              aria-label="Поиск оборудования"
              placeholder="Поиск оборудования"
              {...searchInputProps} value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 pl-9 pr-3 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 sm:text-sm"
            />
          </div>
          <button type="button" aria-expanded={filtersOpen} aria-controls={filtersId}
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 ${filtersOpen || activeFilters
              ? 'border-accent-700 bg-accent-500/10 text-accent-300'
              : 'border-gray-700 text-gray-200 hover:bg-gray-800'}`}>
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Фильтры
            {activeFilters > 0 && <span className="rounded-full bg-accent-500/15 px-1.5 text-xs tabular-nums">{activeFilters}</span>}
          </button>
        </div>
        <div id={filtersId} hidden={!filtersOpen} className="mt-2 border-t border-gray-800 pt-2.5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {filterFields.map(({ label, allLabel, value, options, change }) => (
              <div key={label} className="grid min-w-0 gap-1">
                <label htmlFor={`${filtersId}-${label}`} className="text-xs font-medium text-gray-300">{label}</label>
                <select id={`${filtersId}-${label}`} value={value} onChange={event => change(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 sm:text-sm">
                  <option value="all">{allLabel}</option>
                  {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            ))}
          </div>
          {activeFilters > 0 && <button type="button" onClick={resetFilters}
            className="mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500">
            <X aria-hidden="true" className="h-4 w-4" />
            Сбросить фильтры
          </button>}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full tabular-nums">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                {inventory && <th scope="col" className="w-14 p-2 text-center text-xs text-gray-300">Найдено</th>}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Наименование
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Категория / Тип
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                  Кол-во
                </th>
                {showRowActions && (
                  <>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">
                      Цена $
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">
                      Действия
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {visibleItems.length === 0 && !loading ? (
                <tr>
                  <td colSpan={showRowActions ? 5 : inventory ? 4 : 3} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Оборудование не найдено
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id} tabIndex={0} aria-label={`Посмотреть ${item.name}`} onClick={() => setViewingItem(item)} onKeyDown={event => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setViewingItem(item); }
                  }} className="cursor-pointer hover:bg-gray-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 transition-colors group">
                    {inventory && <td className="px-1 text-center">{markItem(item)}</td>}
                    <td className="px-4 py-2">
                      <div className="text-white font-medium text-sm leading-snug">{item.name}</div>
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
                    {showRowActions && (
                      <>
                        <td className="px-4 py-2 text-right text-gray-100 text-sm tabular-nums">
                          {item.rental_price > 0 ? `${item.rental_price}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right" onClick={event => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button disabled={!canAccess(user, 'equipment', 2)}
                              onClick={() => handleEdit(item)}
                              className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center p-2 text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded transition-colors"
                              title="Редактировать"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button disabled={!canAccess(user, 'equipment', 3)}
                              onClick={() => handleDelete(item.id)}
                              className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-gray-800">
          {visibleItems.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">Оборудование не найдено</div>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} tabIndex={0} aria-label={`Посмотреть ${item.name}`} onClick={() => setViewingItem(item)} onKeyDown={event => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setViewingItem(item); }
              }} className="cursor-pointer p-4 space-y-2.5 hover:bg-gray-800/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500">
                <div className="flex items-start justify-between gap-2">
                  {inventory && markItem(item)}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm leading-snug">{item.name}</div>
                    {item.note && <div className="text-xs text-gray-400 leading-tight mt-0.5">{item.note}</div>}
                  </div>
                  {showRowActions && (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={event => event.stopPropagation()}>
                      <button aria-label={`Редактировать ${item.name}`} disabled={!canAccess(user, 'equipment', 2)} onClick={() => handleEdit(item)} className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center p-2 text-gray-300 hover:text-accent-300 hover:bg-gray-800 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button aria-label={`Удалить ${item.name}`} disabled={!canAccess(user, 'equipment', 3)} onClick={() => handleDelete(item.id)} className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 items-center justify-center p-2 text-red-400 hover:bg-red-900/30 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">{item.category}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500">{item.type}{item.subtype && ` / ${item.subtype}`}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span className="text-gray-400">Кол-во: <span className="text-white font-medium">{item.quantity} {item.unit}</span></span>
                  {showRowActions && item.rental_price > 0 && (
                    <span className="text-gray-400">Цена: <span className="text-gray-100 font-medium tabular-nums">${item.rental_price}</span></span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {loading && <p role="status" className="py-3 text-center text-sm text-gray-400">Загрузка…</p>}
      {error && <div role="alert" className="text-center text-sm text-red-400">{error}<button type="button" onClick={() => void loadPage(offset.current === 0, generation.current)} className="ml-2 text-accent-400">Повторить</button></div>}
      {!error && !loading && items.length < total && <div ref={sentinel} className="h-10 text-center text-sm text-gray-400" role="status">{loadingMore ? 'Загрузка…' : 'Прокрутите для загрузки'}</div>}

      {showForm && (
            <EquipmentForm
              item={editingItem}
              categories={categories}
              classifications={classifications}
              initialCategory={categoryScope}
              onCategoriesChanged={setCategories}
              onClassificationAdded={row => setClassifications(previous => previous.some(existing =>
                existing.category === row.category && existing.type === row.type && existing.subtype === row.subtype)
                ? previous : [...previous, row])}
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
