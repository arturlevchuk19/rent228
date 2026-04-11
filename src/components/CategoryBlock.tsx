import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Check, X, GripVertical, Users, Trash2, MessageSquarePlus } from 'lucide-react';
import { BudgetItem } from '../lib/events';
import { calcCombinedTotal, calcDay1Total, calcGrandTotals } from '../lib/budgetPricing';

export interface BudgetDragTarget {
  type: 'category' | 'location' | 'uncategorized';
  id: string;
  locationId?: string | null;
}

interface CategoryBlockProps {
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
  onUpdateItem: (itemId: string, updates: Partial<BudgetItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onManagePersonnel?: (categoryId: string) => void;
  paymentMode: 'usd' | 'byn_cash' | 'byn_noncash';
  exchangeRate: number;
  budgetDays: number;
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
  onManagePersonnel,
  paymentMode,
  exchangeRate,
  budgetDays,
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(categoryName);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [noteEditorsOpen, setNoteEditorsOpen] = useState<Record<string, boolean>>({});
  const showCoefficient = budgetDays > 1;
  const tableTemplateColumns = showCoefficient
    ? 'minmax(0,1fr) 92px 92px 72px 110px'
    : 'minmax(0,1fr) 92px 92px 110px';

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

  const calculateBYNCash = (amountUSD: number): number => {
    const baseAmount = amountUSD * exchangeRate;
    return Math.round(baseAmount / 5) * 5;
  };

  const isDeliveryWork = (item: BudgetItem): boolean => {
    if (item.item_type !== 'work') return false;
    const workName = item.work_item?.name?.toLowerCase() || '';
    return workName.includes('доставка оборудования') || workName.includes('доставка персонала');
  };

  const calculateBYNNonCash = (amountUSD: number, item?: BudgetItem): number => {
    const baseAmount = amountUSD * exchangeRate;
    let withBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withBankRate = baseAmount * 1.67;
    } else {
      withBankRate = baseAmount / 0.8;
    }
    return Math.round(withBankRate / 5) * 5;
  };

  const convertUSDtoBYNCashPrice = (priceUSD: number): number => {
    const baseAmount = priceUSD * exchangeRate;
    return Math.round(baseAmount / 5) * 5;
  };

  const convertUSDtoBYNCashPriceRaw = (priceUSD: number): number => {
    return Math.round(priceUSD * exchangeRate * 100) / 100;
  };

  const convertUSDtoBYNNonCashPrice = (priceUSD: number, item?: BudgetItem): number => {
    const baseAmount = priceUSD * exchangeRate;
    let withBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withBankRate = baseAmount * 1.67;
    } else {
      withBankRate = baseAmount / 0.8;
    }
    return Math.round(withBankRate / 5) * 5;
  };

  const convertUSDtoBYNNonCashPriceRaw = (priceUSD: number, item?: BudgetItem): number => {
    const baseAmount = priceUSD * exchangeRate;
    const hasPrice = item?.equipment?.rental_price ? item.equipment.rental_price > 0 : false;
    const withBankRate = hasPrice ? baseAmount * 1.67 : baseAmount * 0.8;
    return Math.round(withBankRate * 100) / 100;
  };

  const convertBYNCashtoUSDPrice = (priceBYN: number): number => {
    const usdPrice = priceBYN / exchangeRate;
    return Math.round(usdPrice * 100) / 100;
  };

  const convertBYNNonCashtoUSDPrice = (priceBYN: number, item?: BudgetItem): number => {
    let withoutBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withoutBankRate = priceBYN / 1.67;
    } else {
      withoutBankRate = priceBYN * 0.8;
    }
    const usdPrice = withoutBankRate / exchangeRate;
    return Math.round(usdPrice * 100) / 100;
  };

  const getDisplayedAmount = (item: BudgetItem) => {
    if (paymentMode === 'usd') {
      const usdAmount = budgetTotalsMode === 'combined_only'
        ? calcCombinedTotal(item, budgetDays)
        : calcDay1Total(item);
      return usdAmount;
    }

    const displayedPrice = getDisplayedPrice(item);
    return displayedPrice * item.quantity;
  };

  const getDisplayedPriceUSD = (item: BudgetItem) => {
    if (budgetTotalsMode === 'combined_only') {
      const normalizedDays = Math.max(1, budgetDays);
      const extraDays = Math.max(0, normalizedDays - 1);
      const appliedRate = item.multi_day_rate_override ?? 0;
      return item.price + item.price * appliedRate * extraDays;
    }

    return item.price;
  };

  const getDisplayedPrice = (item: BudgetItem) => {
    const usdPrice = getDisplayedPriceUSD(item);

    switch (paymentMode) {
      case 'byn_cash':
        return convertUSDtoBYNCashPrice(usdPrice);
      case 'byn_noncash':
        return convertUSDtoBYNNonCashPrice(usdPrice, item);
      default:
        return usdPrice;
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
      const unitPriceUSD = item.price;
      const unitPriceBYN = paymentMode === 'byn_cash'
        ? convertUSDtoBYNCashPrice(unitPriceUSD)
        : convertUSDtoBYNNonCashPrice(unitPriceUSD, item);
      return sum + unitPriceBYN * item.quantity;
    }, 0);
  })();

  const sectionCombinedTotal = (() => {
    if (paymentMode === 'usd') {
      return categoryTotals.combinedTotal;
    }

    return items.reduce((sum, item) => {
      const unitPriceUSDForNDays = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
      const unitPriceBYN = paymentMode === 'byn_cash'
        ? convertUSDtoBYNCashPrice(unitPriceUSDForNDays)
        : convertUSDtoBYNNonCashPrice(unitPriceUSDForNDays, item);
      return sum + unitPriceBYN * item.quantity;
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
      className={`bg-gray-900 border-b border-gray-800 transition-all ${
        isSelected ? 'bg-gray-800/50' : ''
      } ${locationColor ? 'border-l-2' : ''}`}
      style={locationColor ? { borderLeftColor: locationColor } : undefined}
      onDragOver={(e) => onDragOver?.(e, dragTarget)}
      onDrop={(e) => onDrop?.(e, dragTarget)}
    >
      {/* Category header - compact, sticky */}
      <div
        style={headerStyle}
        className={`flex items-center gap-1 px-1.5 py-1 transition-colors cursor-pointer sticky top-0 z-10 ${
          isSelected ? 'bg-cyan-900/20' : 'bg-gray-900 hover:bg-gray-800'
        } ${headerClassName || ''}`}
        onClick={onSelect}
      >
        {categoryId !== 'uncategorized' && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart?.(e, 'category', categoryId);
            }}
            className="text-gray-500 hover:text-gray-400 cursor-move"
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
          className="text-gray-500 hover:text-gray-400 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

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
              className="flex-1 px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
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
            <h3 className="font-medium text-xs text-gray-300 flex-1 truncate">{categoryName}</h3>
            {hasWorkItems && onManagePersonnel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManagePersonnel(categoryId);
                }}
                className="text-blue-500 hover:text-blue-400 transition-colors"
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
            {categoryId !== 'uncategorized' && onDeleteCategory && (
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

        <div className="text-[10px] font-medium text-cyan-400 ml-0.5 text-right leading-tight" onClick={(e) => e.stopPropagation()}>
          {budgetTotalsMode === 'day1_plus_combined' && (
            <div>
              1д: {formatSectionTotal(sectionDay1Total)}
            </div>
          )}
          <div>
            {budgetDays}д: {formatSectionTotal(sectionCombinedTotal)}
          </div>
        </div>

        <div className="text-[10px] text-gray-600 ml-0.5" onClick={(e) => e.stopPropagation()}>
          ({items.length})
        </div>
      </div>

      {/* Items table - flat, compact */}
      {isExpanded && items.length > 0 && (
        <div>
          {/* Table header */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900/50 text-[10px] text-gray-500 border-b border-gray-800">
            <div className="w-3"></div>
            <div
              className="flex-1 grid items-center gap-2"
              style={{ gridTemplateColumns: tableTemplateColumns }}
            >
              <div className="text-left">Наименование</div>
              <div className="text-center">Кол-во</div>
              <div className="text-center">Цена</div>
              {showCoefficient && <div className="text-center">Коэф.</div>}
              <div className="text-right pr-2">Сумма</div>
            </div>
            <div className="w-5"></div>
          </div>

          {/* Items */}
          <div>
            {items.map((item) => {
              const isNoteEditorOpen = noteEditorsOpen[item.id] ?? Boolean(item.notes);
              const displayedPrice = getDisplayedPrice(item);
              const editablePrice = (() => {
                switch (paymentMode) {
                  case 'byn_cash':
                    return convertUSDtoBYNCashPriceRaw(item.price);
                  case 'byn_noncash':
                    return convertUSDtoBYNNonCashPriceRaw(item.price, item);
                  default:
                    return item.price;
                }
              })();
              return (
                <div
                  key={item.id}
                  className="group"
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
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-b-0 ${dragOverItemId === item.id ? 'bg-cyan-500/10 border-cyan-500/50' : ''}`}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      onDragStart?.(e, 'item', item.id);
                    }}
                    className="text-gray-600 hover:text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <GripVertical className="w-3 h-3" />
                  </div>

                  <div
                    className="flex-1 grid items-center gap-2 text-xs"
                    style={{ gridTemplateColumns: tableTemplateColumns }}
                  >
                    <div className="text-gray-300 truncate pr-2">
                      {item.equipment?.name || item.work_item?.name || 'Без названия'}
                    </div>

                    <div className="flex justify-center">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-[10px]"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draftValues[item.id + '_quantity'] ?? String(item.quantity)}
                          onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_quantity']: e.target.value }))}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value);
                            if (!isNaN(n)) onUpdateItem(item.id, { quantity: Math.max(1, n) });
                            setDraftValues(prev => { const copy = { ...prev }; delete copy[item.id + '_quantity']; return copy; });
                          }}
                          className="w-8 px-0.5 py-0.5 bg-transparent text-center text-white text-xs focus:outline-none"
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        />
                        <button
                          onClick={() => onUpdateItem(item.id, { quantity: item.quantity + 1 })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-[10px]"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pr-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftValues[item.id + '_price'] ?? String(editablePrice)}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_price']: e.target.value }))}
                        onBlur={(e) => {
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
                          setDraftValues(prev => { const copy = { ...prev }; delete copy[item.id + '_price']; return copy; });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        className="w-14 px-0.5 py-0.5 bg-transparent text-right text-gray-400 text-xs rounded focus:outline-none focus:bg-gray-800"
                      />
                    </div>

                    {showCoefficient && (
                      <div className="flex justify-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draftValues[item.id + '_multi_day_rate_override'] ?? String(item.multi_day_rate_override ?? 0)}
                          onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_multi_day_rate_override']: e.target.value }))}
                          onBlur={(e) => {
                            const inputValue = e.target.value.trim();
                            const parsedValue = inputValue === '' ? 0 : parseFloat(inputValue);
                            if (!isNaN(parsedValue)) {
                              const clampedValue = Math.min(1, Math.max(0, parsedValue));
                              onUpdateItem(item.id, { multi_day_rate_override: clampedValue });
                            }
                            setDraftValues(prev => {
                              const copy = { ...prev };
                              delete copy[item.id + '_multi_day_rate_override'];
                              return copy;
                            });
                          }}
                          className="w-full max-w-[72px] px-1 py-0.5 bg-transparent text-center text-gray-400 text-xs focus:outline-none focus:bg-gray-800 rounded"
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                        />
                      </div>
                    )}

                    <div className="text-right text-cyan-400 font-medium text-xs pr-2">
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

                  <button
                    type="button"
                    onClick={() => setNoteEditorsOpen(prev => ({ ...prev, [item.id]: !isNoteEditorOpen }))}
                    className={`transition-opacity w-5 flex justify-center flex-shrink-0 ${isNoteEditorOpen || item.notes ? 'text-cyan-500 hover:text-cyan-400 opacity-100' : 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100'}`}
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
                  {/* Notes row */}
                  {isNoteEditorOpen && (
                    <div className="px-1.5 py-0.5 bg-gray-800/30 pl-4 border-b border-gray-800/30 flex items-center gap-1">
                      <input
                        type="text"
                        value={draftValues[item.id + '_notes'] ?? item.notes ?? ''}
                        onChange={(e) => setDraftValues(prev => ({ ...prev, [item.id + '_notes']: e.target.value }))}
                        onBlur={(e) => {
                          onUpdateItem(item.id, { notes: e.target.value });
                          setDraftValues(prev => {
                            const copy = { ...prev };
                            delete copy[item.id + '_notes'];
                            return copy;
                          });
                        }}
                        placeholder="Примечание"
                        className="flex-1 bg-transparent text-[9px] text-gray-500 placeholder-gray-600 focus:outline-none focus:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateItem(item.id, { notes: '' });
                          setDraftValues(prev => {
                            const copy = { ...prev };
                            delete copy[item.id + '_notes'];
                            return copy;
                          });
                          setNoteEditorsOpen(prev => ({ ...prev, [item.id]: false }));
                        }}
                        className="text-red-500/60 hover:text-red-400"
                        title="Удалить примечание"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div
              className="h-2 border-t border-dashed border-gray-700/50 hover:border-cyan-500/60 transition-colors"
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
    </div>
  );
}
