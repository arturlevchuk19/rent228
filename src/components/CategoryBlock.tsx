import { BudgetGroupCheckbox, type BudgetGroupSelection } from './BudgetGroupCheckbox';
import { BUDGET_MARKER_COLORS, DEFAULT_DYNAMIC_COEFFICIENT, type BudgetCoefficientGroup } from '../lib/budgetCoefficientGroups';
import { BudgetNoteDialog } from './BudgetNoteDialog';
import { budgetEquipmentDisplayName } from '../lib/budgetDisplayName';
import { BudgetConsumption } from './BudgetConsumption';
import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Check, X, GripVertical, Users, Trash2, Copy, MessageSquarePlus, Highlighter } from 'lucide-react';
import { BudgetItem } from '../lib/events';
import { EQUIPMENT_UNITS } from '../lib/equipment';
import { roundBudgetPrice, budgetLineAmount, calcBudgetCoefficient, calcCombinedUnitPrice, calcDay1UnitPrice, ceilCurrencyUnit, calcDisplayedCombinedTotal as calcCombinedTotal, calcDisplayedDay1Total as calcDay1Total, calcDisplayedGrandTotals as calcGrandTotals } from '../lib/budgetPricing';

const coefficientFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 });

export interface BudgetDragTarget {
  type: 'category' | 'location' | 'uncategorized';
  id: string;
  locationId?: string | null;
}

interface CategoryBlockProps {
  showNominalConsumption?: boolean;
  showMaxConsumption?: boolean;
  categoryId: string;
  categoryName: string;
  locationId?: string | null;
  isLocationContainer?: boolean;
  locationColor?: string;
  items: BudgetItem[];
  isExpanded: boolean;
  isSelected?: boolean;
  onToggleExpand: () => void;
  onSelect?: () => void;
  onUpdateCategoryName: (newName: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<BudgetItem>) => Promise<boolean>;
  onDeleteItem: (itemId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onDuplicateCategory?: (categoryId: string) => void;
  onManagePersonnel?: (categoryId: string) => void;
  paymentMode: 'usd' | 'byn_cash' | 'byn_noncash';
  exchangeRate: number;
  budgetDays: number;
  coefficientGroupsByItem?: Map<string, BudgetCoefficientGroup>;
  groupSelection?: BudgetGroupSelection;
  budgetTotalsMode: 'combined_only' | 'day1_plus_combined';
  onDragStart?: (e: React.DragEvent, type: 'category' | 'item', id: string) => void;
  onDragOver?: (e: React.DragEvent, target: BudgetDragTarget) => void;
  onDrop?: (e: React.DragEvent, target: BudgetDragTarget) => void;
  onDragOverItem?: (e: React.DragEvent, itemId: string) => void;
  onDropOnItem?: (e: React.DragEvent, targetItemId: string) => void;
  dragOverItemId?: string | null;
  categoryRef?: (el: HTMLDivElement | null) => void;
  headerStyle?: React.CSSProperties;
  headerClassName?: string;
}

export function CategoryBlock({
  showNominalConsumption = true,
  showMaxConsumption = true,
  categoryId,
  categoryName,
  locationId = null,
  isLocationContainer = false,
  locationColor,
  items,
  isExpanded,
  isSelected = false,
  onToggleExpand,
  onSelect,
  onUpdateCategoryName,
  onUpdateItem,
  onDeleteItem,
  onDeleteCategory,
  onDuplicateCategory,
  onManagePersonnel,
  paymentMode,
  exchangeRate,
  budgetDays,
  coefficientGroupsByItem,
  groupSelection,
  budgetTotalsMode,
  onDragStart,
  onDragOver,
  onDrop,
  onDragOverItem,
  onDropOnItem,
  dragOverItemId,
  categoryRef,
  headerStyle,
  headerClassName
}: CategoryBlockProps) {
  const [mobileNote, setMobileNote] = useState<BudgetItem | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(categoryName);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, boolean>>({});
  const noteWrites = useRef(new Set<string>());
  const saveNote = async (item: BudgetItem, value: string, close = false) => {
    if (noteWrites.current.has(item.id)) return;
    const key = item.id + '_notes';
    noteWrites.current.add(item.id);
    setDraftValues(current => ({ ...current, [key]: value }));
    setSavingNotes(current => ({ ...current, [item.id]: true }));
    setNoteErrors(current => ({ ...current, [item.id]: false }));
    try {
      if (await onUpdateItem(item.id, { notes: value })) {
        setDraftValues(current => { const next = { ...current }; if (next[key] === value) delete next[key]; return next; });
        if (close) setNoteEditorsOpen(current => ({ ...current, [item.id]: false }));
      } else setNoteErrors(current => ({ ...current, [item.id]: true }));
    } catch {
      setNoteErrors(current => ({ ...current, [item.id]: true }));
    } finally {
      noteWrites.current.delete(item.id);
      setSavingNotes(current => ({ ...current, [item.id]: false }));
    }
  };

  const [noteEditorsOpen, setNoteEditorsOpen] = useState<Record<string, boolean>>({});
  const [openUnitDropdownId, setOpenUnitDropdownId] = useState<string | null>(null);
  const [openMarkerDropdownId, setOpenMarkerDropdownId] = useState<string | null>(null);
  const [editingCoefficientId, setEditingCoefficientId] = useState<string | null>(null);
  const categoryItemIds = groupSelection ? items.map(item => item.id) : [];
  const categorySelection = groupSelection?.state(categoryItemIds);
  const selectCategory = groupSelection ? () => groupSelection.toggle(categoryItemIds) : onSelect;
  const showCoefficient = Boolean(coefficientGroupsByItem) || budgetDays > 1;
  const tableRowClass = "grid grid-cols-[0.75rem_minmax(0,1fr)_4.25rem] items-center gap-1 px-1.5 py-0.5";
  const tableTemplateColumns = showCoefficient
    ? 'minmax(0,1fr) 60px 65px 58px 56px 90px'
    : 'minmax(0,1fr) 60px 65px 58px 90px';

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== categoryName) {
      onUpdateCategoryName(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditedName(categoryName);
    setIsEditingName(false);
  };

  const isDeliveryWork = (item: BudgetItem): boolean => {
    if (item.item_type !== 'work') return false;
    const workName = item.work_item?.name?.toLowerCase() || '';
    return workName.includes('доставка оборудования') || workName.includes('доставка персонала');
  };

  const convertUSDtoBYNCashPrice = (priceUSD: number): number => {
    const baseAmount = priceUSD * exchangeRate;
    return ceilCurrencyUnit(baseAmount);
  };


  const convertUSDtoBYNNonCashPrice = (priceUSD: number, item?: BudgetItem): number => {
    const baseAmount = priceUSD * exchangeRate;
    let withBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withBankRate = baseAmount * 1.67;
    } else {
      withBankRate = baseAmount / 0.8;
    }
    return ceilCurrencyUnit(withBankRate);
  };


  const convertBYNCashtoUSDPrice = (priceBYN: number): number => {
    if (priceBYN <= 0 || exchangeRate <= 0) {
      return 0;
    }

    // Используем небольшую дельту, чтобы после Math.ceil при обратной конвертации
    // отображаемая BYN-сумма совпадала с введённой пользователем.
    return (priceBYN - 1e-6) / exchangeRate;
  };

  const convertBYNNonCashtoUSDPrice = (priceBYN: number, item?: BudgetItem): number => {
    if (priceBYN <= 0 || exchangeRate <= 0) {
      return 0;
    }

    let withoutBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withoutBankRate = priceBYN / 1.67;
    } else {
      withoutBankRate = priceBYN * 0.8;
    }

    // Аналогично cash-режиму: чтобы ceil в отображении не поднимал значение на +1 BYN.
    return (withoutBankRate - 1e-6) / exchangeRate;
  };

  const getDisplayedAmount = (item: BudgetItem) => {
    if (paymentMode === 'usd') {
      const usdAmount = budgetTotalsMode === 'combined_only'
        ? calcCombinedTotal(item, budgetDays)
        : calcDay1Total(item, budgetDays);
      return usdAmount;
    }

    const displayedPrice = getDisplayedPrice(item);
    return budgetLineAmount(displayedPrice, item.quantity);
  };

  const getDisplayedPriceUSD = (item: BudgetItem) => budgetTotalsMode === 'combined_only'
    ? calcCombinedUnitPrice(item, budgetDays)
    : calcDay1UnitPrice(item, budgetDays);

  const getDisplayedPrice = (item: BudgetItem, basePrice = false) => {
    const usdPrice = basePrice ? item.price : getDisplayedPriceUSD(item);

    switch (paymentMode) {
      case 'byn_cash':
        return convertUSDtoBYNCashPrice(usdPrice);
      case 'byn_noncash':
        return convertUSDtoBYNNonCashPrice(usdPrice, item);
      default:
        return roundBudgetPrice(usdPrice);
    }
  };

  const getCurrencyLabel = () => {
    switch (paymentMode) {
      case 'byn_cash':
      case 'byn_noncash':
        return 'BYN';
      default:
        return '';
    }
  };

  const formatSectionTotal = (value: number) =>
    paymentMode !== 'usd' ? `${value.toFixed(2)} ${getCurrencyLabel()}` : value.toFixed(2);

  const categoryTotals = calcGrandTotals(items, budgetDays, budgetTotalsMode);
  const sectionDay1Total = (() => {
    if (paymentMode === 'usd') {
      return categoryTotals.day1Total;
    }

    return items.reduce((sum, item) => {
      const unitPriceUSD = calcDay1UnitPrice(item, budgetDays);
      const unitPriceBYN = paymentMode === 'byn_cash'
        ? convertUSDtoBYNCashPrice(unitPriceUSD)
        : convertUSDtoBYNNonCashPrice(unitPriceUSD, item);
      return sum + budgetLineAmount(unitPriceBYN, item.quantity);
    }, 0);
  })();

  const sectionCombinedTotal = (() => {
    if (paymentMode === 'usd') {
      return categoryTotals.combinedTotal;
    }

    return items.reduce((sum, item) => {
      const unitPriceUSDForNDays = calcCombinedUnitPrice({ ...item, quantity: 1 }, budgetDays);
      const unitPriceBYN = paymentMode === 'byn_cash'
        ? convertUSDtoBYNCashPrice(unitPriceUSDForNDays)
        : convertUSDtoBYNNonCashPrice(unitPriceUSDForNDays, item);
      return sum + budgetLineAmount(unitPriceBYN, item.quantity);
    }, 0);
  })();

  const hasWorkItems = items.some(item => item.item_type === 'work');
  const dragTarget: BudgetDragTarget =
    categoryId === 'uncategorized'
      ? { type: isLocationContainer ? 'location' : 'uncategorized', id: locationId || 'uncategorized', locationId }
      : { type: 'category', id: categoryId, locationId };

  return (
    <div
      ref={categoryRef}
      className={`bg-gray-900 border-b border-gray-800 transition-colors ${
        isSelected ? 'bg-gray-800/50' : ''
      } ${locationColor ? 'border-l-2' : ''}`}
      style={locationColor ? { borderLeftColor: locationColor } : undefined}
      onDragOver={(e) => onDragOver?.(e, dragTarget)}
      onDrop={(e) => onDrop?.(e, dragTarget)}
      data-budget-drop-group={JSON.stringify(dragTarget)}
      data-budget-selected={isSelected}
    >
      {/* Category header - compact, sticky */}
      <div
        style={headerStyle}
        className={`budget-category-header flex items-center gap-1 px-1.5 py-1 transition-colors cursor-pointer sticky top-0 z-10 ${
          isSelected ? 'rounded-lg bg-accent-900/20 ring-2 ring-inset ring-accent-300' : 'bg-gray-900 hover:bg-gray-800'
        } ${headerClassName || ''}`}
        onClick={selectCategory}
      >
        {categoryId !== 'uncategorized' && (
          <div
            draggable
            data-budget-drag-type="category"
            data-budget-drag-id={categoryId}
            data-budget-drag-label={categoryName}
            title="Перетащить категорию"
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart?.(e, 'category', categoryId);
            }}
            className="text-gray-400 hover:text-gray-300 cursor-move"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} категорию ${categoryName}`}
          className="text-gray-500 hover:text-gray-400 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {groupSelection && <BudgetGroupCheckbox selection={groupSelection} ids={categoryItemIds}
          label={`Выбрать категорию ${categoryName}`} />}
        {isEditingName ? (
          <div className="flex items-center gap-0.5 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1 px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-accent-500"
              autoFocus
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveName();
              }}
              className="text-green-500 hover:text-green-400"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              className="text-red-500 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 text-sm font-medium text-gray-200">
              <button type="button" disabled={categorySelection?.disabled} onClick={event => { event.stopPropagation(); selectCategory?.(); }}
                aria-pressed={categorySelection ? categorySelection.mixed ? 'mixed' : categorySelection.checked : isSelected}
                className="w-full truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
                title={categoryName}>{categoryName}</button>
            </h3>
            {hasWorkItems && onManagePersonnel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManagePersonnel(categoryId);
                }}
                className="text-accent-500 hover:text-accent-400 transition-colors"
                title="Управление персоналом"
              >
                <Users className="w-3 h-3" />
              </button>
            )}
            {categoryId !== 'uncategorized' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="text-gray-500 hover:text-gray-400 transition-colors"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
            {categoryId !== 'uncategorized' && onDuplicateCategory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rawCategoryId = categoryId.includes('::')
                    ? categoryId.split('::')[1].replace('category:', '')
                    : categoryId.replace('category:', '');
                  onDuplicateCategory(rawCategoryId);
                }}
                className="text-gray-500 hover:text-accent-400 transition-colors"
                title="Дублировать категорию (копия со всеми позициями)"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
            )}
            {onDeleteCategory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Удалить категорию "${categoryName}" и все элементы в ней?`)) {
                    onDeleteCategory(categoryId);
                  }
                }}
                className="text-red-500/50 hover:text-red-400 transition-colors"
                title="Удалить категорию"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </>
        )}

        <div className="text-xs font-semibold text-gray-100 tabular-nums ml-0.5 text-right leading-tight" onClick={(e) => e.stopPropagation()}>
          {budgetTotalsMode === 'day1_plus_combined' && (
            <div>
              1д: {formatSectionTotal(sectionDay1Total)}
            </div>
          )}
          <div>
            {budgetDays}д: {formatSectionTotal(sectionCombinedTotal)}
          </div>
        </div>

        <div className="text-xs text-gray-400 ml-0.5" onClick={(e) => e.stopPropagation()}>
          ({items.length})
        </div>
      </div>

      {(showNominalConsumption || showMaxConsumption) && <div className="border-b border-gray-800 px-3 py-2">
        <BudgetConsumption items={items} showNominal={showNominalConsumption} showMaximum={showMaxConsumption} />
      </div>}

      {/* Items table - flat, compact */}
      {isExpanded && items.length > 0 && (
        <div>
          {/* Table header */}
          <div className={`budget-items-heading ${tableRowClass} bg-gray-900/50 text-xs text-gray-400 border-b border-gray-800`}>
            <div aria-hidden="true" />
            <div
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: tableTemplateColumns }}
            >
              <div className={groupSelection ? 'pl-8 text-left' : 'text-left'}>Наименование</div>
              <div className="text-center">Ед. изм.</div>
              <div className="text-center">Кол-во</div>
              <div className="pr-0.5 text-right" title={coefficientGroupsByItem ? 'Цена за день до применения коэффициента' : undefined}>{coefficientGroupsByItem ? 'Цена/день' : 'Цена'}</div>
              {showCoefficient && <div className="text-center">Коэф.</div>}
              <div className="text-right pr-2">Сумма</div>
            </div>
          </div>

          {/* Items */}
          <div>
            {items.map((item) => {
              const isNoteEditorOpen = noteEditorsOpen[item.id] ?? Boolean(item.notes);
              const editablePrice = getDisplayedPrice(item, Boolean(coefficientGroupsByItem));
              const coefficientGroup = coefficientGroupsByItem?.get(item.id);
              const itemName = budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || item.name || 'Без названия';
              const itemSelection = groupSelection?.state([item.id]);
              return (
                <div
                  key={item.id}
                  className="group"
                  data-budget-item-id={item.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDragOverItem?.(e, item.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDropOnItem?.(e, item.id);
                  }}
                >
                  <div
                    className={`budget-item-row ${tableRowClass} hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-b-0 ${itemSelection?.checked ? 'bg-accent-500/15' : ''} ${dragOverItemId === item.id ? 'bg-accent-500/10 border-accent-500/50' : ''}`}
                    style={{
                       backgroundColor: item.marker_color ? `${item.marker_color}40` : undefined,
                       boxShadow: coefficientGroup?.color ? `inset 0 0 0 1px ${coefficientGroup.color}` : undefined,
                     }}
                  >
                  <div
                    draggable
                    data-budget-drag-type="item"
                    data-budget-drag-id={item.id}
                    data-budget-drag-label={budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || 'Без названия'}
                    title="Перетащить позицию"
                    onDragStart={(e) => {
                      e.stopPropagation();
                      onDragStart?.(e, 'item', item.id);
                    }}
                    className="w-3 text-gray-600 hover:text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex justify-center"

                  >
                    <GripVertical className="w-3 h-3" />
                  </div>

                  <div
                    className={`budget-item-fields min-w-0 flex-1 grid items-center gap-1 text-sm ${showCoefficient ? "budget-item-fields-with-coefficient" : ""}`}
                    style={{ gridTemplateColumns: tableTemplateColumns }}
                  >
                    <div className={`min-w-0 text-gray-300 whitespace-normal break-words pr-2 ${groupSelection ? 'flex items-center' : ''}`}>
                      {groupSelection ? <>
                        <BudgetGroupCheckbox selection={groupSelection} ids={[item.id]} itemId={item.id} label={`Выбрать позицию ${itemName}`} />
                        <button type="button" disabled={itemSelection?.disabled} aria-pressed={itemSelection?.checked}
                          title={itemSelection?.disabled ? coefficientGroup?.name : undefined}
                          onClick={event => groupSelection.selectItem(item.id, event.shiftKey)}
                          className="min-w-0 select-none break-words py-1 text-left hover:text-white disabled:cursor-not-allowed disabled:text-gray-400">
                          {itemName}
                        </button>
                      </> : itemName}
                    </div>

                    <div data-mobile-label="Ед. изм." className="relative flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenUnitDropdownId(openUnitDropdownId === item.id ? null : item.id);
                        }}
                        className="text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 px-1 rounded transition-colors"
                      >
                        {item.unit || item.equipment?.unit || item.work_item?.unit || 'шт.'}
                      </button>
                      {openUnitDropdownId === item.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setOpenUnitDropdownId(null)}
                          />
                          <div className="absolute top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 min-w-[60px]">
                            {EQUIPMENT_UNITS.map((u) => (
                              <button
                                key={u}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateItem(item.id, { unit: u });
                                  setOpenUnitDropdownId(null);
                                }}
                                className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <div data-mobile-label="Количество" className="flex justify-center">
                      <div className="flex items-center justify-center">
                        <button
                          aria-label={`Уменьшить количество: ${budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || item.name || "Позиция"}`}
                          onClick={() => onUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-xs"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Количество: ${budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || 'Позиция'}`}
                          value={draftValues[item.id + '_quantity'] ?? String(item.quantity)}
                          onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_quantity']: e.target.value }))}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value);
                            if (!isNaN(n)) onUpdateItem(item.id, { quantity: Math.max(1, n) });
                            setDraftValues(prev => { const copy = { ...prev }; delete copy[item.id + '_quantity']; return copy; });
                          }}
                          className="w-8 px-0.5 py-0.5 bg-transparent text-center text-white text-sm tabular-nums rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        />
                        <button
                          aria-label={`Увеличить количество: ${budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || item.name || "Позиция"}`}
                          onClick={() => onUpdateItem(item.id, { quantity: item.quantity + 1 })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div data-mobile-label="Цена" className="flex justify-end">
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${coefficientGroupsByItem ? 'Цена за день' : 'Цена'}: ${budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || 'Позиция'}`}
                        value={draftValues[item.id + '_price'] ?? String(editablePrice)}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_price']: e.target.value }))}
                        onBlur={(e) => {
                          const draftKey = item.id + '_price';
                          const hasDraft = draftValues[draftKey] !== undefined;
                          if (hasDraft) {
                            const normalizedValue = e.target.value.replace(',', '.').trim();
                            const inputValue = parseFloat(normalizedValue);
                            if (!isNaN(inputValue)) {
                              let usdPrice: number;
                              switch (paymentMode) {
                                case 'byn_cash':
                                  usdPrice = convertBYNCashtoUSDPrice(inputValue);
                                  break;
                                case 'byn_noncash':
                                  usdPrice = convertBYNNonCashtoUSDPrice(inputValue, item);
                                  break;
                                default:
                                  usdPrice = inputValue;
                              }
                              onUpdateItem(item.id, { price: usdPrice });
                            }
                          }
                          setDraftValues(prev => { const copy = { ...prev }; delete copy[draftKey]; return copy; });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        className="w-12 px-0.5 py-0.5 bg-transparent text-right text-gray-300 text-sm tabular-nums rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus:bg-gray-800"
                      />
                    </div>

                    {showCoefficient && (
                      <div data-mobile-label="Коэф." className="flex items-center justify-center">
                        {coefficientGroupsByItem ? <span className="tabular-nums text-gray-300"
                          title={coefficientGroup?.name ?? 'Без группы'}>{item.dynamic_coefficient ?? DEFAULT_DYNAMIC_COEFFICIENT}</span>
                          : editingCoefficientId === item.id ? <input
                            autoFocus
                            aria-label={`Коэффициент дополнительного дня — ${itemName}`}
                            type="text"
                            inputMode="decimal"
                            defaultValue={item.multi_day_rate_override ?? 0}
                            onFocus={event => event.target.select()}
                            onBlur={event => {
                              setEditingCoefficientId(null);
                              const value = Number(event.target.value.trim().replace(',', '.'));
                              if (!Number.isFinite(value)) return;
                              const coefficient = Math.min(1, Math.max(0, value));
                              if (coefficient !== (item.multi_day_rate_override ?? 0)) {
                                void onUpdateItem(item.id, { multi_day_rate_override: coefficient });
                              }
                            }}
                            onKeyDown={event => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                              if (event.key === 'Escape') {
                                event.currentTarget.value = String(item.multi_day_rate_override ?? 0);
                                event.currentTarget.blur();
                              }
                            }}
                            className="w-full max-w-[72px] rounded bg-gray-800 px-1 py-0.5 text-center text-sm tabular-nums text-gray-100 outline outline-1 outline-accent-500"
                          />
                          : <button type="button" onClick={() => setEditingCoefficientId(item.id)}
                            title="Изменить коэффициент дополнительного дня"
                            aria-label={`Коэффициент за весь период ${coefficientFormat.format(calcBudgetCoefficient(item, budgetDays))}. Изменить коэффициент дополнительного дня для ${itemName}`}
                            className="w-full rounded px-1 py-0.5 text-center tabular-nums text-gray-300 hover:bg-gray-700 hover:text-white">
                            {coefficientFormat.format(calcBudgetCoefficient(item, budgetDays))}
                          </button>}
                      </div>
                    )}

                    <div data-mobile-label="Сумма" className="text-right text-gray-100 tabular-nums font-semibold text-sm pr-2">
                      {(() => {
                        switch (paymentMode) {
                          case 'byn_cash':
                            return `${getDisplayedAmount(item).toFixed(2)} BYN`;
                          case 'byn_noncash':
                            return `${getDisplayedAmount(item).toFixed(2)} BYN`;
                          default:
                            return `${getDisplayedAmount(item).toFixed(2)}`;
                        }
                      })()}
                    </div>
                  </div>

                  <div className="budget-item-actions flex items-center gap-1">
                  <div className="relative w-5 flex justify-center flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMarkerDropdownId(openMarkerDropdownId === item.id ? null : item.id);
                      }}
                      className={`transition-opacity w-5 flex justify-center ${item.marker_color ? 'text-yellow-300 opacity-100' : 'text-gray-500 hover:text-yellow-300 opacity-0 group-hover:opacity-100'}`}
                      title="Маркер строки"
                    >
                      <Highlighter className="w-3 h-3" />
                    </button>
                    {openMarkerDropdownId === item.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMarkerDropdownId(null)} />
                        <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded shadow-lg p-1.5">
                          <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onUpdateItem(item.id, { marker_color: null });
                              setOpenMarkerDropdownId(null);
                            }}
                            className="text-xs text-gray-300 hover:text-white px-1"
                          >
                            Нет
                          </button>
                            {BUDGET_MARKER_COLORS.map((markerColor) => (
                              <button
                                key={markerColor}
                                onClick={() => {
                                  onUpdateItem(item.id, { marker_color: markerColor });
                                  setOpenMarkerDropdownId(null);
                                }}
                                className="w-4 h-4 rounded border border-gray-600"
                                style={{ backgroundColor: markerColor }}
                                title={markerColor}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.matchMedia('(max-width: 639px)').matches) setMobileNote(item);
                      else setNoteEditorsOpen(prev => ({ ...prev, [item.id]: !isNoteEditorOpen }));
                    }}
                    className={`transition-opacity w-5 flex justify-center flex-shrink-0 ${isNoteEditorOpen || item.notes ? 'text-accent-500 hover:text-accent-400 opacity-100' : 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100'}`}
                    title="Примечание"
                  >
                    <MessageSquarePlus className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity w-5 flex justify-center flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                  </div>
                  {/* Notes row */}
                  {isNoteEditorOpen && (
                    <div className="px-1.5 py-0.5 bg-gray-800/30 pl-4 border-b border-gray-800/30 flex items-center gap-1">
                      <button type="button" onClick={() => setMobileNote(item)}
                        className="min-h-11 min-w-0 flex-1 truncate text-left text-xs text-gray-300 sm:hidden"
                        aria-label="Открыть примечание">
                        {draftValues[item.id + '_notes'] ?? item.notes ?? 'Примечание'}
                      </button>
                      <input
                        type="text"
                        value={draftValues[item.id + '_notes'] ?? item.notes ?? ''}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_notes']: e.target.value }))}
                        disabled={savingNotes[item.id]}
                        onBlur={(e) => {
                          if (draftValues[item.id + '_notes'] !== undefined) void saveNote(item, e.target.value);
                        }}
                        placeholder="Примечание"
                        className="hidden sm:block min-w-0 flex-1 bg-transparent text-xs text-gray-300 placeholder-gray-400 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
                      />
                      <button
                        type="button"
                        disabled={savingNotes[item.id]}
                        onPointerDown={event => event.preventDefault()}
                        onClick={() => { void saveNote(item, '', true); }}
                        className="text-red-500/60 hover:text-red-400"
                        title="Удалить примечание"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {savingNotes[item.id] && <span role="status" className="text-xs text-gray-400">Сохранение…</span>}
                      {noteErrors[item.id] && <span role="alert" className="text-xs text-accent-300">Примечание не сохранено. Текст оставлен в поле. <button type="button" onPointerDown={event => event.preventDefault()} onClick={() => { void saveNote(item, draftValues[item.id + '_notes'] ?? item.notes ?? ''); }} className="underline">Повторить</button></span>}
                    </div>
                  )}
                </div>
              );
            })}
            <div
              className="h-2 border-t border-dashed border-gray-700/50 hover:border-accent-500/60 transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDragOver?.(e, dragTarget);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop?.(e, dragTarget);
              }}
              title="Перетащите сюда, чтобы переместить в конец категории"
            />
          </div>
        </div>
      )}
      {mobileNote && <BudgetNoteDialog
        key={mobileNote.id}
        text={draftValues[mobileNote.id + '_notes'] ?? mobileNote.notes ?? ''}
        onClose={() => setMobileNote(null)}
        onSave={async value => {
          const saved = await onUpdateItem(mobileNote.id, { notes: value });
          if (saved) {
            setDraftValues(current => { const next = { ...current }; delete next[mobileNote.id + '_notes']; return next; });
            setNoteEditorsOpen(current => ({ ...current, [mobileNote.id]: Boolean(value) }));
          }
          return saved;
        }}
      />}
    </div>
  );
}


