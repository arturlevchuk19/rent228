import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Check, X, GripVertical, Users, Trash2 } from 'lucide-react';
import { BudgetItem } from '../lib/events';

interface CategoryBlockProps {
  categoryId: string;
  categoryName: string;
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
  onDragStart?: (e: React.DragEvent, type: 'category' | 'item', id: string) => void;
  onDragOver?: (e: React.DragEvent, categoryId: string) => void;
  onDrop?: (e: React.DragEvent, categoryId: string) => void;
  onDragOverItem?: (e: React.DragEvent, itemId: string) => void;
  onDropOnItem?: (e: React.DragEvent, targetItemId: string) => void;
  dragOverItemId?: string | null;
  categoryRef?: (el: HTMLDivElement | null) => void;
}

export function CategoryBlock({
  categoryId,
  categoryName,
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
  onDragStart,
  onDragOver,
  onDrop,
  onDragOverItem,
  onDropOnItem,
  dragOverItemId,
  categoryRef
}: CategoryBlockProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(categoryName);

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

  const calculateBYNCash = (priceUSD: number, quantity: number): number => {
    const baseAmount = priceUSD * exchangeRate * quantity;
    return Math.round(baseAmount / 5) * 5;
  };

  const isDeliveryWork = (item: BudgetItem): boolean => {
    if (item.item_type !== 'work') return false;
    const workName = item.work_item?.name?.toLowerCase() || '';
    return workName.includes('доставка оборудования') || workName.includes('доставка персонала');
  };

  const calculateBYNNonCash = (priceUSD: number, quantity: number, item?: BudgetItem): number => {
    const baseAmount = priceUSD * exchangeRate * quantity;
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

  const getCategoryTotal = () => {
    return items.reduce((sum, item) => {
      switch (paymentMode) {
        case 'byn_cash':
          return sum + calculateBYNCash(item.price, item.quantity);
        case 'byn_noncash':
          return sum + calculateBYNNonCash(item.price, item.quantity, item);
        default:
          return sum + item.price * item.quantity;
      }
    }, 0);
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

  const categoryTotal = getCategoryTotal();

  const hasWorkItems = items.some(item => item.item_type === 'work');

  return (
    <div
      ref={categoryRef}
      className={`bg-gray-900 border-b border-gray-800 transition-all ${
        isSelected ? 'bg-gray-800/50' : ''
      }`}
      onDragOver={(e) => onDragOver?.(e, categoryId)}
      onDrop={(e) => onDrop?.(e, categoryId)}
    >
      {/* Category header - compact, sticky */}
      <div
        className={`flex items-center gap-1 px-1.5 py-1 transition-colors cursor-pointer sticky top-0 z-10 ${
          isSelected ? 'bg-cyan-900/20' : 'bg-gray-900 hover:bg-gray-800'
        }`}
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
                <Edit2 className="w-2.5 h-2.5" />
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

        <div className="text-[10px] font-medium text-cyan-400 ml-0.5" onClick={(e) => e.stopPropagation()}>
          {paymentMode !== 'usd' ? `${categoryTotal.toFixed(2)} ${getCurrencyLabel()}` : `${categoryTotal.toFixed(2)}`}
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
            <div className="flex-1 grid grid-cols-12 gap-0.5">
              <div className="col-span-5">Наименование</div>
              <div className="col-span-2 text-center">Кол-во</div>
              <div className="col-span-2 text-right">Цена</div>
              <div className="col-span-3 text-right">Сумма</div>
            </div>
            <div className="w-5"></div>
          </div>

          {/* Items */}
          <div>
            {items.map((item) => (
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

                  <div className="flex-1 grid grid-cols-12 gap-0.5 items-center text-xs">
                    <div className="col-span-5 text-gray-300 truncate">
                      {item.equipment?.name || item.work_item?.name || 'Без названия'}
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <div className="flex items-center">
                        <button
                          onClick={() => onUpdateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-[10px]"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-8 px-0.5 py-0.5 bg-transparent text-center text-white text-xs focus:outline-none"
                          min="1"
                        />
                        <button
                          onClick={() => onUpdateItem(item.id, { quantity: item.quantity + 1 })}
                          className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded text-[10px]"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={(() => {
                          switch (paymentMode) {
                            case 'byn_cash':
                              return convertUSDtoBYNCashPrice(item.price);
                            case 'byn_noncash':
                              return convertUSDtoBYNNonCashPrice(item.price, item);
                            default:
                              return item.price;
                          }
                        })()}
                        onChange={(e) => {
                          const inputValue = parseFloat(e.target.value) || 0;
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
                        }}
                        className="w-14 px-0.5 py-0.5 bg-transparent text-right text-gray-400 text-xs focus:outline-none focus:bg-gray-800 rounded"
                      />
                    </div>

                    <div className="col-span-3 text-right text-cyan-400 font-medium text-xs">
                      {(() => {
                        switch (paymentMode) {
                          case 'byn_cash':
                            return `${calculateBYNCash(item.price, item.quantity).toFixed(2)} BYN`;
                          case 'byn_noncash':
                            return `${calculateBYNNonCash(item.price, item.quantity, item).toFixed(2)} BYN`;
                          default:
                            return `${(item.price * item.quantity).toFixed(2)}`;
                        }
                      })()}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity w-5 flex justify-center flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {/* Notes row */}
                {item.notes && (
                  <div className="px-1.5 py-0.5 bg-gray-800/30 text-[9px] text-gray-500 truncate pl-4">
                    {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
