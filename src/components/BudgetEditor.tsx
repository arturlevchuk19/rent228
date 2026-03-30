import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Save, Package, Download, FileText, Settings, ChevronDown, MapPin } from 'lucide-react';
import { BudgetItem, getBudgetItems, createBudgetItem, updateBudgetItem, deleteBudgetItem, getEvent, updateEvent } from '../lib/events';
import { EquipmentItem, getEquipmentItems } from '../lib/equipment';
import { WorkItem, getWorkItems } from '../lib/personnel';
import { Category, createCategory, getCategories, getCategoriesForEvent, updateCategory } from '../lib/categories';
import { Location, createLocation, getLocationsForEvent } from '../lib/locations';
import { CategoryBlock } from './CategoryBlock';
import { WorkPersonnelManager } from './WorkPersonnelManager';
import { TemplatesInBudget } from './TemplatesInBudget';
import { WarehouseSpecification } from './WarehouseSpecification';
import { generateBudgetPDF } from '../lib/pdfGenerator';
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
  const [dragOverTarget, setDragOverTarget] = useState<BudgetDragTarget | null>(null);
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

      // Load discount settings from event
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
        if (item.location_id) {
          initialActive.add(`location:${item.location_id}`);
          return;
        }

        if (item.category_id) {
          initialActive.add(`category:${item.category_id}`);
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
    await handleAddItem(equipmentItem, 1, undefined, selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined);
  };
  const handleLedSizeConfirm = (result: { quantity: number; customName: string; customPrice: number }) => {
    if (!selectedLedEquipment) return;
    handleAddItem(
      selectedLedEquipment,
      result.quantity,
      undefined,
      selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined,
      result.customName,
      result.customPrice
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
      selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined,
      result.customName,
      result.customPrice
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
      selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined,
      result.customName,
      result.customPrice
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
      selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined,
      result.customName,
      result.customPrice
    );
    setShowUShapeUnifiedDialog(false);
    setSelectedUShapeEquipment(null);
  };

  const handleAddItem = async (equipmentItem: EquipmentItem, quantity: number = 1, modificationId?: string, categoryId?: string, customName?: string, customPrice?: number) => {
    try {
      const selectedCategoryKey = selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined;
      const targetCategoryId = categoryId || selectedCategoryKey || undefined;

      const newItem = await createBudgetItem({
        event_id: eventId,
        equipment_id: equipmentItem.id,
        modification_id: modificationId || null,
        item_type: 'equipment',
        quantity,
        price: customPrice !== undefined ? customPrice : equipmentItem.rental_price,
        exchange_rate: exchangeRate,
        category_id: targetCategoryId,
        notes: customName || ''
      });
      const updatedItems = [...budgetItems, newItem];
      setBudgetItems(updatedItems);
      lastAddedItemRef.current = newItem.id;

      if (targetCategoryId) {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(`category:${targetCategoryId}`);
        setActiveCategoryIds(newActiveCategoryIds);

        const categoryGroupId = `category:${targetCategoryId}`;
        if (!expandedCategories[categoryGroupId]) {
          setExpandedCategories({ ...expandedCategories, [categoryGroupId]: true });
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
      const selectedCategoryKey = selectedCategoryId?.startsWith('category:') ? selectedCategoryId.replace('category:', '') : undefined;
      const targetCategoryId = categoryId || selectedCategoryKey || undefined;

      const newItem = await createBudgetItem({
        event_id: eventId,
        work_item_id: workItem.id,
        item_type: 'work',
        quantity: 1,
        price: 0,
        exchange_rate: exchangeRate,
        category_id: targetCategoryId,
        notes: ''
      });
      const updatedItems = [...budgetItems, newItem];
      setBudgetItems(updatedItems);
      lastAddedItemRef.current = newItem.id;

      if (targetCategoryId) {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(`category:${targetCategoryId}`);
        setActiveCategoryIds(newActiveCategoryIds);
      } else {
        const newActiveCategoryIds = new Set(activeCategoryIds);
        newActiveCategoryIds.add(NO_LOCATION_GROUP_ID);
        setActiveCategoryIds(newActiveCategoryIds);

      }

      if (targetCategoryId && !expandedCategories[`category:${targetCategoryId}`]) {
        setExpandedCategories({ ...expandedCategories, [`category:${targetCategoryId}`]: true });
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
        eventName: event.event_type,
        eventDate: event.event_date,
        venueName: event.venues?.name,
        clientName: event.clients?.organization,
        organizerName: event.organizers?.full_name,
        budgetItems: budgetItems as any,
        categories: categories,
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

  const buildLocationCategoryKey = (locationId: string | null | undefined, categoryId: string | null | undefined) => {
    return `${locationId || 'no-location'}::${categoryId || 'uncategorized'}`;
  };

  const handleDragOver = (e: React.DragEvent, target: BudgetDragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
    setDragOverItemId(null);
  };

  const handleDrop = async (e: React.DragEvent, target: BudgetDragTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setDragOverItemId(null);

    if (!draggedItem) return;

    if (draggedItem.type === 'item') {
      if (targetCategoryId.startsWith('location:')) {
        await handleUpdateItem(draggedItem.id, { location_id: targetCategoryId.replace('location:', '') });
      } else if (targetCategoryId === NO_LOCATION_GROUP_ID) {
        await handleUpdateItem(draggedItem.id, { location_id: null });
      } else if (targetCategoryId.startsWith('category:')) {
        await handleUpdateItem(draggedItem.id, {
          category_id: targetCategoryId.replace('category:', ''),
          location_id: null
        });
      }
    } else if (draggedItem.type === 'category') {
      if (!targetCategoryId.startsWith('category:')) {
        setDraggedItem(null);
        return;
      }
      const sourceCategoryId = draggedItem.id;
      const normalizedTargetCategoryId = targetCategoryId.replace('category:', '');
      if (sourceCategoryId !== normalizedTargetCategoryId) {
        const sourceIndex = categories.findIndex(c => c.id === sourceCategoryId);
        const targetIndex = categories.findIndex(c => c.id === normalizedTargetCategoryId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newCategories = [...categories];
          const [movedCategory] = newCategories.splice(sourceIndex, 1);
          newCategories.splice(targetIndex, 0, movedCategory);

          setCategories(newCategories);

          for (let i = 0; i < newCategories.length; i++) {
            await updateCategory(newCategories[i].id, { sort_order: i });
          }
        }
      }
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

    const sourceGroupId = sourceItem.location_id
      ? `location:${sourceItem.location_id}`
      : sourceItem.category_id
        ? `category:${sourceItem.category_id}`
        : NO_LOCATION_GROUP_ID;
    const targetGroupId = targetItem.location_id
      ? `location:${targetItem.location_id}`
      : targetItem.category_id
        ? `category:${targetItem.category_id}`
        : NO_LOCATION_GROUP_ID;

    // Create a working copy with the source item moved to the target category if needed
    let workingItems = [...budgetItems];
    if (sourceGroupId !== targetGroupId) {
      await updateBudgetItem(sourceItemId, {
        category_id: targetItem.category_id || null,
        location_id: targetItem.location_id || null
      });
      workingItems = budgetItems.map(item =>
        item.id === sourceItemId
          ? { ...item, category_id: targetItem.category_id || null, location_id: targetItem.location_id || null }
          : item
      );
    }

    const categoryItems = workingItems
      .filter(item => {
        const groupId = item.location_id
          ? `location:${item.location_id}`
          : item.category_id
            ? `category:${item.category_id}`
            : NO_LOCATION_GROUP_ID;
        return groupId === targetGroupId;
      })
      .sort((a, b) => a.sort_order - b.sort_order);

    const sourceIndex = categoryItems.findIndex(item => item.id === sourceItemId);
    const targetIndex = categoryItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
      const newOrder = [...categoryItems];
      const [movedItem] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);

      for (let i = 0; i < newOrder.length; i++) {
        await updateBudgetItem(newOrder[i].id, { sort_order: i });
      }

      // Build the final array with items in correct order
      const otherCategoryItems = workingItems.filter(
        item => {
          const groupId = item.location_id
            ? `location:${item.location_id}`
            : item.category_id
              ? `category:${item.category_id}`
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

  const groupedItems: GroupedItems = budgetItems.reduce((acc, item) => {
    const groupId = item.location_id
      ? `location:${item.location_id}`
      : item.category_id
        ? `category:${item.category_id}`
        : NO_LOCATION_GROUP_ID;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(item);
    return acc;
  }, {} as GroupedItemsByLocation);

  const sortedLocationIds = Array.from(new Set(budgetItems.map(item => item.location_id || null))).sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });
  if (!sortedLocationIds.includes(null)) {
    sortedLocationIds.push(null);
  }

  const totalUSD = budgetItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBYNCash = budgetItems.reduce((sum, item) =>
    sum + calculateBYNCash(item.price, item.quantity), 0
  );
  const totalBYNNonCash = budgetItems.reduce((sum, item) =>
    sum + calculateBYNNonCash(item.price, item.quantity, item), 0
  );

  const nonWorkItems = budgetItems.filter(item => item.item_type !== 'work');
  const workItems2 = budgetItems.filter(item => item.item_type === 'work');

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
                  {categories.filter(cat => cat.is_template !== true).map(category => {
                    const categoryGroupId = `category:${category.id}`;
                    const categoryItems = groupedItems[categoryGroupId] || [];
                    if (categoryItems.length === 0 && !activeCategoryIds.has(categoryGroupId)) return null;

                    return (
                      <div
                        key={category.id}
                        className={`transition-all duration-200 ${dragOverTarget === categoryGroupId ? 'ring-2 ring-cyan-500 bg-cyan-500/5 rounded-xl p-0.5' : ''}`}
                      >
                        <CategoryBlock
                          categoryId={category.id}
                          categoryName={category.name}
                          items={categoryItems}
                          isExpanded={expandedCategories[categoryGroupId] || false}
                          isSelected={selectedCategoryId === categoryGroupId}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [categoryGroupId]: !prev[categoryGroupId] }))}
                          onSelect={() => setSelectedCategoryId(selectedCategoryId === categoryGroupId ? null : categoryGroupId)}
                          onUpdateCategoryName={(name) => handleUpdateCategoryName(category.id, name)}
                          onUpdateItem={handleUpdateItem}
                          onDeleteItem={handleDeleteItem}
                          onDeleteCategory={handleDeleteCategory}
                          onManagePersonnel={handleOpenWorkPersonnelManager}
                          paymentMode={paymentMode}
                          exchangeRate={exchangeRate}
                          onDragStart={handleDragStart}
                          onDragOver={(e) => handleDragOver(e, categoryGroupId)}
                          onDrop={(e) => handleDrop(e, categoryGroupId)}
                          onDragOverItem={handleDragOverItem}
                          onDropOnItem={handleDropOnItem}
                          dragOverItemId={dragOverItemId}
                          categoryRef={(el) => { categoryRefs.current[category.id] = el; }}
                        />
                      </div>
                    );
                  })}
                  {locations.map((location) => {
                    const locationGroupId = `location:${location.id}`;
                    const locationItems = groupedItems[locationGroupId] || [];
                    if (locationItems.length === 0 && !activeCategoryIds.has(locationGroupId)) return null;

                    return (
                      <div
                        key={location.id}
                        className={`transition-all duration-200 ${dragOverTarget === locationGroupId ? 'ring-2 ring-cyan-500 bg-cyan-500/5 rounded-xl p-0.5' : ''}`}
                      >
                        <CategoryBlock
                          categoryId={locationGroupId}
                          categoryName={`📍 ${location.name}`}
                          items={locationItems}
                          isExpanded={expandedCategories[locationGroupId] || false}
                          isSelected={selectedCategoryId === locationGroupId}
                          onToggleExpand={() => setExpandedCategories(prev => ({ ...prev, [locationGroupId]: !prev[locationGroupId] }))}
                          onSelect={() => setSelectedCategoryId(selectedCategoryId === locationGroupId ? null : locationGroupId)}
                          onUpdateCategoryName={() => {}}
                          onUpdateItem={handleUpdateItem}
                          onDeleteItem={handleDeleteItem}
                          paymentMode={paymentMode}
                          exchangeRate={exchangeRate}
                          onDragStart={handleDragStart}
                          onDragOver={(e) => handleDragOver(e, locationGroupId)}
                          onDrop={(e) => handleDrop(e, locationGroupId)}
                          onDragOverItem={handleDragOverItem}
                          onDropOnItem={handleDropOnItem}
                          dragOverItemId={dragOverItemId}
                          headerStyle={{ backgroundColor: location.color || '#14532d' }}
                          headerClassName="hover:brightness-110"
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
                        onDragStart={handleDragStart}
                        onDragOver={(e) => handleDragOver(e, NO_LOCATION_GROUP_ID)}
                        onDrop={(e) => handleDrop(e, NO_LOCATION_GROUP_ID)}
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
                <span className="text-cyan-400">{getTotalForMode().toLocaleString()}</span>
                <span className="text-xs font-normal text-gray-400 ml-1">{getCurrencyLabel()}</span>
              </span>
            </div>

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
            if (selectedCategoryForPersonnel === NO_LOCATION_GROUP_ID) return !item.category_id && !item.location_id;
            if (selectedCategoryForPersonnel.startsWith('category:')) {
              return item.category_id === selectedCategoryForPersonnel.replace('category:', '');
            }
            return item.category_id === selectedCategoryForPersonnel;
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
