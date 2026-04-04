import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Save, Package, Download, FileText, Settings, ChevronDown, ChevronRight, MapPin, Pencil, Trash2, GripVertical } from 'lucide-react';
import { BudgetItem, getBudgetItems, createBudgetItem, updateBudgetItem, deleteBudgetItem, getEvent, updateEvent } from '../lib/events';
import { EquipmentItem, getEquipmentItems } from '../lib/equipment';
import { WorkItem, getWorkItems } from '../lib/personnel';
import { Category, createCategory, getCategories, getCategoriesForEvent, updateCategory } from '../lib/categories';
import { Location, createLocation, getLocationsForEvent, updateLocation, deleteLocation } from '../lib/locations';
import { CategoryBlock, type BudgetDragTarget } from './CategoryBlock';
import { WorkPersonnelManager } from './WorkPersonnelManager';
import { TemplatesInBudget } from './TemplatesInBudget';
import { WarehouseSpecification } from './WarehouseSpecification';
import { generateBudgetPDF } from '../lib/pdfGenerator';
import { calcCombinedTotal, calcGrandTotals } from '../lib/budgetPricing';
import {
  UShapeUnifiedDialog,
  LedSizeDialog,
  PodiumDialog,
  TotemDialog,
  AddLocationDialog
} from './dialogs';

interface BudgetEditorProps {
  eventId: string;
  eventName: string;
  onClose: () => void;
}

interface GroupedItemsByLocation {
  [locationCategoryKey: string]: BudgetItem[];
}

const NO_LOCATION_GROUP_ID = 'no-location';
const UNCATEGORIZED_IN_LOCATION_KEY = 'uncategorized';
const EXTRA_SERVICE_DESCRIPTION_FLAG = '__extra_service__';

const buildCategoryGroupId = (categoryId: string, locationId?: string | null) =>
  locationId ? `location:${locationId}::category:${categoryId}` : `category:${categoryId}`;

const buildLocationUncategorizedGroupId = (locationId: string) =>
  `location:${locationId}::${UNCATEGORIZED_IN_LOCATION_KEY}`;

const parseGroupId = (groupId: string): { locationId: string | null; categoryId: string | null } => {
  if (groupId.startsWith('location:')) {
    const [, rest] = groupId.split('location:');
    const [locationId, tail] = rest.split('::');
    if (!tail || tail === UNCATEGORIZED_IN_LOCATION_KEY) {
      return { locationId, categoryId: null };
    }
    if (tail.startsWith('category:')) {
      return { locationId, categoryId: tail.replace('category:', '') };
    }
  }

  if (groupId.startsWith('category:')) {
    return { locationId: null, categoryId: groupId.replace('category:', '') };
  }

  return { locationId: null, categoryId: null };
};

export function BudgetEditor({ eventId, eventName, onClose }: BudgetEditorProps) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [globalCategories, setGlobalCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<string>('Оборудование');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState<string>('Все');
  const [exchangeRate, setExchangeRate] = useState(3.0);
  const [paymentMode, setPaymentMode] = useState<'usd' | 'byn_cash' | 'byn_noncash'>('usd');
  const [workPersonnelManagerOpen, setWorkPersonnelManagerOpen] = useState(false);
  const [selectedCategoryForPersonnel, setSelectedCategoryForPersonnel] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [draggedItem, setDraggedItem] = useState<{ type: 'category' | 'item'; id: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showWarehouseSpec, setShowWarehouseSpec] = useState(false);
  const [showExchangeRatePopover, setShowExchangeRatePopover] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showLedSizeDialog, setShowLedSizeDialog] = useState(false);
  const [selectedLedEquipment, setSelectedLedEquipment] = useState<EquipmentItem | null>(null);
  

  const [showPodiumDialog, setShowPodiumDialog] = useState(false);
  const [selectedPodiumEquipment, setSelectedPodiumEquipment] = useState<EquipmentItem | null>(null);
  

  const [showTotemDialog, setShowTotemDialog] = useState(false);
  const [selectedTotemEquipment, setSelectedTotemEquipment] = useState<EquipmentItem | null>(null);
  const [isMonototem, setIsMonototem] = useState(false);

  const [showUShapeUnifiedDialog, setShowUShapeUnifiedDialog] = useState(false);
  const [selectedUShapeEquipment, setSelectedUShapeEquipment] = useState<EquipmentItem | null>(null);
  const [uShapeMode, setUShapeMode] = useState<'standard' | 'lifting'>('standard');

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [discountPercentInput, setDiscountPercentInput] = useState('10');
  const [budgetDays, setBudgetDays] = useState(1);
  const [budgetDaysInput, setBudgetDaysInput] = useState('1');
  const [budgetTotalsMode, setBudgetTotalsMode] = useState<'combined_only' | 'day1_plus_combined'>('combined_only');
  const [draggedLocationId, setDraggedLocationId] = useState<string | null>(null);
  const [locationDragOverId, setLocationDragOverId] = useState<string | null>(null);

  const budgetListRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAddedItemRef = useRef<string | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCategoryDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.category-dropdown-container')) {
          setShowCategoryDropdown(false);
        }
      }
      if (showExchangeRatePopover) {
        const target = event.target as HTMLElement;
        if (!target.closest('.exchange-rate-container')) {
          setShowExchangeRatePopover(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown, showExchangeRatePopover]);

  useEffect(() => {
    if (budgetDays <= 1 && budgetTotalsMode === 'day1_plus_combined') {
      setBudgetTotalsMode('combined_only');
    }
  }, [budgetDays, budgetTotalsMode]);

  useEffect(() => {
    setBudgetDaysInput(String(budgetDays));
  }, [budgetDays]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetData, globalCategoriesData, eventCategoriesData, locationsData, equipmentData, workItemsData, eventData] = await Promise.all([
        getBudgetItems(eventId),
        getCategories(),
        getCategoriesForEvent(eventId),
        getLocationsForEvent(eventId),
        getEquipmentItems(),
        getWorkItems(),
        getEvent(eventId)
      ]);
      setBudgetItems(budgetData);
      setGlobalCategories(globalCategoriesData);
      setCategories([...globalCategoriesData, ...eventCategoriesData]);
      setLocations(locationsData);
      setEquipment(equipmentData);
      setWorkItems(workItemsData);

      if (budgetData.length > 0 && budgetData[0].exchange_rate) {
        setExchangeRate(budgetData[0].exchange_rate);
      }

      // Load discount settings from event
      if (eventData.discount_enabled !== undefined) {
        setDiscountEnabled(eventData.discount_enabled);
      }
      if (eventData.discount_percent !== undefined) {
        setDiscountPercent(eventData.discount_percent);
        setDiscountPercentInput(eventData.discount_percent.toString());
      }
      if (eventData.budget_days !== undefined && eventData.budget_days !== null) {
        setBudgetDays(Math.max(1, eventData.budget_days));
      }
      if (eventData.budget_totals_mode) {
        setBudgetTotalsMode(eventData.budget_totals_mode);
      }

      const initialExpanded: Record<string, boolean> = {};
      const initialActive = new Set<string>();

      [...globalCategoriesData, ...eventCategoriesData].forEach(cat => {
        initialExpanded[cat.id] = true;
      });

      budgetData.forEach(item => {
        if (item.category_id) {
          initialActive.add(buildCategoryGroupId(item.category_id, item.location_id));
        } else if (item.location_id) {
          initialActive.add(buildLocationUncategorizedGroupId(item.location_id));
        } else {
          initialActive.add(NO_LOCATION_GROUP_ID);
        }
      });

      setExpandedCategories(initialExpanded);
      setActiveCategoryIds(initialActive);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = async (templateCategory: Category) => {
    setShowCategoryDropdown(false);

    try {
      const localCategory = await createCategory(
        templateCategory.name,
        templateCategory.description,
        false,
        eventId
      );

      setCategories(prev => [...prev, localCategory]);
      setActiveCategoryIds(prev => {
        const next = new Set(prev);
        next.add(`category:${localCategory.id}`);
        return next;
      });
      setExpandedCategories(prev => ({ ...prev, [`category:${localCategory.id}`]: true }));
      setSelectedCategoryId(`category:${localCategory.id}`);
    } catch (error) {
      console.error('Error creating local category copy:', error);
      alert('Ошибка создания категории');
    }
  };

  const isExtraServiceCategory = (categoryId: string | null | undefined) => {
    if (!categoryId) return false;
    const category = categories.find((item) => item.id === categoryId);
    return category?.description === EXTRA_SERVICE_DESCRIPTION_FLAG;
  };

  const handleCreateExtraServiceCategory = async () => {
    const baseName = 'Доп услуги';
    const existingNames = categories.map((item) => item.name.trim().toLowerCase());
    let nextName = baseName;
    let index = 2;
    while (existingNames.includes(nextName.toLowerCase())) {
      nextName = `${baseName} ${index}`;
      index += 1;
    }

    try {
      const category = await createCategory(nextName, EXTRA_SERVICE_DESCRIPTION_FLAG, false, eventId);
      const groupId = buildCategoryGroupId(category.id);
      setCategories((prev) => [...prev, category]);
      setActiveCategoryIds((prev) => {
        const next = new Set(prev);
        next.add(groupId);
        return next;
      });
      setExpandedCategories((prev) => ({ ...prev, [groupId]: true }));
      setSelectedCategoryId(groupId);
    } catch (error) {
      console.error('Error creating extra service category:', error);
      alert('Ошибка создания категории "Доп услуги"');
    }
  };

  const handleCreateLocation = async ({ name, color }: { name: string; color: string }) => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName) {
      alert('Название локации обязательно');
      return;
    }

    if (locations.some((location) => location.name.trim().toLowerCase() === normalizedName)) {
      alert('Локация с таким названием уже существует в этом событии');
      return;
    }

    try {
      const newLocation = await createLocation(eventId, name, color);
      setLocations((prev) => [...prev, newLocation]);
      setActiveCategoryIds(prev => {
        const next = new Set(prev);
        next.add(`location:${newLocation.id}`);
        return next;
      });
      setExpandedCategories(prev => ({ ...prev, [`location:${newLocation.id}`]: true }));
      setSelectedCategoryId(`location:${newLocation.id}`);
    } catch (error) {
      console.error('Error creating location:', error);
      alert('Ошибка создания локации');
    }
  };

  const handleUpdateLocation = async (location: Location) => {
    const rawName = window.prompt('Введите новое название локации', location.name);
    if (rawName === null) return;

    const name = rawName.trim();
    if (!name) {
      alert('Название локации обязательно');
      return;
    }

    if (
      locations.some(
        (item) => item.id !== location.id && item.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      alert('Локация с таким названием уже существует в этом событии');
      return;
    }

    try {
      const updated = await updateLocation(location.id, { name });
      setLocations((prev) => prev.map((item) => (item.id === location.id ? updated : item)));
    } catch (error: any) {
      console.error('Error updating location:', error);
      alert(`Ошибка обновления локации: ${error.message}`);
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (!window.confirm(`Удалить локацию «${location.name}» и все категории/позиции внутри?`)) {
      return;
    }

    try {
      const itemsToDelete = budgetItems.filter((item) => item.location_id === location.id);

      for (const item of itemsToDelete) {
        await deleteBudgetItem(item.id);
      }

      await deleteLocation(location.id);

      setBudgetItems((prev) => prev.filter((item) => item.location_id !== location.id));
      setLocations((prev) => prev.filter((item) => item.id !== location.id));
      setActiveCategoryIds((prev) => {
        const next = new Set<string>();
        prev.forEach((groupId) => {
          if (!groupId.startsWith(`location:${location.id}`)) {
            next.add(groupId);
          }
        });
        return next;
      });
      setExpandedCategories((prev) => {
        const next: Record<string, boolean> = {};
        Object.entries(prev).forEach(([groupId, isExpanded]) => {
          if (!groupId.startsWith(`location:${location.id}`)) {
            next[groupId] = isExpanded;
          }
        });
        return next;
      });
      setSelectedCategoryId((prev) =>
        prev && prev.startsWith(`location:${location.id}`) ? null : prev
      );
    } catch (error: any) {
      console.error('Error deleting location:', error);
      alert(`Ошибка удаления локации: ${error.message}`);
    }
  };

  const isLedScreen = (equipmentItem: EquipmentItem) => {
    const subtype = equipmentItem.subtype || '';
    const name = equipmentItem.name || '';
    const category = equipmentItem.category || '';

    return (subtype.includes('Экран P2,6') || subtype.includes('Экран P3,91') ||
            name.includes('LED') || name.includes('Светодиодный экран')) &&
           category === 'Видео';
  };

  const isStagePodium = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.includes('Сценический подиум') || name.toLowerCase().includes('ступенька');
  };

  const isMonoTotem = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.includes('Монототем');
  };

  const isTotem = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.includes('Тотем') && !name.includes('Монототем');
  };

  const isUShapeConstruction = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.toLowerCase().includes('п-образная конструкция') && !name.toLowerCase().includes('с системой подъема');
  };

  const isUShapeLiftingConstruction = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.toLowerCase().includes('п-образная конструкция с системой подъема');
  };

  const handleEquipmentClick = async (equipmentItem: EquipmentItem) => {
    if (isLedScreen(equipmentItem)) {
      setSelectedLedEquipment(equipmentItem);
      setShowLedSizeDialog(true);
      return;
    }
    if (isStagePodium(equipmentItem)) {
      setSelectedPodiumEquipment(equipmentItem);
      setShowPodiumDialog(true);
      return;
    }
    if (isMonoTotem(equipmentItem)) {
      setSelectedTotemEquipment(equipmentItem);
      setIsMonototem(true);
      setShowTotemDialog(true);
      return;
    }
    if (isTotem(equipmentItem)) {
      setSelectedTotemEquipment(equipmentItem);
      setIsMonototem(false);
      setShowTotemDialog(true);
      return;
    }
    if (isUShapeConstruction(equipmentItem) || isUShapeLiftingConstruction(equipmentItem)) {
      setSelectedUShapeEquipment(equipmentItem);
      setUShapeMode(isUShapeLiftingConstruction(equipmentItem) ? 'lifting' : 'standard');
      setShowUShapeUnifiedDialog(true);
      return;
    }
    const placement = selectedCategoryId ? parseGroupId(selectedCategoryId) : { categoryId: null, locationId: null };
    await handleAddItem(equipmentItem, 1, undefined, placement.categoryId || undefined, undefined, undefined, placement.locationId || undefined);
  };
  const handleLedSizeConfirm = (result: { quantity: number; customName: string; customPrice: number }) => {
    if (!selectedLedEquipment) return;
    handleAddItem(
      selectedLedEquipment,
      result.quantity,
      undefined,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).categoryId : null) || undefined,
      result.customName,
      result.customPrice,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).locationId : null) || undefined
    );
    setShowLedSizeDialog(false);
    setSelectedLedEquipment(null);
  };

  const handlePodiumConfirm = (result: { quantity: number; customName: string; customPrice: number }) => {
    if (!selectedPodiumEquipment) return;
    handleAddItem(
      selectedPodiumEquipment,
      result.quantity,
      undefined,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).categoryId : null) || undefined,
      result.customName,
      result.customPrice,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).locationId : null) || undefined
    );
    setShowPodiumDialog(false);
    setSelectedPodiumEquipment(null);
  };

  const handleTotemConfirm = (result: { quantity: number; customName: string; customPrice?: number }) => {
    if (!selectedTotemEquipment) return;
    handleAddItem(
      selectedTotemEquipment,
      result.quantity,
      undefined,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).categoryId : null) || undefined,
      result.customName,
      result.customPrice,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).locationId : null) || undefined
    );
    setShowTotemDialog(false);
    setSelectedTotemEquipment(null);
  };

  const handleUShapeUnifiedConfirm = (result: { quantity: number; customName: string; customPrice: number }) => {
    if (!selectedUShapeEquipment) return;
    handleAddItem(
      selectedUShapeEquipment,
      result.quantity,
      undefined,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).categoryId : null) || undefined,
      result.customName,
      result.customPrice,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).locationId : null) || undefined
    );
    setShowUShapeUnifiedDialog(false);
    setSelectedUShapeEquipment(null);
  };

  const handleAddItem = async (equipmentItem: EquipmentItem, quantity: number = 1, modificationId?: string, categoryId?: string, customName?: string, customPrice?: number, locationId?: string) => {
    try {
      const selectedPlacement = selectedCategoryId ? parseGroupId(selectedCategoryId) : { categoryId: null, locationId: null };
      const targetCategoryId = categoryId || selectedPlacement.categoryId || undefined;
      const targetLocationId = locationId || selectedPlacement.locationId || undefined;
      const isExtra = isExtraServiceCategory(targetCategoryId);

      const newItem = await createBudgetItem({
        event_id: eventId,
        equipment_id: equipmentItem.id,
        modification_id: modificationId || null,
        item_type: 'equipment',
        quantity,
        price: customPrice !== undefined ? customPrice : equipmentItem.rental_price,
        multi_day_rate_override: equipmentItem.multi_day_rate,
        exchange_rate: exchangeRate,
        category_id: targetCategoryId,
        location_id: targetLocationId,
        notes: customName || '',
        is_extra: isExtra
      });
      const updatedItems = [...budgetItems, newItem];
      setBudgetItems(updatedItems);
      lastAddedItemRef.current = newItem.id;

      if (targetCategoryId || targetLocationId) {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        if (targetCategoryId) {
          newActiveCategoryIds.add(buildCategoryGroupId(targetCategoryId, targetLocationId));
        } else if (targetLocationId) {
          newActiveCategoryIds.add(buildLocationUncategorizedGroupId(targetLocationId));
        }
        setActiveCategoryIds(newActiveCategoryIds);
      }

      if (targetCategoryId) {
        const categoryGroupId = buildCategoryGroupId(targetCategoryId, targetLocationId);
        if (!expandedCategories[categoryGroupId]) {
          setExpandedCategories({ ...expandedCategories, [categoryGroupId]: true, ...(targetLocationId ? { [`location:${targetLocationId}`]: true } : {}) });
        }
      }

      setTimeout(() => {
        if (budgetListRef.current) {
          budgetListRef.current.scrollTop = budgetListRef.current.scrollHeight;
        }
      }, 150);
    } catch (error: any) {
      console.error('Error adding item:', error);
      alert(`Ошибка добавления: ${error.message}`);
    }
  };

  

  

  

  

  

  const handleAddWorkItem = async (workItem: WorkItem, categoryId?: string) => {
    try {
      const selectedPlacement = selectedCategoryId ? parseGroupId(selectedCategoryId) : { categoryId: null, locationId: null };
      const targetCategoryId = categoryId || selectedPlacement.categoryId || undefined;
      const targetLocationId = selectedPlacement.locationId || undefined;
      const isExtra = isExtraServiceCategory(targetCategoryId);

      const newItem = await createBudgetItem({
        event_id: eventId,
        work_item_id: workItem.id,
        item_type: 'work',
        quantity: 1,
        price: 0,
        multi_day_rate_override: 0,
        exchange_rate: exchangeRate,
        category_id: targetCategoryId,
        location_id: targetLocationId,
        notes: '',
        is_extra: isExtra
      });
      const updatedItems = [...budgetItems, newItem];
      setBudgetItems(updatedItems);
      lastAddedItemRef.current = newItem.id;

      if (targetCategoryId) {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(buildCategoryGroupId(targetCategoryId, targetLocationId));
        setActiveCategoryIds(newActiveCategoryIds);
      } else if (targetLocationId) {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(buildLocationUncategorizedGroupId(targetLocationId));
        setActiveCategoryIds(newActiveCategoryIds);
      } else {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(NO_LOCATION_GROUP_ID);
        setActiveCategoryIds(newActiveCategoryIds);

      }

      const targetGroupId = targetCategoryId ? buildCategoryGroupId(targetCategoryId, targetLocationId) : targetLocationId ? buildLocationUncategorizedGroupId(targetLocationId) : null;
      if (targetGroupId && !expandedCategories[targetGroupId]) {
        setExpandedCategories({ ...expandedCategories, [targetGroupId]: true, ...(targetLocationId ? { [`location:${targetLocationId}`]: true } : {}) });
      }

      setTimeout(() => {
        if (budgetListRef.current) {
          budgetListRef.current.scrollTop = budgetListRef.current.scrollHeight;
        }
      }, 150);
    } catch (error: any) {
      console.error('Error adding work item:', error);
      alert(`Ошибка добавления: ${error.message}`);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<BudgetItem>) => {
    try {
      const updatedItem = await updateBudgetItem(itemId, updates);
      setBudgetItems(budgetItems.map(item =>
        item.id === itemId ? { ...item, ...updatedItem } : item
      ));
    } catch (error: any) {
      console.error('Error updating item:', error);
      alert(`Ошибка обновления: ${error.message}`);
    }
  };

  const handleOpenWorkPersonnelManager = (categoryId: string) => {
    setSelectedCategoryForPersonnel(categoryId);
    setWorkPersonnelManagerOpen(true);
  };

  const handleWorkPersonnelSave = async () => {
    await loadData();
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteBudgetItem(itemId);
      setBudgetItems(budgetItems.filter(item => item.id !== itemId));
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const itemsToDelete = budgetItems.filter(item => item.category_id === categoryId);

      for (const item of itemsToDelete) {
        await deleteBudgetItem(item.id);
      }

      // Remove category from local state only - do not delete from database
      setBudgetItems(budgetItems.filter(item => item.category_id !== categoryId));
      setCategories(categories.filter(cat => cat.id !== categoryId));
      setActiveCategoryIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(`category:${categoryId}`);
        return newSet;
      });
      setSelectedCategoryId(prev => prev === `category:${categoryId}` ? null : prev);
    } catch (error: any) {
      console.error('Error deleting category:', error);
      alert(`Ошибка удаления категории: ${error.message}`);
    }
  };

  const handleUpdateCategoryName = async (categoryId: string, newName: string) => {
    try {
      await updateCategory(categoryId, { name: newName });
      setCategories(categories.map(cat =>
        cat.id === categoryId ? { ...cat, name: newName } : cat
      ));
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(`Ошибка обновления категории: ${error.message}`);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save discount settings to event
      await updateEvent(eventId, {
        discount_enabled: discountEnabled,
        discount_percent: discountPercent,
        budget_days: budgetDays,
        budget_totals_mode: budgetTotalsMode
      });

      for (const item of budgetItems) {
        await updateBudgetItem(item.id, { exchange_rate: exchangeRate });
      }

      alert('Смета сохранена успешно');
      onClose();
    } catch (error: any) {
      console.error('Error saving budget:', error);
      alert(`Ошибка сохранения: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setGeneratingPDF(true);
      const event = await getEvent(eventId);

      await generateBudgetPDF({
        eventName: event.event_type,
        eventDate: event.event_date,
        venueName: event.venues?.name,
        clientName: event.clients?.organization,
        organizerName: event.organizers?.full_name,
        budgetItems: budgetItems as any,
        categories: categories,
        locations,
        exchangeRate: exchangeRate,
        paymentMode: paymentMode,
        discountEnabled: discountEnabled,
        discountPercent: discountPercent,
        budgetDays,
        budgetTotalsMode
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      alert(`Ошибка при создании PDF: ${error.message}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: 'category' | 'item', id: string) => {
    setDraggedItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, target: BudgetDragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (target.type === 'location') {
      setDragOverTarget(`location:${target.id}`);
    } else if (target.type === 'category') {
      setDragOverTarget(target.id);
    } else {
      setDragOverTarget(NO_LOCATION_GROUP_ID);
    }
    setDragOverItemId(null);
  };

  const handleDrop = async (e: React.DragEvent, target: BudgetDragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setDragOverItemId(null);

    if (!draggedItem) return;

    const targetGroupId = target.type === 'location'
      ? `location:${target.id}`
      : target.type === 'category'
        ? target.id
        : NO_LOCATION_GROUP_ID;

    if (draggedItem.type === 'item') {
      const { categoryId, locationId } = parseGroupId(targetGroupId);
      const targetGroupItems = budgetItems
        .filter((item) => {
          const groupId = item.category_id
            ? buildCategoryGroupId(item.category_id, item.location_id)
            : item.location_id
              ? buildLocationUncategorizedGroupId(item.location_id)
              : NO_LOCATION_GROUP_ID;
          return groupId === targetGroupId && item.id !== draggedItem.id;
        })
        .sort((a, b) => a.sort_order - b.sort_order);
      const nextSortOrder = targetGroupItems.length;

      await handleUpdateItem(draggedItem.id, {
        category_id: categoryId,
        location_id: locationId,
        sort_order: nextSortOrder,
        is_extra: isExtraServiceCategory(categoryId)
      });
    } else if (draggedItem.type === 'category') {
      const sourceGroup = parseGroupId(draggedItem.id);
      const destinationGroup = parseGroupId(targetGroupId);
      if (!sourceGroup.categoryId) {
        setDraggedItem(null);
        return;
      }

      if (target.type === 'category' && destinationGroup.categoryId) {
        if (sourceGroup.categoryId === destinationGroup.categoryId) {
          setDraggedItem(null);
          return;
        }

        const sourceIndex = categories.findIndex((category) => category.id === sourceGroup.categoryId);
        const targetIndex = categories.findIndex((category) => category.id === destinationGroup.categoryId);

        if (sourceIndex === -1 || targetIndex === -1) {
          setDraggedItem(null);
          return;
        }

        const reorderedCategories = [...categories];
        const [movedCategory] = reorderedCategories.splice(sourceIndex, 1);
        reorderedCategories.splice(targetIndex, 0, movedCategory);

        for (let index = 0; index < reorderedCategories.length; index += 1) {
          const category = reorderedCategories[index];
          if (category.sort_order !== index) {
            await updateCategory(category.id, { sort_order: index });
          }
        }

        setCategories(
          reorderedCategories.map((category, index) => ({
            ...category,
            sort_order: index
          }))
        );
        setDraggedItem(null);
        return;
      }

      const itemsToMove = budgetItems.filter((item) =>
        item.category_id === sourceGroup.categoryId &&
        (item.location_id || null) === (sourceGroup.locationId || null)
      );

      for (const item of itemsToMove) {
        await updateBudgetItem(item.id, {
          location_id: destinationGroup.locationId,
          category_id: sourceGroup.categoryId
        });
      }

      setBudgetItems((prev) => prev.map((item) => {
        if (
          item.category_id === sourceGroup.categoryId &&
          (item.location_id || null) === (sourceGroup.locationId || null)
        ) {
          return { ...item, location_id: destinationGroup.locationId };
        }
        return item;
      }));

      setActiveCategoryIds((prev) => {
        const next = new Set(prev);
        next.delete(buildCategoryGroupId(sourceGroup.categoryId!, sourceGroup.locationId));
        next.add(buildCategoryGroupId(sourceGroup.categoryId!, destinationGroup.locationId));
        return next;
      });
    }

    setDraggedItem(null);
  };

  const handleDragOverItem = (_e: React.DragEvent, itemId: string) => {
    if (draggedItem?.type === 'item') {
      setDragOverItemId(itemId);
    }
  };

  const handleDropOnItem = async (_e: React.DragEvent, targetItemId: string) => {
    _e.preventDefault();
    _e.stopPropagation();
    setDragOverItemId(null);

    if (!draggedItem || draggedItem.type !== 'item') return;

    const sourceItemId = draggedItem.id;
    if (sourceItemId === targetItemId) return;

    const sourceItem = budgetItems.find(item => item.id === sourceItemId);
    const targetItem = budgetItems.find(item => item.id === targetItemId);

    if (!sourceItem || !targetItem) return;

    const sourceGroupId = sourceItem.category_id
      ? buildCategoryGroupId(sourceItem.category_id, sourceItem.location_id)
      : sourceItem.location_id
        ? buildLocationUncategorizedGroupId(sourceItem.location_id)
        : NO_LOCATION_GROUP_ID;
    const targetGroupId = targetItem.category_id
      ? buildCategoryGroupId(targetItem.category_id, targetItem.location_id)
      : targetItem.location_id
        ? buildLocationUncategorizedGroupId(targetItem.location_id)
        : NO_LOCATION_GROUP_ID;

    // Create a working copy with the source item moved to the target category if needed
    let workingItems = [...budgetItems];
    if (sourceGroupId !== targetGroupId) {
      await updateBudgetItem(sourceItemId, {
        category_id: targetItem.category_id || null,
        location_id: targetItem.location_id || null,
        is_extra: isExtraServiceCategory(targetItem.category_id || null)
      });
      workingItems = budgetItems.map(item =>
        item.id === sourceItemId
          ? {
              ...item,
              category_id: targetItem.category_id || null,
              location_id: targetItem.location_id || null,
              is_extra: isExtraServiceCategory(targetItem.category_id || null)
            }
          : item
      );
    }

    const categoryItems = workingItems
      .filter(item => {
        const groupId = item.category_id
          ? buildCategoryGroupId(item.category_id, item.location_id)
          : item.location_id
            ? buildLocationUncategorizedGroupId(item.location_id)
            : NO_LOCATION_GROUP_ID;
        return groupId === targetGroupId;
      })
      .sort((a, b) => a.sort_order - b.sort_order);

    const sourceIndex = categoryItems.findIndex(item => item.id === sourceItemId);
    const targetIndex = categoryItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
      const newOrder = [...categoryItems];
      const [movedItem] = newOrder.splice(sourceIndex, 1);
      const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newOrder.splice(insertIndex, 0, movedItem);

      for (let i = 0; i < newOrder.length; i++) {
        await updateBudgetItem(newOrder[i].id, { sort_order: i });
      }

      // Build the final array with items in correct order
      const otherCategoryItems = workingItems.filter(
        item => {
          const groupId = item.category_id
            ? buildCategoryGroupId(item.category_id, item.location_id)
            : item.location_id
              ? buildLocationUncategorizedGroupId(item.location_id)
              : NO_LOCATION_GROUP_ID;
          return groupId !== targetGroupId;
        }
      );
      const reorderedItems = otherCategoryItems.concat(newOrder);
      setBudgetItems(reorderedItems);
    }

    setDraggedItem(null);
  };

  const isDeliveryWork = (item: BudgetItem): boolean => {
    if (item.item_type !== 'work') return false;
    const workName = item.work_item?.name?.toLowerCase() || '';
    return workName.includes('доставка оборудования') || workName.includes('доставка тех. персонала');
  };

  const calculateBYNCash = (amountUSD: number): number => {
    const baseAmount = amountUSD * exchangeRate;
    return Math.round(baseAmount / 5) * 5;
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

  const equipmentCategories = ['Все', ...Array.from(new Set(equipment.map(item => item.category)))];

  const filteredEquipment = equipment.filter(item => {
    const hasPrice = item.rental_price > 0;
    const matchesSearch = !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedEquipmentCategory === 'Все' || item.category === selectedEquipmentCategory;
    return hasPrice && matchesSearch && matchesCategory;
  });

  const filteredWorkItems = workItems.filter(item =>
    !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems: GroupedItemsByLocation = budgetItems.reduce((acc, item) => {
    const groupId = item.category_id
      ? buildCategoryGroupId(item.category_id, item.location_id)
      : item.location_id
        ? buildLocationUncategorizedGroupId(item.location_id)
        : NO_LOCATION_GROUP_ID;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(item);
    return acc;
  }, {} as GroupedItemsByLocation);

  const mainBudgetItems = budgetItems.filter((item) => !item.is_extra);
  const nonWorkItems = mainBudgetItems.filter(item => item.item_type !== 'work');
  const workItems2 = mainBudgetItems.filter(item => item.item_type === 'work');
  const mainTotalsUSD = calcGrandTotals(mainBudgetItems, budgetDays, budgetTotalsMode);
  const nonWorkTotalsUSD = calcGrandTotals(nonWorkItems, budgetDays, budgetTotalsMode);
  const workTotalsUSD = calcGrandTotals(workItems2, budgetDays, budgetTotalsMode);

  const totalDay1BYNCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNCash(item.price * item.quantity), 0);
  const totalCombinedBYNCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNCash(calcCombinedTotal(item, budgetDays)), 0);
  const totalDay1BYNNonCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNNonCash(item.price * item.quantity, item), 0);
  const totalCombinedBYNNonCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNNonCash(calcCombinedTotal(item, budgetDays), item), 0);

  const nonWorkTotalBYNCashForMode = nonWorkItems.reduce((sum, item) => {
    const usdAmount = budgetTotalsMode === 'combined_only' ? calcCombinedTotal(item, budgetDays) : item.price * item.quantity;
    return sum + calculateBYNCash(usdAmount);
  }, 0);
  const nonWorkTotalBYNNonCashForMode = nonWorkItems.reduce((sum, item) => {
    const usdAmount = budgetTotalsMode === 'combined_only' ? calcCombinedTotal(item, budgetDays) : item.price * item.quantity;
    return sum + calculateBYNNonCash(usdAmount, item);
  }, 0);
  const workTotalBYNCashForMode = workItems2.reduce((sum, item) => {
    const usdAmount = budgetTotalsMode === 'combined_only' ? calcCombinedTotal(item, budgetDays) : item.price * item.quantity;
    return sum + calculateBYNCash(usdAmount);
  }, 0);
  const workTotalBYNNonCashForMode = workItems2.reduce((sum, item) => {
    const usdAmount = budgetTotalsMode === 'combined_only' ? calcCombinedTotal(item, budgetDays) : item.price * item.quantity;
    return sum + calculateBYNNonCash(usdAmount, item);
  }, 0);

  const getDiscountedTotal = () => {
    if (!discountEnabled || discountPercent <= 0) return null;
    const multiplier = 1 - discountPercent / 100;
    let raw: number;
    switch (paymentMode) {
      case 'byn_cash': raw = nonWorkTotalBYNCashForMode * multiplier + workTotalBYNCashForMode; break;
      case 'byn_noncash': raw = nonWorkTotalBYNNonCashForMode * multiplier + workTotalBYNNonCashForMode; break;
      default: raw = nonWorkTotalsUSD.totalForMode * multiplier + workTotalsUSD.totalForMode; break;
    }
    return Math.round(raw / 5) * 5;
  };

  const getDay1TotalForPaymentMode = () => {
    switch (paymentMode) {
      case 'byn_cash': return totalDay1BYNCash;
      case 'byn_noncash': return totalDay1BYNNonCash;
      default: return mainTotalsUSD.day1Total;
    }
  };

  const getCombinedTotalForPaymentMode = () => {
    switch (paymentMode) {
      case 'byn_cash': return totalCombinedBYNCash;
      case 'byn_noncash': return totalCombinedBYNNonCash;
      default: return mainTotalsUSD.combinedTotal;
    }
  };

  const getPrimaryTotalForMode = () => {
    if (budgetTotalsMode === 'combined_only') {
      return getCombinedTotalForPaymentMode();
    }
    return getDay1TotalForPaymentMode();
  };

  const getCurrencyLabel = () => {
    switch (paymentMode) {
      case 'byn_cash': return 'BYN';
      case 'byn_noncash': return 'BYN';
      default: return 'USD';
    }
  };

  const handleLocationDragStart = (e: React.DragEvent, locationId: string) => {
    e.stopPropagation();
    setDraggedLocationId(locationId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', locationId);
  };

  const handleLocationDragOver = (e: React.DragEvent, locationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedLocationId && draggedLocationId !== locationId) {
      setLocationDragOverId(locationId);
    }
  };

  const handleLocationDrop = async (e: React.DragEvent, targetLocationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLocationDragOverId(null);

    if (!draggedLocationId || draggedLocationId === targetLocationId) {
      setDraggedLocationId(null);
      return;
    }

    const sourceIndex = locations.findIndex((location) => location.id === draggedLocationId);
    const targetIndex = locations.findIndex((location) => location.id === targetLocationId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedLocationId(null);
      return;
    }

    const reordered = [...locations];
    const [movedLocation] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedLocation);

    try {
      for (let index = 0; index < reordered.length; index += 1) {
        if (reordered[index].sort_order !== index) {
          await updateLocation(reordered[index].id, { sort_order: index });
        }
      }
      setLocations(reordered.map((location, index) => ({ ...location, sort_order: index })));
    } catch (error) {
      console.error('Error reordering locations:', error);
      alert('Ошибка изменения порядка локаций');
    } finally {
      setDraggedLocationId(null);
    }
  };

  

  

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-gray-900 p-8 rounded-lg">
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

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
        /* Для Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #374151 #111827;
        }
      `}</style>

      <div className="bg-gray-900 rounded-xl w-full max-w-[1600px] h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-800">
        {/* Header */}
        <div className="px-4 py-2 border-b border-gray-800 flex justify-between items-center flex-shrink-0 bg-gray-900/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Смета: {eventName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left column */}
          <div className="w-3/5 flex flex-col border-r border-gray-800 min-w-0">
            {/* Toolbar */}
            <div className="bg-gray-900/80 border-b border-gray-800 px-3 py-2 flex-shrink-0">
              <div className="flex items-center justify-between relative category-dropdown-container">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-cyan-900/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить категорию
                  </button>
                  <button
                    onClick={() => setShowLocationDialog(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Добавить локацию
                  </button>
                  <button
                    onClick={handleCreateExtraServiceCategory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-all shadow-lg shadow-violet-900/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Доп услуги
                  </button>

                  <button
                    onClick={() => setShowTemplates(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-all border border-gray-700"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Шаблоны
                  </button>
                </div>

                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar p-0.5">
                    {globalCategories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => handleSelectCategory(category)}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-lg"
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative exchange-rate-container">
                  <button
                    onClick={() => setShowExchangeRatePopover(!showExchangeRatePopover)}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-all"
                  >
                    <Settings className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-medium">{getCurrencyLabel()}</span>
                    <span className="text-[10px] text-gray-500 font-mono">({exchangeRate.toFixed(2)})</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExchangeRatePopover ? 'rotate-180' : ''}`} />
                  </button>

                  {showExchangeRatePopover && (
                    <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 p-3 min-w-[200px]">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Курс валюты</label>
                          <input
                            type="number"
                            step="0.01"
                            value={exchangeRate}
                            onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                            className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Система расчёта</label>
                          <button
                            onClick={() => setPaymentMode('usd')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              paymentMode === 'usd'
                                ? 'bg-cyan-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            USD
                          </button>
                          <button
                            onClick={() => setPaymentMode('byn_noncash')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              paymentMode === 'byn_noncash'
                                ? 'bg-cyan-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            BYN (безналичный)
                          </button>
                          <button
                            onClick={() => setPaymentMode('byn_cash')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                              paymentMode === 'byn_cash'
                                ? 'bg-cyan-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            BYN (наличный)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Budget list */}
            <div
              ref={budgetListRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 custom-scrollbar"
            >
              {budgetItems.length === 0 && activeCategoryIds.size === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                  <Package className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Смета пуста. Начните с добавления категорий или оборудования.</p>
                </div>
              ) : (
                <>
                  {locations.map((location) => {
                    const locationGroupId = `location:${location.id}`;
                    const locationHasContent = categories.some((category) => {
                      const categoryGroupId = buildCategoryGroupId(category.id, location.id);
                      return (groupedItems[categoryGroupId]?.length || 0) > 0 || activeCategoryIds.has(categoryGroupId);
                    }) || (groupedItems[buildLocationUncategorizedGroupId(location.id)]?.length || 0) > 0;

                    if (!locationHasContent && !activeCategoryIds.has(locationGroupId)) return null;

                    return (
                      <div
                        key={location.id}
                        className={`transition-all duration-200 rounded-xl border border-emerald-900/30 ${dragOverTarget === locationGroupId ? 'ring-2 ring-emerald-500 bg-emerald-500/5 p-0.5' : ''} ${locationDragOverId === location.id ? 'ring-2 ring-cyan-400' : ''}`}
                        onDragOver={(e) => handleDragOver(e, { type: 'location', id: location.id, locationId: location.id })}
                        onDrop={(e) => handleDrop(e, { type: 'location', id: location.id, locationId: location.id })}
                      >
                        <div
                          className="w-full px-3 py-2 text-xs font-semibold text-white flex items-center justify-between gap-2"
                          style={{ backgroundColor: location.color || '#14532d' }}
                          onDragOver={(e) => {
                            if (!draggedLocationId) return;
                            handleLocationDragOver(e, location.id);
                          }}
                          onDrop={(e) => {
                            if (!draggedLocationId) return;
                            handleLocationDrop(e, location.id);
                          }}
                        >
                          <button
                            type="button"
                            className="flex-1 flex items-center gap-2 text-left"
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [locationGroupId]: !prev[locationGroupId] }))}
                          >
                            <div
                              draggable
                              onDragStart={(e) => handleLocationDragStart(e, location.id)}
                              onDragOver={(e) => handleLocationDragOver(e, location.id)}
                              onDrop={(e) => handleLocationDrop(e, location.id)}
                              className="text-white/70 hover:text-white cursor-move"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                            {(expandedCategories[locationGroupId] ?? true) ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{location.name}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Переименовать локацию"
                              className="p-1 rounded hover:bg-black/20"
                              onClick={() => handleUpdateLocation(location)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Удалить локацию"
                              className="p-1 rounded hover:bg-black/20"
                              onClick={() => handleDeleteLocation(location)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {(expandedCategories[locationGroupId] ?? true) && (
                          <div className="pl-2 border-l border-emerald-900/30">
                            {categories.filter(cat => cat.is_template !== true).map((category) => {
                              const categoryGroupId = buildCategoryGroupId(category.id, location.id);
                              const categoryItems = groupedItems[categoryGroupId] || [];
                              if (categoryItems.length === 0 && !activeCategoryIds.has(categoryGroupId)) return null;

                              return (
                                <div
                                  key={categoryGroupId}
                                  className={`transition-all duration-200 ${dragOverTarget === categoryGroupId ? 'ring-2 ring-cyan-500 bg-cyan-500/5 rounded-xl p-0.5' : ''}`}
                                >
                                  <CategoryBlock
                                    categoryId={categoryGroupId}
                                    categoryName={category.name}
                                    locationId={location.id}
                                    items={categoryItems}
                                    isExpanded={expandedCategories[categoryGroupId] || false}
                                    isSelected={selectedCategoryId === categoryGroupId}
                                    onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [categoryGroupId]: !prev[categoryGroupId] }))}
                                    onSelect={() => setSelectedCategoryId(selectedCategoryId === categoryGroupId ? null : categoryGroupId)}
                                    onUpdateCategoryName={(name) => handleUpdateCategoryName(category.id, name)}
                                    onUpdateItem={handleUpdateItem}
                                    onDeleteItem={handleDeleteItem}
                                    onDeleteCategory={() => handleDeleteCategory(category.id)}
                                    onManagePersonnel={handleOpenWorkPersonnelManager}
                                    paymentMode={paymentMode}
                                    exchangeRate={exchangeRate}
                                    budgetDays={budgetDays}
                                    budgetTotalsMode={budgetTotalsMode}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onDragOverItem={handleDragOverItem}
                                    onDropOnItem={handleDropOnItem}
                                    dragOverItemId={dragOverItemId}
                                  />
                                </div>
                              );
                            })}

                            {(groupedItems[buildLocationUncategorizedGroupId(location.id)] || []).length > 0 && (
                              <CategoryBlock
                                categoryId={buildLocationUncategorizedGroupId(location.id)}
                                categoryName="Без категории"
                                locationId={location.id}
                                items={groupedItems[buildLocationUncategorizedGroupId(location.id)] || []}
                                isExpanded={expandedCategories[buildLocationUncategorizedGroupId(location.id)] || false}
                                isSelected={selectedCategoryId === buildLocationUncategorizedGroupId(location.id)}
                                onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [buildLocationUncategorizedGroupId(location.id)]: !prev[buildLocationUncategorizedGroupId(location.id)] }))}
                                onSelect={() => setSelectedCategoryId(selectedCategoryId === buildLocationUncategorizedGroupId(location.id) ? null : buildLocationUncategorizedGroupId(location.id))}
                                onUpdateCategoryName={() => {}}
                                onUpdateItem={handleUpdateItem}
                                onDeleteItem={handleDeleteItem}
                                paymentMode={paymentMode}
                                exchangeRate={exchangeRate}
                                budgetDays={budgetDays}
                                budgetTotalsMode={budgetTotalsMode}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragOverItem={handleDragOverItem}
                                onDropOnItem={handleDropOnItem}
                                dragOverItemId={dragOverItemId}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {categories.filter(cat => cat.is_template !== true).map(category => {
                    const categoryGroupId = buildCategoryGroupId(category.id, null);
                    const categoryItems = groupedItems[categoryGroupId] || [];
                    if (categoryItems.length === 0 && !activeCategoryIds.has(categoryGroupId)) return null;

                    return (
                      <div
                        key={categoryGroupId}
                        className={`transition-all duration-200 ${dragOverTarget === categoryGroupId ? 'ring-2 ring-cyan-500 bg-cyan-500/5 rounded-xl p-0.5' : ''}`}
                      >
                        <CategoryBlock
                          categoryId={categoryGroupId}
                          categoryName={category.name}
                          items={categoryItems}
                          isExpanded={expandedCategories[categoryGroupId] || false}
                          isSelected={selectedCategoryId === categoryGroupId}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [categoryGroupId]: !prev[categoryGroupId] }))}
                          onSelect={() => setSelectedCategoryId(selectedCategoryId === categoryGroupId ? null : categoryGroupId)}
                          onUpdateCategoryName={(name) => handleUpdateCategoryName(category.id, name)}
                          onUpdateItem={handleUpdateItem}
                          onDeleteItem={handleDeleteItem}
                          onDeleteCategory={() => handleDeleteCategory(category.id)}
                          onManagePersonnel={handleOpenWorkPersonnelManager}
                          paymentMode={paymentMode}
                          exchangeRate={exchangeRate}
                          budgetDays={budgetDays}
                          budgetTotalsMode={budgetTotalsMode}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragOverItem={handleDragOverItem}
                          onDropOnItem={handleDropOnItem}
                          dragOverItemId={dragOverItemId}
                          categoryRef={(el) => { categoryRefs.current[category.id] = el; }}
                        />
                      </div>
                    );
                  })}
                  {groupedItems[NO_LOCATION_GROUP_ID] && groupedItems[NO_LOCATION_GROUP_ID].length > 0 && (
                    <div
                      className={`transition-all duration-200 ${dragOverTarget === NO_LOCATION_GROUP_ID ? 'ring-2 ring-cyan-500 bg-cyan-500/5 rounded-xl p-0.5' : ''}`}
                    >
                      <CategoryBlock
                        categoryId={NO_LOCATION_GROUP_ID}
                        categoryName="Без локации / категории"
                        items={groupedItems[NO_LOCATION_GROUP_ID]}
                        isExpanded={expandedCategories[NO_LOCATION_GROUP_ID] || false}
                        isSelected={selectedCategoryId === NO_LOCATION_GROUP_ID}
                        onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [NO_LOCATION_GROUP_ID]: !prev[NO_LOCATION_GROUP_ID] }))}
                        onSelect={() => setSelectedCategoryId(selectedCategoryId === NO_LOCATION_GROUP_ID ? null : NO_LOCATION_GROUP_ID)}
                        onUpdateCategoryName={() => {}}
                        onUpdateItem={handleUpdateItem}
                        onDeleteItem={handleDeleteItem}
                        onDeleteCategory={handleDeleteCategory}
                        onManagePersonnel={handleOpenWorkPersonnelManager}
                        paymentMode={paymentMode}
                        exchangeRate={exchangeRate}
                        budgetDays={budgetDays}
                        budgetTotalsMode={budgetTotalsMode}
                        onDragStart={handleDragStart}
                        onDragOver={(e) => handleDragOver(e, { type: 'uncategorized', id: NO_LOCATION_GROUP_ID, locationId: null })}
                        onDrop={(e) => handleDrop(e, { type: 'uncategorized', id: NO_LOCATION_GROUP_ID, locationId: null })}
                        onDragOverItem={handleDragOverItem}
                        onDropOnItem={handleDropOnItem}
                        dragOverItemId={dragOverItemId}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="w-2/5 flex flex-col bg-gray-900/30 min-w-0">
            <div className="p-3 border-b border-gray-800 space-y-2 flex-shrink-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по названию или категории..."
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
              />
              <div className="flex bg-gray-800 p-0.5 rounded-lg">
                <button
                  onClick={() => setSelectedItemType('Оборудование')}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${selectedItemType === 'Оборудование' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Оборудование
                </button>
                <button
                  onClick={() => setSelectedItemType('Работа')}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${selectedItemType === 'Работа' ? 'bg-gray-700 text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Работа / Персонал
                </button>
              </div>
              {selectedItemType === 'Оборудование' && (
                <select
                  value={selectedEquipmentCategory}
                  onChange={(e) => setSelectedEquipmentCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-[10px] text-gray-300 focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  {equipmentCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
              {selectedItemType === 'Оборудование' ? (
                <div className="divide-y divide-gray-800">
                  {filteredEquipment.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleEquipmentClick(item)}
                      className="group flex items-center justify-between px-3 py-2 hover:bg-cyan-500/5 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white">{item.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <div className="text-right">
                          <p className="text-xs font-mono text-cyan-500 font-bold">${item.rental_price}</p>
                        </div>
                        <div className="p-1 bg-gray-800 rounded-md group-hover:bg-cyan-600 group-hover:text-white text-gray-500 transition-all">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {filteredWorkItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleAddWorkItem(item)}
                      className="group flex items-center justify-between px-3 py-2 hover:bg-cyan-500/5 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white">{item.name}</p>
                        <p className="text-[10px] text-gray-500">Ед. измерения: {item.unit}</p>
                      </div>
                      <div className="p-1 bg-gray-800 rounded-md group-hover:bg-cyan-600 group-hover:text-white text-gray-500 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Итоговая сумма</span>
              <span className="text-xl font-black text-white">
                <span className="text-cyan-400">{getPrimaryTotalForMode().toLocaleString()}</span>
                <span className="text-xs font-normal text-gray-400 ml-1">{getCurrencyLabel()}</span>
              </span>
              {budgetTotalsMode === 'day1_plus_combined' && (
                <span className="text-[11px] text-gray-400">
                  Итого за 1 день: <span className="text-cyan-300">{getDay1TotalForPaymentMode().toLocaleString()}</span> {getCurrencyLabel()}
                </span>
              )}
              <span className="text-[11px] text-gray-400">
                Итого за {budgetDays} {budgetDays === 1 ? 'день' : 'дней'}: <span className="text-cyan-300">{getCombinedTotalForPaymentMode().toLocaleString()}</span> {getCurrencyLabel()}
              </span>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={discountEnabled}
                    onChange={(e) => setDiscountEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-300 font-medium">Скидка</span>
                  {discountEnabled && (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={discountPercentInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setDiscountPercentInput(raw);
                          const parsed = parseFloat(raw);
                          if (!isNaN(parsed)) {
                            setDiscountPercent(Math.min(100, Math.max(0, parsed)));
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseFloat(discountPercentInput);
                          if (isNaN(parsed) || discountPercentInput.trim() === '') {
                            setDiscountPercent(0);
                            setDiscountPercentInput('0');
                          } else {
                            const clamped = Math.min(100, Math.max(0, parsed));
                            setDiscountPercent(clamped);
                            setDiscountPercentInput(String(clamped));
                          }
                        }}
                        className="w-14 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none text-center"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                  )}
                </label>
                {discountEnabled && getDiscountedTotal() !== null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Итого со скидкой {discountPercent}%</span>
                    <span className="text-lg font-black text-white">
                      <span className="text-green-400">{Math.round(getDiscountedTotal()!).toLocaleString()}</span>
                      <span className="text-xs font-normal text-gray-400 ml-1">{getCurrencyLabel()}</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 font-medium">Дней</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={budgetDaysInput}
                    onChange={(e) => {
                      setBudgetDaysInput(e.target.value);
                    }}
                    onBlur={() => {
                      const nextValue = parseInt(budgetDaysInput, 10);
                      if (isNaN(nextValue)) {
                        setBudgetDays(1);
                        setBudgetDaysInput('1');
                        return;
                      }
                      const clamped = Math.max(1, nextValue);
                      setBudgetDays(clamped);
                      setBudgetDaysInput(String(clamped));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    className="w-16 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none text-center"
                  />
                </div>
                {budgetDays > 1 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-300 font-medium">Режим итогов</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name={`budget-totals-mode-${eventId}`}
                        checked={budgetTotalsMode === 'combined_only'}
                        onChange={() => setBudgetTotalsMode('combined_only')}
                        className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-gray-300">Только общий за N дней</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name={`budget-totals-mode-${eventId}`}
                        checked={budgetTotalsMode === 'day1_plus_combined'}
                        onChange={() => setBudgetTotalsMode('day1_plus_combined')}
                        className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-gray-300">Итог за 1 день + итог за N дней</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={generatingPDF || budgetItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all disabled:opacity-30 border border-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">PDF</span>
            </button>
            <button
              onClick={() => setShowWarehouseSpec(true)}
              disabled={budgetItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all disabled:opacity-30 border border-gray-700"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Спецификация</span>
            </button>
            <div className="w-px h-6 bg-gray-800 mx-1"></div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-green-900/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Сохранение...' : 'Завершить'}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {workPersonnelManagerOpen && selectedCategoryForPersonnel && (
        <WorkPersonnelManager
          workItems={budgetItems.filter((item) => {
            if (item.item_type !== 'work') return false;
            const parsed = parseGroupId(selectedCategoryForPersonnel);
            if (selectedCategoryForPersonnel === NO_LOCATION_GROUP_ID) return !item.category_id && !item.location_id;
            return (item.category_id || null) === parsed.categoryId && (item.location_id || null) === parsed.locationId;
          })}
          onClose={() => { setWorkPersonnelManagerOpen(false); setSelectedCategoryForPersonnel(null); }}
          onSave={handleWorkPersonnelSave}
          paymentMode={paymentMode}
          exchangeRate={exchangeRate}
        />
      )}

      {showTemplates && (
        <TemplatesInBudget
          eventId={eventId}
          onClose={() => setShowTemplates(false)}
          onApply={() => { setShowTemplates(false); loadData(); }}
        />
      )}

      {showWarehouseSpec && (
        <WarehouseSpecification
          eventId={eventId}
          eventName={eventName}
          onClose={() => setShowWarehouseSpec(false)}
        />
      )}

      <AddLocationDialog
        isOpen={showLocationDialog}
        existingNames={locations.map((location) => location.name)}
        onClose={() => setShowLocationDialog(false)}
        onConfirm={handleCreateLocation}
      />

      {showLedSizeDialog && selectedLedEquipment && (
        <LedSizeDialog
          equipment={selectedLedEquipment}
          isOpen={showLedSizeDialog}
          onClose={() => {
            setShowLedSizeDialog(false);
            setSelectedLedEquipment(null);
          }}
          onConfirm={handleLedSizeConfirm}
        />
      )}

      {showPodiumDialog && selectedPodiumEquipment && (
        <PodiumDialog
          equipment={selectedPodiumEquipment}
          isOpen={showPodiumDialog}
          onClose={() => {
            setShowPodiumDialog(false);
            setSelectedPodiumEquipment(null);
          }}
          onConfirm={handlePodiumConfirm}
        />
      )}
      {showTotemDialog && selectedTotemEquipment && (
        <TotemDialog
          equipment={selectedTotemEquipment}
          isOpen={showTotemDialog}
          onClose={() => {
            setShowTotemDialog(false);
            setSelectedTotemEquipment(null);
          }}
          onConfirm={handleTotemConfirm}
          isMonototem={isMonototem}
        />
      )}

      {showUShapeUnifiedDialog && selectedUShapeEquipment && (
        <UShapeUnifiedDialog
          equipment={selectedUShapeEquipment}
          isOpen={showUShapeUnifiedDialog}
          onClose={() => {
            setShowUShapeUnifiedDialog(false);
            setSelectedUShapeEquipment(null);
          }}
          onConfirm={handleUShapeUnifiedConfirm}
          initialMode={uShapeMode}
        />
      )}
    </div>
  );
}
