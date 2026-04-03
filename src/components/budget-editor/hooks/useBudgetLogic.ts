import { useEffect, useMemo, useRef, useState } from 'react';
import { BudgetItem, getBudgetItems, createBudgetItem, updateBudgetItem, deleteBudgetItem, getEvent, updateEvent } from '../../../lib/events';
import { EquipmentItem, getEquipmentItems } from '../../../lib/equipment';
import { WorkItem, getWorkItems } from '../../../lib/personnel';
import { Category, createCategory, getCategories, getCategoriesForEvent, updateCategory } from '../../../lib/categories';
import { Location, createLocation, getLocationsForEvent, updateLocation, deleteLocation } from '../../../lib/locations';
import { type BudgetDragTarget } from '../../CategoryBlock';
import { generateBudgetPDF } from '../../../lib/pdfGenerator';
import {
  buildCategoryGroupId,
  buildLocationUncategorizedGroupId,
  EXTRA_SERVICE_DESCRIPTION_FLAG,
  NO_LOCATION_GROUP_ID,
  parseGroupId
} from '../constants';

interface UseBudgetLogicProps {
  eventId: string;
  eventName: string;
  onClose: () => void;
}

interface GroupedItemsByLocation {
  [locationCategoryKey: string]: BudgetItem[];
}

export function useBudgetLogic({ eventId, eventName, onClose }: UseBudgetLogicProps) {
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

      if (eventData.discount_enabled !== undefined) {
        setDiscountEnabled(eventData.discount_enabled);
      }
      if (eventData.discount_percent !== undefined) {
        setDiscountPercent(eventData.discount_percent);
        setDiscountPercentInput(eventData.discount_percent.toString());
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
    const baseName = 'Дополнительные услуги';
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
      alert('Ошибка создания категории "Дополнительные услуги"');
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

      await updateEvent(eventId, {
        discount_enabled: discountEnabled,
        discount_percent: discountPercent
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
        eventName: event.event_type || eventName,
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
        discountPercent: discountPercent
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

  const calculateBYNCash = (priceUSD: number, quantity: number): number => {
    const baseAmount = priceUSD * exchangeRate * quantity;
    return Math.round(baseAmount / 5) * 5;
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

  const equipmentCategories = useMemo(
    () => ['Все', ...Array.from(new Set(equipment.map(item => item.category)))],
    [equipment]
  );

  const filteredEquipment = useMemo(
    () => equipment.filter(item => {
      const hasPrice = item.rental_price > 0;
      const matchesSearch = !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedEquipmentCategory === 'Все' || item.category === selectedEquipmentCategory;
      return hasPrice && matchesSearch && matchesCategory;
    }),
    [equipment, searchTerm, selectedEquipmentCategory]
  );

  const filteredWorkItems = useMemo(
    () => workItems.filter(item =>
      !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [workItems, searchTerm]
  );

  const groupedItems: GroupedItemsByLocation = useMemo(() => budgetItems.reduce((acc, item) => {
    const groupId = item.category_id
      ? buildCategoryGroupId(item.category_id, item.location_id)
      : item.location_id
        ? buildLocationUncategorizedGroupId(item.location_id)
        : NO_LOCATION_GROUP_ID;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(item);
    return acc;
  }, {} as GroupedItemsByLocation), [budgetItems]);

  const mainBudgetItems = useMemo(() => budgetItems.filter((item) => !item.is_extra), [budgetItems]);
  const totalUSD = mainBudgetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBYNCash = mainBudgetItems.reduce((sum, item) =>
    sum + calculateBYNCash(item.price, item.quantity), 0
  );
  const totalBYNNonCash = mainBudgetItems.reduce((sum, item) =>
    sum + calculateBYNNonCash(item.price, item.quantity, item), 0
  );

  const nonWorkItems = mainBudgetItems.filter(item => item.item_type !== 'work');
  const workItems2 = mainBudgetItems.filter(item => item.item_type === 'work');

  const nonWorkTotalUSD = nonWorkItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const nonWorkTotalBYNCash = nonWorkItems.reduce((sum, item) => sum + calculateBYNCash(item.price, item.quantity), 0);
  const nonWorkTotalBYNNonCash = nonWorkItems.reduce((sum, item) => sum + calculateBYNNonCash(item.price, item.quantity, item), 0);

  const workTotalUSD = workItems2.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const workTotalBYNCash = workItems2.reduce((sum, item) => sum + calculateBYNCash(item.price, item.quantity), 0);
  const workTotalBYNNonCash = workItems2.reduce((sum, item) => sum + calculateBYNNonCash(item.price, item.quantity, item), 0);

  const getDiscountedTotal = () => {
    if (!discountEnabled || discountPercent <= 0) return null;
    const multiplier = 1 - discountPercent / 100;
    let raw: number;
    switch (paymentMode) {
      case 'byn_cash': raw = nonWorkTotalBYNCash * multiplier + workTotalBYNCash; break;
      case 'byn_noncash': raw = nonWorkTotalBYNNonCash * multiplier + workTotalBYNNonCash; break;
      default: raw = nonWorkTotalUSD * multiplier + workTotalUSD; break;
    }
    return Math.round(raw / 5) * 5;
  };

  const getTotalForMode = () => {
    switch (paymentMode) {
      case 'byn_cash': return totalBYNCash;
      case 'byn_noncash': return totalBYNNonCash;
      default: return totalUSD;
    }
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

  return {
    loading,
    saving,
    generatingPDF,
    budgetItems,
    categories,
    globalCategories,
    locations,
    equipment,
    workItems,
    selectedItemType,
    searchTerm,
    selectedEquipmentCategory,
    exchangeRate,
    paymentMode,
    workPersonnelManagerOpen,
    selectedCategoryForPersonnel,
    expandedCategories,
    dragOverTarget,
    dragOverItemId,
    showCategoryDropdown,
    activeCategoryIds,
    selectedCategoryId,
    showTemplates,
    showWarehouseSpec,
    showExchangeRatePopover,
    showLocationDialog,
    showLedSizeDialog,
    selectedLedEquipment,
    showPodiumDialog,
    selectedPodiumEquipment,
    showTotemDialog,
    selectedTotemEquipment,
    isMonototem,
    showUShapeUnifiedDialog,
    selectedUShapeEquipment,
    uShapeMode,
    discountEnabled,
    discountPercent,
    discountPercentInput,
    locationDragOverId,
    draggedLocationId,
    budgetListRef,
    categoryRefs,
    groupedItems,
    equipmentCategories,
    filteredEquipment,
    filteredWorkItems,
    setSelectedItemType,
    setSearchTerm,
    setSelectedEquipmentCategory,
    setExchangeRate,
    setPaymentMode,
    setShowCategoryDropdown,
    setShowLocationDialog,
    setShowTemplates,
    setShowWarehouseSpec,
    setShowExchangeRatePopover,
    setExpandedCategories,
    setSelectedCategoryId,
    setDiscountEnabled,
    setDiscountPercent,
    setDiscountPercentInput,
    setWorkPersonnelManagerOpen,
    setSelectedCategoryForPersonnel,
    setShowLedSizeDialog,
    setSelectedLedEquipment,
    setShowPodiumDialog,
    setSelectedPodiumEquipment,
    setShowTotemDialog,
    setSelectedTotemEquipment,
    setShowUShapeUnifiedDialog,
    setSelectedUShapeEquipment,
    handleSelectCategory,
    handleCreateExtraServiceCategory,
    handleCreateLocation,
    handleUpdateLocation,
    handleDeleteLocation,
    handleEquipmentClick,
    handleLedSizeConfirm,
    handlePodiumConfirm,
    handleTotemConfirm,
    handleUShapeUnifiedConfirm,
    handleAddWorkItem,
    handleUpdateItem,
    handleOpenWorkPersonnelManager,
    handleWorkPersonnelSave,
    handleDeleteItem,
    handleDeleteCategory,
    handleUpdateCategoryName,
    handleSave,
    handleExportPDF,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragOverItem,
    handleDropOnItem,
    handleLocationDragStart,
    handleLocationDragOver,
    handleLocationDrop,
    getTotalForMode,
    getCurrencyLabel,
    getDiscountedTotal,
    loadData
  };
}

export type BudgetLogicVM = ReturnType<typeof useBudgetLogic>;
