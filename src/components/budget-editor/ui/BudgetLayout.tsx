import { X, Plus, Save, Package, Download, FileText, Settings, ChevronDown, ChevronRight, MapPin, Pencil, Trash2, GripVertical } from 'lucide-react';
import { CategoryBlock } from '../../CategoryBlock';
import type { BudgetLogicVM } from '../hooks/useBudgetLogic';
import { buildCategoryGroupId, buildLocationUncategorizedGroupId, NO_LOCATION_GROUP_ID } from '../constants';

interface BudgetLayoutProps {
  vm: BudgetLogicVM;
  eventName: string;
  onClose: () => void;
}

export function BudgetLayout({ vm, eventName, onClose }: BudgetLayoutProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <style>{`
        .custom-scrollbar {
          scrollbar-gutter: stable;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
          display: block;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111827;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 10px;
          border: 2px solid #111827;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #374151 #111827;
        }
      `}</style>

      <div className="bg-gray-900 rounded-xl w-full max-w-[1600px] h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-800">
        <div className="px-4 py-2 border-b border-gray-800 flex justify-between items-center flex-shrink-0 bg-gray-900/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Смета: {eventName}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="w-3/5 flex flex-col border-r border-gray-800 min-w-0">
            <div className="bg-gray-900/80 border-b border-gray-800 px-3 py-2 flex-shrink-0">
              <div className="flex items-center justify-between relative category-dropdown-container">
                <div className="flex gap-2">
                  <button onClick={() => vm.setShowCategoryDropdown(!vm.showCategoryDropdown)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-cyan-900/20">
                    <Plus className="w-3.5 h-3.5" />Добавить категорию
                  </button>
                  <button onClick={() => vm.setShowLocationDialog(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20">
                    <MapPin className="w-3.5 h-3.5" />Добавить локацию
                  </button>
                  <button onClick={vm.handleCreateExtraServiceCategory} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-violet-900/20">
                    <Plus className="w-3.5 h-3.5" />Дополнительные услуги
                  </button>
                  <button onClick={() => vm.setShowTemplates(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-all border border-gray-700">
                    <Package className="w-3.5 h-3.5" />Шаблоны
                  </button>
                </div>

                {vm.showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar p-0.5">
                    {vm.globalCategories.map(category => (
                      <button key={category.id} onClick={() => vm.handleSelectCategory(category)} className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-lg">
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative exchange-rate-container">
                  <button onClick={() => vm.setShowExchangeRatePopover(!vm.showExchangeRatePopover)} className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all">
                    <Settings className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-medium">{vm.getCurrencyLabel()}</span>
                    <span className="text-[10px] text-gray-500 font-mono">({vm.exchangeRate.toFixed(2)})</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${vm.showExchangeRatePopover ? 'rotate-180' : ''}`} />
                  </button>
                  {vm.showExchangeRatePopover && (
                    <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Курс валюты</label>
                      <input type="number" step="0.01" value={vm.exchangeRate} onChange={(e) => vm.setExchangeRate(parseFloat(e.target.value) || 1)} className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-cyan-500 outline-none" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div ref={vm.budgetListRef} className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 custom-scrollbar">
              {vm.locations.map((location) => {
                const locationGroupId = `location:${location.id}`;
                const locationHasContent = vm.categories.some((category) => {
                  const categoryGroupId = buildCategoryGroupId(category.id, location.id);
                  return (vm.groupedItems[categoryGroupId]?.length || 0) > 0 || vm.activeCategoryIds.has(categoryGroupId);
                }) || (vm.groupedItems[buildLocationUncategorizedGroupId(location.id)]?.length || 0) > 0;

                if (!locationHasContent && !vm.activeCategoryIds.has(locationGroupId)) return null;

                return (
                  <div key={location.id} className={`transition-all duration-200 rounded-xl border border-emerald-900/30 ${vm.dragOverTarget === locationGroupId ? 'ring-2 ring-emerald-500 bg-emerald-500/5 p-0.5' : ''} ${vm.locationDragOverId === location.id ? 'ring-2 ring-cyan-400' : ''}`} onDragOver={(e) => vm.handleDragOver(e, { type: 'location', id: location.id, locationId: location.id })} onDrop={(e) => vm.handleDrop(e, { type: 'location', id: location.id, locationId: location.id })}>
                    <div className="w-full px-3 py-2 text-xs font-semibold text-white flex items-center justify-between gap-2" style={{ backgroundColor: location.color || '#14532d' }}>
                      <button type="button" className="flex-1 flex items-center gap-2 text-left" onClick={() => vm.setExpandedCategories(prev => ({ ...prev, [locationGroupId]: !prev[locationGroupId] }))}>
                        <div draggable onDragStart={(e) => vm.handleLocationDragStart(e, location.id)} onDragOver={(e) => vm.handleLocationDragOver(e, location.id)} onDrop={(e) => vm.handleLocationDrop(e, location.id)} className="text-white/70 hover:text-white cursor-move" onClick={(e) => e.stopPropagation()}>
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                        {(vm.expandedCategories[locationGroupId] ?? true) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{location.name}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1 rounded hover:bg-black/20" onClick={() => vm.handleUpdateLocation(location)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" className="p-1 rounded hover:bg-black/20" onClick={() => vm.handleDeleteLocation(location)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>

                    {(vm.expandedCategories[locationGroupId] ?? true) && (
                      <div className="pl-2 border-l border-emerald-900/30">
                        {vm.categories.filter(cat => cat.is_template !== true).map((category) => {
                          const categoryGroupId = buildCategoryGroupId(category.id, location.id);
                          const categoryItems = vm.groupedItems[categoryGroupId] || [];
                          if (categoryItems.length === 0 && !vm.activeCategoryIds.has(categoryGroupId)) return null;
                          return (
                            <CategoryBlock
                              key={categoryGroupId}
                              categoryId={categoryGroupId}
                              categoryName={category.name}
                              locationId={location.id}
                              items={categoryItems}
                              isExpanded={vm.expandedCategories[categoryGroupId] || false}
                              isSelected={vm.selectedCategoryId === categoryGroupId}
                              onToggleExpand={() => vm.setExpandedCategories(prev => ({ ...prev, [categoryGroupId]: !prev[categoryGroupId] }))}
                              onSelect={() => vm.setSelectedCategoryId(vm.selectedCategoryId === categoryGroupId ? null : categoryGroupId)}
                              onUpdateCategoryName={(name) => vm.handleUpdateCategoryName(category.id, name)}
                              onUpdateItem={vm.handleUpdateItem}
                              onDeleteItem={vm.handleDeleteItem}
                              onDeleteCategory={() => vm.handleDeleteCategory(category.id)}
                              onManagePersonnel={vm.handleOpenWorkPersonnelManager}
                              paymentMode={vm.paymentMode}
                              exchangeRate={vm.exchangeRate}
                              onDragStart={vm.handleDragStart}
                              onDragOver={vm.handleDragOver}
                              onDrop={vm.handleDrop}
                              onDragOverItem={vm.handleDragOverItem}
                              onDropOnItem={vm.handleDropOnItem}
                              dragOverItemId={vm.dragOverItemId}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="w-px" />
            </div>
          </div>

          <div className="w-2/5 flex flex-col bg-gray-900/30 min-w-0">
            <div className="p-3 border-b border-gray-800 space-y-2 flex-shrink-0">
              <input type="text" value={vm.searchTerm} onChange={(e) => vm.setSearchTerm(e.target.value)} placeholder="Поиск по названию или категории..." className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white" />
              <div className="flex bg-gray-800 p-0.5 rounded-lg">
                <button onClick={() => vm.setSelectedItemType('Оборудование')} className={`flex-1 py-1.5 text-[10px] ${vm.selectedItemType === 'Оборудование' ? 'bg-gray-700 text-cyan-400' : 'text-gray-500'}`}>Оборудование</button>
                <button onClick={() => vm.setSelectedItemType('Работа')} className={`flex-1 py-1.5 text-[10px] ${vm.selectedItemType === 'Работа' ? 'bg-gray-700 text-cyan-400' : 'text-gray-500'}`}>Работа / Персонал</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
              {vm.selectedItemType === 'Оборудование' ? vm.filteredEquipment.map(item => (
                <div key={item.id} onClick={() => vm.handleEquipmentClick(item)} className="group flex items-center justify-between px-3 py-2 hover:bg-cyan-500/5 transition-colors cursor-pointer">
                  <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white">{item.name}</p>
                  <div className="flex items-center gap-3 ml-3"><p className="text-xs font-mono text-cyan-500 font-bold">${item.rental_price}</p><Plus className="w-3.5 h-3.5" /></div>
                </div>
              )) : vm.filteredWorkItems.map(item => (
                <div key={item.id} onClick={() => vm.handleAddWorkItem(item)} className="group flex items-center justify-between px-3 py-2 hover:bg-cyan-500/5 transition-colors cursor-pointer">
                  <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white">{item.name}</p>
                  <Plus className="w-3.5 h-3.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 flex items-center justify-between flex-shrink-0">
          <span className="text-xl font-black text-white"><span className="text-cyan-400">{vm.getTotalForMode().toLocaleString()}</span> <span className="text-xs text-gray-400">{vm.getCurrencyLabel()}</span></span>
          <div className="flex items-center gap-2">
            <button onClick={vm.handleExportPDF} disabled={vm.generatingPDF || vm.budgetItems.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg"><Download className="w-3.5 h-3.5" /><span className="text-xs">PDF</span></button>
            <button onClick={onClose} className="px-4 py-1.5 text-gray-400 text-xs">Отмена</button>
            <button onClick={vm.handleSave} disabled={vm.saving} className="flex items-center gap-1.5 px-5 py-1.5 bg-green-600 text-white rounded-lg"><Save className="w-3.5 h-3.5" />{vm.saving ? 'Сохранение...' : 'Завершить'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
