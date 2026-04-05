import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Package, Download, ChevronDown, ChevronRight, CheckCircle, Layers, Calculator, Save, Truck, Trash2 } from 'lucide-react';
import { BudgetItem, getEvent, confirmSpecification, confirmShipment, confirmReturn } from '../lib/events';
import { EquipmentItem, getEquipmentItems, getEquipmentModifications, EquipmentModification, ModificationComponent } from '../lib/equipment';
import { getEquipmentCompositions } from '../lib/equipmentCompositions';
import { Category, getCategories, getCategoriesForEvent } from '../lib/categories';
import { Location, getLocationsForEvent } from '../lib/locations';
import { CalculatedCase } from './LedSpecificationPanel';
import { EquipmentSelector } from './EquipmentSelector';
import { LedSpecificationPanel } from './LedSpecificationPanel';
import { PodiumSpecificationPanel } from './PodiumSpecificationPanel';
import { useAuth } from '../contexts/AuthContext';
import { isWarehouse } from '../lib/auth';
import {
  CableItem,
  ConnectorItem,
  OtherItem,
  CABLE_TEMPLATES,
  CONNECTOR_TEMPLATES,
  OTHER_TEMPLATES,
  getCables,
  createCable,
  updateCable,
  updateCableReturnPicked,
  deleteCable,
  getConnectors,
  createConnector,
  updateConnector,
  updateConnectorReturnPicked,
  deleteConnector,
  getOtherItems,
  createOtherItem,
  updateOtherItem,
  updateOtherItemReturnPicked,
  deleteOtherItem,
  getSpecificationBudgetItems,
  createSpecificationBudgetItem,
  updateSpecificationBudgetItem,
  updateSpecificationBudgetItemPicked,
  updateSpecificationBudgetItemReturnPicked,
  deleteSpecificationBudgetItem,
  ensureWarehouseSpecificationSnapshot
} from '../lib/warehouseSpecification';
import { getModificationComponents } from '../lib/equipment';

interface WarehouseSpecificationProps {
  eventId: string;
  eventName: string;
  onClose: () => void;
}

interface ExpandedItem {
  budgetItemId: string;
  categoryId: string | null;
  locationId: string | null;
  locationName: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  category: string;
  notes: string;
  picked: boolean;
  return_picked: boolean;
  isFromComposition: boolean;
  isExtra?: boolean;
  parentName?: string;
}

interface QuantityChangeRequest {
  budgetItemId: string;
  itemName: string;
  fromQuantity: number;
  toQuantity: number;
}

interface CustomNotification {
  message: string;
  type: 'success' | 'error';
}

interface PendingConfirmationItem {
  id: string;
  name: string;
  group: 'equipment' | 'cables' | 'connectors' | 'other';
}

interface AddEquipmentTarget {
  categoryId: string | null;
  locationId: string | null;
}

interface PendingDeleteItem {
  budgetItemId: string;
  itemName: string;
}

type TabType = 'budget' | 'cables' | 'connectors' | 'other' | 'extra';

export function WarehouseSpecification({ eventId, eventName, onClose }: WarehouseSpecificationProps) {
  const { user } = useAuth();
  const isWarehouseUser = isWarehouse(user);

  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<ExpandedItem[]>([]);
  const [cables, setCables] = useState<CableItem[]>([]);
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [otherItems, setOtherItems] = useState<OtherItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
  const [allEquipment, setAllEquipment] = useState<EquipmentItem[]>([]);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [expandedCableTypes, setExpandedCableTypes] = useState<Record<string, boolean>>({});
  const [expandedConnectorCategories, setExpandedConnectorCategories] = useState<Record<string, boolean>>({});
  const [expandedOtherCategories, setExpandedOtherCategories] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmingShipment, setConfirmingShipment] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [equipmentModifications, setEquipmentModifications] = useState<Record<string, EquipmentModification[]>>({});
  const [showModificationSelector, setShowModificationSelector] = useState(false);
  const [selectedBudgetItemForMod, setSelectedBudgetItemForMod] = useState<BudgetItem | null>(null);
  const [showComponentsDialog, setShowComponentsDialog] = useState(false);
  const [selectedModification, setSelectedModification] = useState<EquipmentModification | null>(null);
  const [modificationComponents, setModificationComponents] = useState<ModificationComponent[]>([]);
  const [componentQuantities, setComponentQuantities] = useState<Record<string, number>>({});
  const [loadingModifications, setLoadingModifications] = useState(false);
  const [itemsWithAppliedModifications, setItemsWithAppliedModifications] = useState<Set<string>>(new Set());
  const [showLedSpecification, setShowLedSpecification] = useState<string | null>(null);
  const [ledItemsWithCases, setLedItemsWithCases] = useState<Set<string>>(new Set());
  const [showPodiumSpecification, setShowPodiumSpecification] = useState<string | null>(null);
  const [podiumItemsWithComposition, setPodiumItemsWithComposition] = useState<Set<string>>(new Set());
  const [ledSpecifications, setLedSpecifications] = useState<Record<string, {
    moduleType: string;
    moduleSize: { width: number; height: number };
    totalArea: number;
    progress: number;
    cases: Array<{ modulesCount: number; caseCount: number; caseId: string }>;
  }>>({});
  const [modifiedItems, setModifiedItems] = useState<Set<string>>(new Set());
  const [savingChanges, setSavingChanges] = useState(false);
  const [inputDraftValues, setInputDraftValues] = useState<Record<string, string>>({});
  const [pendingQuantityChange, setPendingQuantityChange] = useState<QuantityChangeRequest | null>(null);
  const [notification, setNotification] = useState<CustomNotification | null>(null);
  const [showSpecificationConfirmDialog, setShowSpecificationConfirmDialog] = useState(false);
  const [pendingConfirmItems, setPendingConfirmItems] = useState<PendingConfirmationItem[]>([]);
  const [pendingConfirmMode, setPendingConfirmMode] = useState<'shipment' | 'return' | null>(null);
  const [addEquipmentTarget, setAddEquipmentTarget] = useState<AddEquipmentTarget>({ categoryId: null, locationId: null });
  const [pendingDeleteItem, setPendingDeleteItem] = useState<PendingDeleteItem | null>(null);

  const showNotification = (message: string, type: CustomNotification['type'] = 'error') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 3000);
  };

  const isLedScreenItem = (item: ExpandedItem) => {
    const name = (item.name || '').toLowerCase();
    return name.includes('светодиодный экран');
  };

  const isLedScreenBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || '').toLowerCase();
    return name.includes('светодиодный экран');
  };

  const isPodiumItem = (item: ExpandedItem) => {
    const name = (item.name || "").toLowerCase();
    return name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов");
  };

  const isPodiumBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов");
  };

  const isUShapeBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("п-образная конструкция");
  };

  const isTotemBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("тотем");
  };

  const hasModifications = (budgetItemId: string) => {
    // Check if modifications have been applied to this item
    if (itemsWithAppliedModifications.has(budgetItemId)) {
      return false;
    }
    
    // Find the budget item
    const budgetItem = budgetItems.find(item => item.id === budgetItemId);
    if (!budgetItem?.equipment_id) return false;
    
    // Check if we already know this equipment has no modifications
    if (equipmentModifications[budgetItem.equipment_id] !== undefined) {
      return equipmentModifications[budgetItem.equipment_id].length > 0;
    }
    
    // If not loaded yet, we need to check
    return false;
  };

  const checkAndLoadModifications = async (budgetItem: BudgetItem) => {
    if (!budgetItem.equipment_id) return false;
    
    // If we already know about this equipment's modifications, return that result
    if (equipmentModifications[budgetItem.equipment_id] !== undefined) {
      return equipmentModifications[budgetItem.equipment_id].length > 0;
    }
    
    // Otherwise, load the modifications
    try {
      const mods = await getEquipmentModifications(budgetItem.equipment_id);
      setEquipmentModifications(prev => ({
        ...prev,
        [budgetItem.equipment_id]: mods
      }));
      return mods.length > 0;
    } catch (error) {
      console.error('Error loading modifications for equipment', budgetItem.equipment_id, ':', error);
      return false;
    }
  };

  const mainItems = expandedItems.filter(item => !item.isExtra);
  const extraItems = expandedItems.filter(item => item.isExtra);

  const allPickedForShipment =
    expandedItems.every(item => item.picked) &&
    cables.every(c => c.picked) &&
    connectors.every(c => c.picked) &&
    otherItems.every(i => i.picked);

  const allPickedForReturn =
    expandedItems.every(item => item.return_picked) &&
    cables.every(c => c.return_picked) &&
    connectors.every(c => c.return_picked) &&
    otherItems.every(i => i.return_picked);

  const buildLocationGroups = (items: ExpandedItem[]) => {
    const categoriesById = new Map(categories.map(cat => [cat.id, cat.name]));
    const locationsById = new Map(locations.map(location => [location.id, location]));

    const groupedByLocation = items.reduce<Record<string, ExpandedItem[]>>((acc, item) => {
      const key = item.locationId || 'no-location';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const sortedLocationKeys = Object.keys(groupedByLocation).sort((a, b) => {
      const indexA = locations.findIndex(location => location.id === a);
      const indexB = locations.findIndex(location => location.id === b);
      const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      if (normalizedA !== normalizedB) return normalizedA - normalizedB;
      const nameA = locationsById.get(a)?.name || '';
      const nameB = locationsById.get(b)?.name || '';
      return nameA.localeCompare(nameB, 'ru');
    });

    return sortedLocationKeys.map(locationKey => {
      const locationItems = groupedByLocation[locationKey];
      const groupedByCategory = locationItems.reduce<Record<string, ExpandedItem[]>>((acc, item) => {
        const categoryKey = item.categoryId || 'uncategorized';
        if (!acc[categoryKey]) acc[categoryKey] = [];
        acc[categoryKey].push(item);
        return acc;
      }, {});

      const sortedCategoryKeys = Object.keys(groupedByCategory).sort((a, b) => {
        if (a === 'uncategorized') return 1;
        if (b === 'uncategorized') return -1;
        const indexA = categories.findIndex(category => category.id === a);
        const indexB = categories.findIndex(category => category.id === b);
        const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
        const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
        if (normalizedA !== normalizedB) return normalizedA - normalizedB;
        const nameA = categoriesById.get(a) || '';
        const nameB = categoriesById.get(b) || '';
        return nameA.localeCompare(nameB, 'ru');
      });

      const locationData = locationsById.get(locationKey);
      const fallbackLocationName = locationItems.find(item => item.locationName)?.locationName;
      const isNoLocation = locationKey === 'no-location';

      return {
        locationId: isNoLocation ? null : (locationData?.id || null),
        locationName: isNoLocation ? '' : (locationData?.name || fallbackLocationName || ''),
        locationColor: locationData?.color || '#4b5563',
        categories: sortedCategoryKeys.map(categoryKey => ({
          categoryId: categoryKey === 'uncategorized' ? null : categoryKey,
          categoryName: categoryKey === 'uncategorized'
            ? 'Без категории'
            : (categoriesById.get(categoryKey) || 'Без категории'),
          items: groupedByCategory[categoryKey]
        }))
      };
    });
  };

  const locationGroups = buildLocationGroups(mainItems);
  const extraLocationGroups = buildLocationGroups(extraItems);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async (pendingChanges?: { id: string; quantity?: number; notes?: string }[]) => {
    try {
      setLoading(true);
      const [budgetData, globalCategoriesData, eventCategoriesData, locationsData, equipmentData, event, cablesData, connectorsData, otherData] = await Promise.all([
        (async () => {
          await ensureWarehouseSpecificationSnapshot(eventId);
          return getSpecificationBudgetItems(eventId);
        })(),
        getCategories(),
        getCategoriesForEvent(eventId),
        getLocationsForEvent(eventId),
        getEquipmentItems(),
        getEvent(eventId),
        getCables(eventId),
        getConnectors(eventId),
        getOtherItems(eventId)
      ]);

      const mergedCategories = [...globalCategoriesData, ...eventCategoriesData];
      setCategories(mergedCategories);
      setLocations(locationsData);
      setAllEquipment(equipmentData);
      setEventDetails(event);
      setBudgetItems(budgetData);
      setCables(cablesData);
      setConnectors(connectorsData);
      setOtherItems(otherData);
      
      // Initialize empty modifications map - will load on demand
      setEquipmentModifications({});

      const items: ExpandedItem[] = [];

      console.log('Loading warehouse specification for event:', eventId);

      const locationsById = new Map(locationsData.map(location => [location.id, location]));

      for (const item of budgetData) {
        if (item.item_type !== 'equipment') continue;
        const itemLocationId = item.location_id || null;
        const itemLocation = itemLocationId ? locationsById.get(itemLocationId) : null;
        const itemLocationName = itemLocation?.name || item.location?.name || 'Без локации';

        // Handle child items (e.g., LED cases) - show them as composition items
        if (item.parent_budget_item_id) {
          const parentItem = budgetData.find(b => b.id === item.parent_budget_item_id);
          const locationId = item.location_id || parentItem?.location_id || null;
          const location = locationId ? locationsById.get(locationId) : null;

          items.push({
            budgetItemId: item.id,
            categoryId: item.category_id || null,
            locationId,
            locationName: location?.name || item.location?.name || parentItem?.location?.name || 'Без локации',
            name: item.name || 'Кейс',
            sku: item.sku || '',
            quantity: item.quantity,
            unit: 'шт.',
            category: parentItem?.equipment?.category || 'Видео',
            notes: item.notes || '',
            picked: item.picked || false,
            return_picked: item.return_picked || false,
            isFromComposition: true,
            isExtra: item.is_extra || false,
            parentName: parentItem?.equipment?.name || parentItem?.name
          });
          continue;
        }

        const isVirtual = item.equipment?.object_type === 'virtual';

        if (!isVirtual) {
          // Add parent item if it's physical or a saved virtual item
          // For virtual items (equipment is null), use name/sku from the budget item itself
          const isSavedVirtualItem = !item.equipment && item.name;
          items.push({
            budgetItemId: item.id,
            categoryId: item.category_id || null,
            locationId: itemLocationId,
            locationName: itemLocationName,
            name: item.equipment?.name || item.name || 'Unknown',
            sku: item.equipment?.sku || item.sku || '',
            quantity: item.quantity,
            unit: 'шт.',
            category: item.equipment?.category || 'Other',
            notes: item.notes || '',
            picked: item.picked || false,
            return_picked: item.return_picked || false,
            isFromComposition: !!isSavedVirtualItem,
            isExtra: item.is_extra || false,
          });
        } else {
          // Virtual item - check if it's an LED screen
          if (isLedScreenBudgetItem(item)) {
            // LED screen: add as single item, don't expand
            items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: item.equipment?.name || 'Unknown',
              sku: item.equipment?.sku || '',
              quantity: item.quantity,
              unit: 'шт.',
              category: item.equipment?.category || 'Other',
              notes: item.notes || '',
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: item.is_extra || false,
            });

            // Кейсы для LED экранов добавляются только после нажатия "Сохранить" в LedSpecificationPanel
          } else if (isPodiumBudgetItem(item)) {
             items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: item.name || item.equipment?.name || "Unknown",
              sku: item.equipment?.sku || "",
              quantity: item.quantity,
              unit: "шт.",
              category: item.equipment?.category || "Other",
              notes: item.notes || "",
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: item.is_extra || false,
            });

            // Для подиумов не подгружаем дефолтную composition автоматически.
            // Дочерние строки должны появляться только после расчета в PodiumSpecificationPanel
            // и сохранения (как реальные budget items с parent_budget_item_id).
          } else if (isUShapeBudgetItem(item) || isTotemBudgetItem(item)) {
            items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: item.equipment?.name || item.name || 'Unknown',
              sku: item.equipment?.sku || item.sku || '',
              quantity: item.quantity,
              unit: 'шт.',
              category: item.equipment?.category || 'Other',
              notes: item.notes || '',
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: item.is_extra || false,
            });
          } else {
            // Non-LED virtual item - expand it into its components
            let hasExpandedChildren = false;

            // Check for composition
            if (item.equipment_id) {
              try {
                const compositions = await getEquipmentCompositions(item.equipment_id);
                if (compositions.length > 0) {
                  hasExpandedChildren = true;
                }
                for (const comp of compositions) {
                  items.push({
                    budgetItemId: `${item.id}-comp-${comp.id}`,
                    categoryId: item.category_id || null,
                    locationId: itemLocationId,
                    locationName: itemLocationName,
                    name: comp.child_name || 'Unknown',
                    sku: comp.child_sku || '',
                    quantity: item.quantity * comp.quantity,
                    unit: 'шт.',
                    category: comp.child_category || 'Components',
                    notes: item.notes || '',
                    picked: item.picked || false,
                    return_picked: item.return_picked || false,
                    isFromComposition: true,
                    isExtra: item.is_extra || false,
                    parentName: item.equipment?.name
                  });
                }
              } catch (error) {
                console.error('Error loading composition for', item.equipment?.name, ':', error);
              }
            }

            // Check for modifications
            if (item.modification_id) {
              try {
                const components = await getModificationComponents(item.modification_id);
                if (components.length > 0) {
                  hasExpandedChildren = true;
                }
                for (const component of components) {
                  items.push({
                    budgetItemId: `${item.id}-mod-${component.id}`,
                    categoryId: item.category_id || null,
                    locationId: itemLocationId,
                    locationName: itemLocationName,
                    name: component.component?.name || 'Unknown',
                    sku: component.component?.sku || '',
                    quantity: item.quantity * component.quantity,
                    unit: 'шт.',
                    category: component.component?.category || 'Modification Components',
                    notes: item.notes || '',
                    picked: item.picked || false,
                    return_picked: item.return_picked || false,
                    isFromComposition: true,
                    isExtra: item.is_extra || false,
                    parentName: item.equipment?.name
                  });
                }
              } catch (error) {
                console.error('Error loading modification components:', error);
              }
            }

            // Fallback: if a virtual item has no composition/modification parts, show the item itself
            if (!hasExpandedChildren) {
              items.push({
                budgetItemId: item.id,
                categoryId: item.category_id || null,
                locationId: itemLocationId,
                locationName: itemLocationName,
                name: item.equipment?.name || item.name || 'Unknown',
                sku: item.equipment?.sku || item.sku || '',
                quantity: item.quantity,
                unit: 'шт.',
                category: item.equipment?.category || 'Other',
                notes: item.notes || '',
                picked: item.picked || false,
                return_picked: item.return_picked || false,
                isFromComposition: false,
                isExtra: item.is_extra || false,
              });
            }
            }
            }
            }

            // Pre-load modifications for all equipment items to know which ones have modifications
            const equipmentIds = budgetData
              .filter(item => item.item_type === 'equipment' && item.equipment_id && item.equipment?.object_type !== 'virtual')
              .map(item => item.equipment_id);

            if (equipmentIds.length > 0) {
              try {
                const modsMap: Record<string, EquipmentModification[]> = {};
                for (const equipmentId of equipmentIds) {
                  const mods = await getEquipmentModifications(equipmentId);
                  modsMap[equipmentId] = mods;
                }
                setEquipmentModifications(modsMap);
              } catch (error) {
                console.error('Error pre-loading modifications:', error);
              }
            }

            if (pendingChanges && pendingChanges.length > 0) {
              for (const change of pendingChanges) {
                const idx = items.findIndex(i => i.budgetItemId === change.id);
                if (idx >= 0) {
                  if (change.quantity !== undefined) items[idx].quantity = change.quantity;
                  if (change.notes !== undefined) items[idx].notes = change.notes;
                }
              }
            }
            setExpandedItems(items);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLedCasesCalculated = (budgetItemId: string, cases: CalculatedCase[]) => {
    console.log('handleLedCasesCalculated called:', { budgetItemId, casesCount: cases.length, cases });

    if (cases.length === 0) {
      console.log('No cases to add - skipping');
      return;
    }

    const budgetItem = budgetItems.find(b => b.id === budgetItemId);
    if (!budgetItem) {
      console.log('Budget item not found - skipping');
      return;
    }

    const realChildIds = new Set(
      budgetItems
        .filter(b => b.parent_budget_item_id === budgetItemId)
        .map(b => b.id)
    );

    const newCaseItems: ExpandedItem[] = cases.map(calculatedCase => ({
      budgetItemId: `${budgetItemId}-case-${calculatedCase.caseId}`,
      categoryId: budgetItem.category_id || null,
      locationId: budgetItem.location_id || null,
      locationName: budgetItem.location?.name || 'Без локации',
      name: calculatedCase.name,
      sku: calculatedCase.sku,
      quantity: calculatedCase.caseCount,
      unit: 'шт.',
      category: calculatedCase.category,
      notes: `Кейс для ${calculatedCase.modulesCount} шт. модулей`,
      picked: budgetItem.picked || false,
      return_picked: false,
      isFromComposition: true,
      parentName: budgetItem.equipment?.name
    }));

    setExpandedItems(prev => {
      const filtered = prev.filter(item =>
        !item.budgetItemId.startsWith(`${budgetItemId}-case-`) &&
        !realChildIds.has(item.budgetItemId)
      );
      const ledItemIndex = filtered.findIndex(item => item.budgetItemId === budgetItemId);
      const updated = [...filtered];
      if (ledItemIndex >= 0) {
        updated.splice(ledItemIndex + 1, 0, ...newCaseItems);
      } else {
        updated.push(...newCaseItems);
      }
      return updated;
    });
    setLedItemsWithCases(prev => new Set(prev).add(budgetItemId));
    setModifiedItems(prev => new Set(prev).add(budgetItemId));
  };

  const handlePodiumCompositionCalculated = (budgetItemId: string, selectedModules: Array<{ id: string; child_name: string; child_sku: string; child_category: string; quantity: number }>) => {
    const budgetItem = budgetItems.find(b => b.id === budgetItemId);
    if (!budgetItem) return;

    const realChildIds = new Set(
      budgetItems
        .filter(b => b.parent_budget_item_id === budgetItemId)
        .map(b => b.id)
    );

    const newChildItems: ExpandedItem[] = selectedModules.map(module => ({
      budgetItemId: `${budgetItemId}-podium-${module.id}`,
      categoryId: budgetItem.category_id || null,
      locationId: budgetItem.location_id || null,
      locationName: budgetItem.location?.name || 'Без локации',
      name: module.child_name,
      sku: module.child_sku,
      quantity: (budgetItem.quantity || 1) * module.quantity,
      unit: 'шт.',
      category: module.child_category || 'Конструкции',
      notes: `Элемент подиума для ${budgetItem.name || budgetItem.equipment?.name || 'подиума'}`,
      picked: budgetItem.picked || false,
      return_picked: false,
      isFromComposition: true,
      parentName: budgetItem.name || budgetItem.equipment?.name
    }));

    setExpandedItems(prev => {
      const filtered = prev.filter(item =>
        !item.budgetItemId.startsWith(`${budgetItemId}-podium-`) &&
        !item.budgetItemId.startsWith(`${budgetItemId}-comp-`) &&
        !realChildIds.has(item.budgetItemId)
      );
      const parentIndex = filtered.findIndex(item => item.budgetItemId === budgetItemId);
      const updated = [...filtered];
      if (parentIndex >= 0) {
        updated.splice(parentIndex + 1, 0, ...newChildItems);
      } else {
        updated.push(...newChildItems);
      }
      return updated;
    });
    setPodiumItemsWithComposition(prev => new Set(prev).add(budgetItemId));
    setModifiedItems(prev => new Set(prev).add(budgetItemId));
  };

  const handlePickedChange = async (budgetItemId: string, picked: boolean) => {
    try {
      // Find the real budget item ID (ignoring composition suffixes like -comp-, -mod-, or -case-)
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      // We need to extract the full UUID before any suffix
      const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*|-podium-.*)$/, '');
      await updateSpecificationBudgetItemPicked(realId, picked);
      
      // Update all items sharing this budget item ID
      setExpandedItems(expandedItems.map(item =>
        item.budgetItemId.startsWith(realId) ? { ...item, picked } : item
      ));
    } catch (error) {
      console.error('Error updating picked status:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const handleCablePickedChange = async (id: string, picked: boolean) => {
    try {
      await updateCable(id, { picked });
      setCables(cables.map(c => c.id === id ? { ...c, picked } : c));
    } catch (error) {
      console.error('Error updating cable picked status:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const handleConnectorGroupPickedChange = async (connectorType: string, picked: boolean) => {
    const sameTypeConnectors = connectors.filter(c => c.connector_type === connectorType);
    if (sameTypeConnectors.length === 0) return;

    try {
      await Promise.all(sameTypeConnectors.map(connector => updateConnector(connector.id, { picked })));
      setConnectors(prev => prev.map(c => c.connector_type === connectorType ? { ...c, picked } : c));
    } catch (error) {
      console.error('Error updating grouped connector picked status:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const handleConfirmSpecification = async () => {
    try {
      setConfirming(true);
      await confirmSpecification(eventId, user?.id || '');
      setEventDetails({ ...eventDetails, specification_confirmed: true });
      setShowSpecificationConfirmDialog(false);
      showNotification('Спецификация подтверждена', 'success');
    } catch (error) {
      console.error('Error confirming specification:', error);
      showNotification('Ошибка при подтверждении спецификации');
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirmShipment = async () => {
    if (!allPickedForShipment) {
      const pendingItems = getPendingConfirmationItems('shipment');
      if (pendingItems.length > 0) {
        setPendingConfirmItems(pendingItems);
        setPendingConfirmMode('shipment');
        return;
      }
    }

    try {
      setConfirmingShipment(true);
      await confirmShipment(eventId);
      setEventDetails({ ...eventDetails, equipment_shipped: true });
    } catch (error) {
      console.error('Error confirming shipment:', error);
      showNotification('Ошибка при подтверждении отгрузки');
    } finally {
      setConfirmingShipment(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!allPickedForReturn) {
      const pendingItems = getPendingConfirmationItems('return');
      if (pendingItems.length > 0) {
        setPendingConfirmItems(pendingItems);
        setPendingConfirmMode('return');
        return;
      }
    }

    try {
      setConfirmingReturn(true);
      await confirmReturn(eventId);
      setEventDetails({ ...eventDetails, equipment_returned: true });
    } catch (error) {
      console.error('Error confirming return:', error);
      showNotification('Ошибка при подтверждении приёма');
    } finally {
      setConfirmingReturn(false);
    }
  };

  const handleReturnPickedChange = async (budgetItemId: string, return_picked: boolean) => {
    try {
      const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*|-podium-.*)$/, '');
      await updateSpecificationBudgetItemReturnPicked(realId, return_picked);
      setExpandedItems(prev => prev.map(item =>
        item.budgetItemId.startsWith(realId) ? { ...item, return_picked } : item
      ));
    } catch (error) {
      console.error('Error updating return picked status:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const handleCableReturnPickedChange = async (id: string, return_picked: boolean) => {
    try {
      await updateCableReturnPicked(id, return_picked);
      setCables(prev => prev.map(c => c.id === id ? { ...c, return_picked } : c));
    } catch (error) {
      console.error('Error updating cable return picked:', error);
    }
  };

  const handleConnectorGroupReturnPickedChange = async (connectorType: string, return_picked: boolean) => {
    const sameTypeConnectors = connectors.filter(c => c.connector_type === connectorType);
    if (sameTypeConnectors.length === 0) return;

    try {
      await Promise.all(sameTypeConnectors.map(connector => updateConnectorReturnPicked(connector.id, return_picked)));
      setConnectors(prev => prev.map(c => c.connector_type === connectorType ? { ...c, return_picked } : c));
    } catch (error) {
      console.error('Error updating grouped connector return picked:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const handleOtherReturnPickedChange = async (id: string, return_picked: boolean) => {
    try {
      await updateOtherItemReturnPicked(id, return_picked);
      setOtherItems(prev => prev.map(i => i.id === id ? { ...i, return_picked } : i));
    } catch (error) {
      console.error('Error updating other item return picked:', error);
    }
  };

  const getPendingConfirmationItems = (mode: 'shipment' | 'return'): PendingConfirmationItem[] => {
    const isPicked = (picked: boolean, returnPicked: boolean) => mode === 'shipment' ? picked : returnPicked;
    const normalizeText = (value?: string | null) => (value || '').trim();
    const fallbackName = (value: string, fallback: string) => value.length > 0 ? value : fallback;

    const equipmentPending = expandedItems
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `eq-${item.budgetItemId}`,
        name: item.name,
        group: 'equipment' as const
      }));

    // Keep only the first record per cable type/length pair to match how cables are rendered in the table.
    // Historical duplicated rows may exist in DB, and showing each duplicate here can produce false pending items.
    const visibleCablesByKey = new Map<string, CableItem>();
    cables.forEach(item => {
      const normalizedType = normalizeText(item.cable_type);
      const normalizedLength = normalizeText(item.cable_length);
      const key = `${normalizedType}|${normalizedLength}`;
      if (!visibleCablesByKey.has(key)) {
        visibleCablesByKey.set(key, item);
      }
    });

    const cablesPending = Array.from(visibleCablesByKey.values())
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `cable-${item.id}`,
        name: fallbackName(
          `${normalizeText(item.cable_type)} ${normalizeText(item.cable_length)}`.trim(),
          `Кабель #${item.id.slice(0, 8)}`
        ),
        group: 'cables' as const
      }));

    const connectorsPendingByType = new Map<string, PendingConfirmationItem>();
    connectors
      .filter(item => !isPicked(item.picked, item.return_picked))
      .forEach(item => {
        const normalizedType = normalizeText(item.connector_type);
        const key = normalizedType || item.id;
        if (!connectorsPendingByType.has(key)) {
          connectorsPendingByType.set(key, {
            id: `connector-${key}`,
            name: fallbackName(normalizedType, `Коннектор #${item.id.slice(0, 8)}`),
            group: 'connectors'
          });
        }
      });
    const connectorsPending = Array.from(connectorsPendingByType.values());

    const otherPending = otherItems
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `other-${item.id}`,
        name: fallbackName(
          `${normalizeText(item.category)} ${normalizeText(item.item_type)}`.trim(),
          `Прочее #${item.id.slice(0, 8)}`
        ),
        group: 'other' as const
      }));

    return [...equipmentPending, ...cablesPending, ...connectorsPending, ...otherPending];
  };

  const handleAddExtraEquipment = async (equipment: EquipmentItem, quantity: number, modificationId?: string) => {
    try {
      await createSpecificationBudgetItem({
        event_id: eventId,
        equipment_id: equipment.id,
        modification_id: modificationId,
        item_type: 'equipment',
        quantity,
        price: equipment.rental_price,
        exchange_rate: 1,
        category_id: null,
        notes: '',
        is_extra: true,
      });
      setShowEquipmentSelector(false);
      setAddEquipmentTarget({ categoryId: null, locationId: null });
      await loadData();
    } catch (error) {
      console.error('Error adding extra equipment:', error);
      showNotification('Ошибка при добавлении оборудования');
    }
  };

  const handleOpenModificationSelector = async (budgetItem: BudgetItem) => {
    if (!budgetItem.equipment_id) return;
    
    setLoadingModifications(true);
    
    // Check if we already have modifications loaded for this equipment
    if (!equipmentModifications[budgetItem.equipment_id]) {
      try {
        const mods = await getEquipmentModifications(budgetItem.equipment_id);
        setEquipmentModifications(prev => ({
          ...prev,
          [budgetItem.equipment_id]: mods
        }));
      } catch (error) {
        console.error('Error loading modifications for equipment', budgetItem.equipment_id, ':', error);
        showNotification('Ошибка загрузки модификаций');
        setLoadingModifications(false);
        return;
      }
    }
    
    setSelectedBudgetItemForMod(budgetItem);
    setShowModificationSelector(true);
    setLoadingModifications(false);
  };

  const handleModificationSelect = async (modification: EquipmentModification) => {
    setSelectedModification(modification);
    setShowModificationSelector(false);
    
    // Load components
    const components = await getModificationComponents(modification.id);
    setModificationComponents(components);
    
    // Initialize quantities to 0
    const quantities: Record<string, number> = {};
    components.forEach(comp => {
      quantities[comp.id] = 0;
    });
    setComponentQuantities(quantities);
    
    setShowComponentsDialog(true);
  };

  const handleComponentQuantityChange = (componentId: string, quantity: number) => {
    setComponentQuantities({
      ...componentQuantities,
      [componentId]: Math.max(0, quantity)
    });
  };

  const handleSaveComponents = () => {
    if (!selectedBudgetItemForMod || !selectedModification) return;
    
    // Add components as expanded items
    const newItems: ExpandedItem[] = modificationComponents
      .filter(comp => componentQuantities[comp.id] > 0)
      .map(comp => ({
        budgetItemId: `${selectedBudgetItemForMod.id}-mod-${comp.id}-${Date.now()}`,
        categoryId: selectedBudgetItemForMod.category_id || null,
        locationId: selectedBudgetItemForMod.location_id || null,
        locationName: selectedBudgetItemForMod.location?.name || 'Без локации',
        name: comp.component?.name || 'Unknown',
        sku: comp.component?.sku || '',
        quantity: componentQuantities[comp.id],
        unit: 'шт.',
        category: comp.component?.category || 'Modification Components',
        notes: '',
        picked: false,
        return_picked: false,
        isFromComposition: true,
        parentName: `${selectedBudgetItemForMod.equipment?.name} (${selectedModification.name})`
      }));
    
    // Find the parent item index
    const parentIndex = expandedItems.findIndex(item => item.budgetItemId === selectedBudgetItemForMod.id);
    
    // Insert new items right after the parent
    const updatedItems = [...expandedItems];
    if (parentIndex >= 0) {
      updatedItems.splice(parentIndex + 1, 0, ...newItems);
    } else {
      updatedItems.push(...newItems);
    }
    
    setExpandedItems(updatedItems);
    
    // Mark parent item as having applied modifications
    setItemsWithAppliedModifications(prev => {
      const newSet = new Set(prev);
      newSet.add(selectedBudgetItemForMod.id);
      return newSet;
    });
    
    // Reset state
    setShowComponentsDialog(false);
    setSelectedModification(null);
    setModificationComponents([]);
    setComponentQuantities({});
    setSelectedBudgetItemForMod(null);
  };

  const handleAddEquipment = async (equipment: EquipmentItem, quantity: number, modificationId?: string) => {
    try {
      const newItem = await createSpecificationBudgetItem({
        event_id: eventId,
        equipment_id: equipment.id,
        modification_id: modificationId,
        item_type: 'equipment',
        quantity,
        price: equipment.rental_price,
        exchange_rate: 1,
        category_id: addEquipmentTarget.categoryId,
        location_id: addEquipmentTarget.locationId,
        notes: ''
      });

      console.log('Created budget item:', newItem);
      setShowEquipmentSelector(false);
      setAddEquipmentTarget({ categoryId: null, locationId: null });
      const pending = expandedItems
        .filter(i => modifiedItems.has(i.budgetItemId))
        .map(i => ({ id: i.budgetItemId, quantity: i.quantity, notes: i.notes }));
      await loadData(pending);
    } catch (error) {
      console.error('Error adding equipment:', error);
      showNotification('Ошибка при добавлении оборудования');
    }
  };

  const openEquipmentSelectorForCategory = (categoryId: string | null, locationId: string | null) => {
    setAddEquipmentTarget({ categoryId, locationId });
    setShowEquipmentSelector(true);
  };

  const handleQuantityChange = (budgetItemId: string, newQuantity: number) => {
    const currentItem = expandedItems.find(item => item.budgetItemId === budgetItemId);
    const currentQuantity = currentItem?.quantity ?? 0;
    const normalizedQuantity = Math.max(0, newQuantity);

    if (normalizedQuantity === currentQuantity) {
      return;
    }

    setPendingQuantityChange({
      budgetItemId,
      itemName: currentItem?.name || 'элемента',
      fromQuantity: currentQuantity,
      toQuantity: normalizedQuantity
    });
  };

  const applyQuantityChange = () => {
    if (!pendingQuantityChange) return;

    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === pendingQuantityChange.budgetItemId
        ? { ...item, quantity: pendingQuantityChange.toQuantity }
        : item
    ));

    // Track modified item (extract real budget item ID for composed items)
    const realId = pendingQuantityChange.budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*|-podium-.*)$/, '');
    setModifiedItems(prev => new Set(prev).add(realId));
    setPendingQuantityChange(null);
  };

  const cancelQuantityChange = () => {
    setPendingQuantityChange(null);
  };

  const handleNotesChange = (budgetItemId: string, newNotes: string) => {
    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === budgetItemId ? { ...item, notes: newNotes } : item
    ));
    // Track modified item (extract real budget item ID for composed items)
    const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*|-podium-.*)$/, '');
    setModifiedItems(prev => new Set(prev).add(realId));
  };

  const handleDeleteSpecificationItem = async (budgetItemId: string) => {
    const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*|-podium-.*)$/, '');
    try {
      await deleteSpecificationBudgetItem(realId);
      await loadData();
      showNotification('Элемент удалён', 'success');
    } catch (error) {
      console.error('Error deleting specification item:', error);
      showNotification('Ошибка при удалении элемента');
    }
  };

  const requestDeleteSpecificationItem = (budgetItemId: string, itemName: string) => {
    setPendingDeleteItem({ budgetItemId, itemName });
  };

  const handleSaveChanges = async () => {
    if (modifiedItems.size === 0) return;
    
    setSavingChanges(true);
    try {
      const errors: string[] = [];
      const createdItems: { oldId: string; newId: string }[] = [];
      
      for (const budgetItemId of modifiedItems) {
        // Check if this budget item has LED cases that need to be created
        const caseItems = expandedItems.filter(item => 
          item.budgetItemId.startsWith(`${budgetItemId}-case-`)
        );
        const podiumChildItems = expandedItems.filter(item =>
          item.budgetItemId.startsWith(`${budgetItemId}-podium-`)
        );
        
        // Delete existing LED case children from DB before creating new ones (prevent duplicates)
        // Always fetch fresh from DB to avoid stale cache issues
        if (caseItems.length > 0) {
          const freshItemsForLed = await getSpecificationBudgetItems(eventId);
          const existingLedChildren = freshItemsForLed.filter(item => item.parent_budget_item_id === budgetItemId);
          for (const child of existingLedChildren) {
            try {
              await deleteSpecificationBudgetItem(child.id);
            } catch (err) {
              console.error('Error deleting old LED case budget item:', child.id, err);
            }
          }
        }

        // Create all LED cases as new budget items with parent_budget_item_id
        for (const caseItem of caseItems) {
          try {
            console.log('Creating LED case with data:', {
              event_id: eventId,
              item_type: 'equipment',
              category_id: caseItem.categoryId,
              equipment_id: null,
              parent_budget_item_id: budgetItemId,
              name: caseItem.name,
              sku: caseItem.sku,
              quantity: caseItem.quantity,
              price: 0,
              total: 0,
              exchange_rate: 1,
              notes: caseItem.notes,
              picked: caseItem.picked,
              sort_order: 0
            });
            const newItem = await createSpecificationBudgetItem({
              event_id: eventId,
              item_type: 'equipment',
              category_id: caseItem.categoryId,
              equipment_id: null,
              parent_budget_item_id: budgetItemId,
              name: caseItem.name,
              sku: caseItem.sku,
              quantity: caseItem.quantity,
              price: 0,
              total: 0,
              exchange_rate: 1,
              notes: caseItem.notes,
              picked: caseItem.picked,
              sort_order: 0
            });
            createdItems.push({ oldId: caseItem.budgetItemId, newId: newItem.id });
          } catch (err: any) {
            console.error('Error creating LED case budget item:', caseItem.budgetItemId, err);
            console.error('Error message:', err?.message);
            console.error('Error details:', err?.details);
            console.error('Error hint:', err?.hint);
          }
        }

        // Replace podium child rows for parent item
        if (podiumChildItems.length > 0) {
          // Fetch from DB directly to avoid stale state
          const freshBudgetItems = await getSpecificationBudgetItems(eventId);
          const existingPodiumChildren = freshBudgetItems.filter(item => item.parent_budget_item_id === budgetItemId);

          for (const child of existingPodiumChildren) {
            try {
              await deleteSpecificationBudgetItem(child.id);
            } catch (err) {
              console.error('Error deleting old podium child item:', child.id, err);
            }
          }

          for (const childItem of podiumChildItems) {
            try {
              const newItem = await createSpecificationBudgetItem({
                event_id: eventId,
                item_type: 'equipment',
                category_id: childItem.categoryId,
                equipment_id: null,
                parent_budget_item_id: budgetItemId,
                name: childItem.name,
                sku: childItem.sku,
                quantity: childItem.quantity,
                price: 0,
                total: 0,
                exchange_rate: 1,
                notes: childItem.notes,
                picked: childItem.picked,
                sort_order: 0
              });
              createdItems.push({ oldId: childItem.budgetItemId, newId: newItem.id });
            } catch (err) {
              console.error('Error creating podium child item:', childItem.budgetItemId, err);
              errors.push(childItem.name);
            }
          }
        }
        // Find the expanded item to get current values for quantity/notes update
        const expandedItem = expandedItems.find(item => item.budgetItemId === budgetItemId);
        
        if (!expandedItem) continue;
        
        // Check if this is the parent LED item that has cases attached
        const hasCases = caseItems.length > 0;
        const hasPodiumChildren = podiumChildItems.length > 0;

        if (hasCases || hasPodiumChildren) {
          // For items with generated children, update the parent (children are already created above)
          const budgetItem = budgetItems.find(b => b.id === budgetItemId);
          if (budgetItem) {
            try {
              await updateSpecificationBudgetItem(budgetItemId, {
                quantity: expandedItem.quantity,
                notes: expandedItem.notes
              });
            } catch (err) {
              console.error('Error saving budget item:', budgetItemId, err);
              errors.push(expandedItem.name);
            }
          }
        } else if (budgetItemId.includes('-case-') || budgetItemId.includes('-mod-')) {
          // For other virtual items (not parent LED), create a new budget item
          try {
            const newItem = await createSpecificationBudgetItem({
              event_id: eventId,
              item_type: 'equipment',
              equipment_id: null,
              work_item_id: null,
              category_id: expandedItem.categoryId,
              name: expandedItem.name,
              sku: expandedItem.sku,
              quantity: expandedItem.quantity,
              notes: expandedItem.notes,
              picked: expandedItem.picked
            });
            createdItems.push({ oldId: budgetItemId, newId: newItem.id });
          } catch (err) {
            console.error('Error creating budget item:', budgetItemId, err);
            errors.push(expandedItem.name);
          }
        } else {
          // Find the original budget item for regular (non-virtual) items
          const budgetItem = budgetItems.find(b => b.id === budgetItemId);
          if (!budgetItem) continue;
          
          try {
            await updateSpecificationBudgetItem(budgetItemId, {
              quantity: expandedItem.quantity,
              notes: expandedItem.notes
            });
          } catch (err) {
            console.error('Error saving budget item:', budgetItemId, err);
            errors.push(expandedItem.name);
          }
        }
      }
      
      // Update expandedItems to replace virtual IDs with real IDs
      if (createdItems.length > 0) {
        setExpandedItems(prev => prev.map(item => {
          const created = createdItems.find(c => c.oldId === item.budgetItemId);
          if (created) {
            return { ...item, budgetItemId: created.newId };
          }
          return item;
        }));
        
        // Track which budget items have LED cases so they reload on next open
        const newLedItemsWithCases = new Set(ledItemsWithCases);
        for (const budgetItemId of modifiedItems) {
          const hasNewCases = createdItems.some(c => c.oldId.startsWith(`${budgetItemId}-case-`));
          if (hasNewCases) {
            newLedItemsWithCases.add(budgetItemId);
          }
        }
        setLedItemsWithCases(newLedItemsWithCases);
      }
      
      if (errors.length > 0) {
        showNotification('Ошибка при сохранении: ' + errors.join(', '));
      } else {
        setModifiedItems(new Set());
        showNotification('Изменения сохранены', 'success');
        // Перезагружаем данные после успешного сохранения, чтобы получить реальные ID из базы
        await loadData();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      showNotification('Ошибка при сохранении изменений');
    } finally {
      setSavingChanges(false);
    }
  };

  const handleAddCableFromTemplate = async (cableType: string, cableLength: string) => {
    try {
      const existingCable = cables.find(c => c.cable_type === cableType && c.cable_length === cableLength);

      if (existingCable) {
        const updated = await updateCable(existingCable.id, {
          quantity: existingCable.quantity + 1
        });
        setCables(cables.map(c => c.id === updated.id ? updated : c));
      } else {
        const newCable = await createCable({
          event_id: eventId,
          cable_type: cableType,
          cable_length: cableLength,
          quantity: 1,
          notes: '',
          picked: false
        });
        setCables([...cables, newCable]);
      }
    } catch (error) {
      console.error('Error adding cable:', error);
      showNotification('Ошибка при добавлении кабеля');
    }
  };

  const handleCableQuantityChange = async (id: string, newQuantity: number) => {
    try {
      if (newQuantity === 0) {
        await deleteCable(id);
        setCables(cables.filter(c => c.id !== id));
      } else {
        const updated = await updateCable(id, { quantity: newQuantity });
        setCables(cables.map(c => c.id === updated.id ? updated : c));
      }
    } catch (error) {
      console.error('Error updating cable:', error);
      showNotification('Ошибка при обновлении кабеля');
    }
  };

  const handleAddConnectorFromTemplate = async (connectorType: string) => {
    try {
      const existingConnector = connectors.find(c => c.connector_type === connectorType);

      if (existingConnector) {
        const updated = await updateConnector(existingConnector.id, {
          quantity: existingConnector.quantity + 1
        });
        setConnectors(connectors.map(c => c.id === updated.id ? updated : c));
      } else {
        const newConnector = await createConnector({
          event_id: eventId,
          connector_type: connectorType,
          quantity: 1,
          notes: '',
          picked: false
        });
        setConnectors([...connectors, newConnector]);
      }
    } catch (error) {
      console.error('Error adding connector:', error);
      showNotification('Ошибка при добавлении коннектора');
    }
  };

  const handleConnectorQuantityChange = async (id: string, newQuantity: number) => {
    try {
      if (newQuantity === 0) {
        await deleteConnector(id);
        setConnectors(connectors.filter(c => c.id !== id));
      } else {
        const updated = await updateConnector(id, { quantity: newQuantity });
        setConnectors(connectors.map(c => c.id === updated.id ? updated : c));
      }
    } catch (error) {
      console.error('Error updating connector:', error);
      showNotification('Ошибка при обновлении коннектора');
    }
  };

  const toggleCableType = (type: string) => {
    setExpandedCableTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const toggleConnectorCategory = (category: string) => {
    setExpandedConnectorCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const toggleOtherCategory = (category: string) => {
    setExpandedOtherCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleAddOtherFromTemplate = async (category: string, itemType: string) => {
    try {
      const existingItem = otherItems.find(
        i => i.category === category && i.item_type === itemType
      );

      if (existingItem) {
        const updated = await updateOtherItem(existingItem.id, {
          quantity: existingItem.quantity + 1
        });
        setOtherItems(otherItems.map(i => i.id === updated.id ? updated : i));
      } else {
        const newItem = await createOtherItem({
          event_id: eventId,
          category,
          item_type: itemType,
          quantity: 1,
          notes: '',
          picked: false
        });
        setOtherItems([...otherItems, newItem]);
      }
    } catch (error) {
      console.error('Error adding other item:', error);
      showNotification('Ошибка при добавлении предмета');
    }
  };

  const handleOtherQuantityChange = async (id: string, newQuantity: number) => {
    try {
      if (newQuantity === 0) {
        await deleteOtherItem(id);
        setOtherItems(otherItems.filter(i => i.id !== id));
      } else {
        const updated = await updateOtherItem(id, { quantity: newQuantity });
        setOtherItems(otherItems.map(i => i.id === updated.id ? updated : i));
      }
    } catch (error) {
      console.error('Error updating other item:', error);
      showNotification('Ошибка при обновлении предмета');
    }
  };

  const handleOtherPickedChange = async (id: string, picked: boolean) => {
    try {
      const updated = await updateOtherItem(id, { picked });
      setOtherItems(otherItems.map(i => i.id === updated.id ? updated : i));
    } catch (error) {
      console.error('Error updating other item picked status:', error);
      showNotification('Ошибка при обновлении статуса');
    }
  };

  const getOtherQuantity = (category: string, itemType: string) => {
    const item = otherItems.find(i => i.category === category && i.item_type === itemType);
    return item?.quantity || 0;
  };

  const getOtherId = (category: string, itemType: string) => {
    const item = otherItems.find(i => i.category === category && i.item_type === itemType);
    return item?.id;
  };

  const getOtherNotes = (category: string, itemType: string) => {
    const item = otherItems.find(i => i.category === category && i.item_type === itemType);
    return item?.notes || '';
  };

  const getOtherPicked = (category: string, itemType: string) => {
    const item = otherItems.find(i => i.category === category && i.item_type === itemType);
    return item?.picked || false;
  };

  const handleExportBudget = () => {
    const csvRows = [['№', 'Наименование', 'Артикул', 'Локация', 'Категория', 'Количество', 'Ед. изм.', 'Взято', 'Примечания']];
    
    let globalIndex = 1;
    locationGroups.forEach(locationGroup => {
      locationGroup.categories.forEach(categoryGroup => {
        categoryGroup.items.forEach(item => {
          csvRows.push([
            String(globalIndex++),
            `"${item.name}"`,
            item.sku,
            `"${item.locationName || locationGroup.locationName || ''}"`,
            `"${categoryGroup.categoryName}"`,
            String(item.quantity),
            item.unit,
            item.picked ? 'Да' : 'Нет',
            `"${item.notes}"`
          ]);
        });
      });
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    downloadCSV(csvContent, `Спецификация_Смета_${eventName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportCables = () => {
    const csvContent = [
      ['№', 'Тип кабеля', 'Длина', 'Количество', 'Взято', 'Примечания'].join(','),
      ...cables.map((cable, index) =>
        [
          index + 1,
          `"${cable.cable_type}"`,
          cable.cable_length,
          cable.quantity,
          cable.picked ? 'Да' : 'Нет',
          `"${cable.notes}"`
        ].join(',')
      )
    ].join('\n');

    downloadCSV(csvContent, `Спецификация_Кабели_${eventName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportConnectors = () => {
    const csvContent = [
      ['№', 'Категория', 'Тип коннектора', 'Количество', 'Взято', 'Примечания'].join(','),
      ...connectors.map((connector, index) =>
        [
          index + 1,
          `"${connector.connector_type}"`,
          `"${connector.connector_type}"`,
          connector.quantity,
          connector.picked ? 'Да' : 'Нет',
          `"${connector.notes}"`
        ].join(',')
      )
    ].join('\n');

    downloadCSV(csvContent, `Спецификация_Коннекторы_${eventName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportOther = () => {
    const csvContent = [
      ['№', 'Категория', 'Предмет', 'Количество', 'Взято', 'Примечания'].join(','),
      ...otherItems.map((item, index) =>
        [
          index + 1,
          `"${item.category}"`,
          `"${item.item_type}"`,
          item.quantity,
          item.picked ? 'Да' : 'Нет',
          `"${item.notes}"`
        ].join(',')
      )
    ].join('\n');

    downloadCSV(csvContent, `Спецификация_Прочее_${eventName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCableQuantity = (cableType: string, cableLength: string) => {
    const cable = cables.find(c => c.cable_type === cableType && c.cable_length === cableLength);
    return cable?.quantity || 0;
  };

  const getCableId = (cableType: string, cableLength: string) => {
    const cable = cables.find(c => c.cable_type === cableType && c.cable_length === cableLength);
    return cable?.id;
  };

  const getCablePicked = (cableType: string, cableLength: string) => {
    const cable = cables.find(c => c.cable_type === cableType && c.cable_length === cableLength);
    return cable?.picked || false;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="text-center text-gray-400">Загрузка спецификации...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 md:p-4">
      <div className="bg-gray-900 border border-gray-800 md:rounded-lg shadow-xl w-full md:w-[95vw] md:max-w-[1400px] h-full md:h-auto md:max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 leading-tight">
              <Package className="w-5 h-5 text-cyan-500" />
              Спецификация
            </h2>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-gray-400 font-medium truncate max-w-[300px]">{eventName}</p>
              {eventDetails && (
                <>
                  <p className="text-[10px] text-gray-500">
                    {eventDetails.venues?.name} • {new Date(eventDetails.event_date).toLocaleDateString('ru-RU')}
                  </p>
                  {eventDetails.specification_confirmed && (
                    <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 border border-green-600/30 rounded text-[10px] font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Подтверждено
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-800 bg-gray-900/50">
          <div className="flex gap-2 px-4 overflow-x-auto">
            {(['budget', 'cables', 'connectors', 'other'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'budget' ? 'Основное' : tab === 'cables' ? 'Кабеля' : tab === 'connectors' ? 'Коннекторы' : 'Прочее'}
              </button>
            ))}
            {eventDetails?.equipment_shipped && (
              <button
                onClick={() => setActiveTab('extra')}
                className={`py-2 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === 'extra'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-orange-500/60 hover:text-orange-400'
                }`}
              >
                Добор
                {extraItems.length > 0 && (
                  <span className="ml-1 px-1 py-0.5 bg-orange-900/40 text-orange-400 rounded text-[9px] font-bold">
                    {extraItems.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'budget' && (
            <>
              <div className="mb-3 flex justify-between items-center">
                {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                  <button
                    onClick={() => openEquipmentSelectorForCategory(null, null)}
                    className="px-3 py-1.5 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Добавить оборудование
                  </button>
                )}
                {eventDetails?.equipment_shipped && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-900/20 border border-orange-800/40 rounded text-xs text-orange-400">
                    <Truck className="w-3.5 h-3.5" />
                    Отгружено — редактирование заблокировано. Для добавления используйте вкладку Добор.
                  </div>
                )}
              </div>

              {locationGroups.map((locationGroup) => (
                <div key={locationGroup.locationId || 'no-location'} className="mb-5">
                  {locationGroup.locationName && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2 border border-gray-800 bg-gray-800/40">
                      <span className="w-2 h-6 rounded-full" style={{ backgroundColor: locationGroup.locationColor }} />
                      <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                        {locationGroup.locationName}
                      </h3>
                    </div>
                  )}
                  {locationGroup.categories.map((group) => (
                    <div key={`${locationGroup.locationId || 'no-location'}-${group.categoryName}`} className="mb-3">
                      <div className="mb-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            {group.categoryName}
                          </h4>
                          {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                            <button
                              onClick={() => openEquipmentSelectorForCategory(group.categoryId, locationGroup.locationId)}
                              className="p-0.5 text-cyan-500 hover:text-cyan-300 transition-colors"
                              title="Добавить оборудование в категорию"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-800">
                        <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                          {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                            <th className="px-3 py-1.5 text-center w-12 text-[10px] text-green-500 uppercase tracking-wider" title="Принято">↩</th>
                          ) : (
                            <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500 uppercase tracking-wider">✓</th>
                          )}
                          <th className="px-3 py-1.5 text-left w-12 text-[10px] text-gray-500 uppercase tracking-wider">№</th>
                          <th className="px-3 py-1.5 text-left text-[10px] text-gray-500 uppercase tracking-wider">Наименование</th>
                          <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500 uppercase tracking-wider">Кол-во</th>
                          <th className="px-3 py-1.5 text-left w-20 text-[10px] text-gray-500 uppercase tracking-wider">Ед. изм.</th>
                          {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                            <th className="px-3 py-1.5 text-left text-[10px] text-gray-500 uppercase tracking-wider">Примечания</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {group.items.map((item, index) => (
                          <tr key={`${item.budgetItemId}-${index}`} className={`${item.isFromComposition ? 'bg-cyan-900/10' : 'bg-gray-900'} hover:bg-gray-800 transition-colors`}>
                            <td className="px-3 py-1.5 text-center">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <input
                                  type="checkbox"
                                  checked={item.return_picked}
                                  onChange={(e) => handleReturnPickedChange(item.budgetItemId, e.target.checked)}
                                  className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600 focus:ring-offset-gray-900"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={item.picked}
                                  onChange={(e) => handlePickedChange(item.budgetItemId, e.target.checked)}
                                  className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600 focus:ring-offset-gray-900"
                                  disabled={!eventDetails?.specification_confirmed || !!eventDetails?.equipment_shipped}
                                />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center text-xs text-gray-500">{index + 1}</td>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="text-xs text-white font-medium">{item.name}</div>
                                  {item.parentName && (
                                    <div className="text-[10px] text-cyan-500 mt-0.5">
                                      ↳ {item.parentName}
                                    </div>
                                  )}
                                </div>
                                {!eventDetails?.equipment_shipped && !item.isFromComposition && hasModifications(item.budgetItemId) && (
                                  <button
                                    onClick={() => {
                                      const budgetItem = budgetItems.find(b => b.id === item.budgetItemId);
                                      if (budgetItem) {
                                        handleOpenModificationSelector(budgetItem);
                                      }
                                    }}
                                    className="p-1 text-cyan-500 hover:text-cyan-400 transition-colors"
                                    title="Выбрать модификацию"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isLedScreenItem(item) && (
                                  <button
                                    onClick={() => setShowLedSpecification(item.budgetItemId === showLedSpecification ? null : item.budgetItemId)}
                                    className="p-1 text-green-500 hover:text-green-400 transition-colors"
                                    title="Спецификация модулей"
                                  >
                                    <Calculator className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isPodiumItem(item) && (
                                  <button
                                    onClick={() => setShowPodiumSpecification(item.budgetItemId === showPodiumSpecification ? null : item.budgetItemId)}
                                    className="p-1 text-cyan-500 hover:text-cyan-400 transition-colors"
                                    title="Спецификация подиума"
                                  >
                                    <Calculator className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {eventDetails?.equipment_shipped ? (
                                <span className="text-xs text-white font-bold">{item.quantity}</span>
                              ) : (
                                <div className="flex justify-center items-center gap-1">
                                  <button
                                    onClick={() => handleQuantityChange(item.budgetItemId, item.quantity - 1)}
                                    disabled={item.quantity === 0}
                                    className="p-0.5 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                  >
                                    <Minus className="w-5 h-5" />
                                  </button>
                                  <span className="text-xs text-white font-bold w-6 text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => handleQuantityChange(item.budgetItemId, item.quantity + 1)}
                                    className="p-0.5 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                  >
                                    <Plus className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => requestDeleteSpecificationItem(item.budgetItemId, item.name)}
                                    className="p-0.5 text-red-500/60 hover:text-red-400 transition-colors"
                                    title="Удалить элемент"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{item.unit}</td>
                            {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => handleNotesChange(item.budgetItemId, e.target.value)}
                                  className="w-full px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-300 focus:outline-none focus:border-cyan-500"
                                  placeholder="..."
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {mainItems.length === 0 && (
                <div className="text-center py-12 text-gray-600 border-2 border-dashed border-gray-800 rounded-lg">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Спецификация пуста</p>
                </div>
              )}

              {showLedSpecification && (
                <LedSpecificationPanel
                  budgetItemId={showLedSpecification}
                  onSaveWithCases={(cases) => handleLedCasesCalculated(showLedSpecification, cases)}
                  budgetItems={budgetItems}
                  allBudgetItems={budgetItems}
                  eventId={eventId}
                  onClose={() => {
                    setShowLedSpecification(null);
                    // НЕ вызываем loadData() здесь, чтобы сохранить временные кейсы в expandedItems
                    // loadData() будет вызван только после сохранения через handleSaveChanges
                  }}
                />
              )}

              {showPodiumSpecification && (
                <PodiumSpecificationPanel
                  budgetItemId={showPodiumSpecification}
                  budgetItems={budgetItems}
                  eventId={eventId}
                  onClose={() => setShowPodiumSpecification(null)}
                  onSaveWithComposition={(selectedModules) => {
                    handlePodiumCompositionCalculated(showPodiumSpecification, selectedModules);
                    setShowPodiumSpecification(null);
                  }}
                />
              )}
            </>
          )}

          {activeTab === 'cables' && (
            <>
              <div className="space-y-2">
                {CABLE_TEMPLATES.map((template) => (
                  <div key={template.type} className="border border-gray-800 rounded">
                    <button
                      onClick={() => toggleCableType(template.type)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{template.type}</h3>
                      {expandedCableTypes[template.type] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {expandedCableTypes[template.type] && (
                      <div className="p-2">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Длина</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.lengths.map((length) => {
                              const cableObj = cables.find(c => c.cable_type === template.type && c.cable_length === length);
                              const quantity = cableObj?.quantity || 0;
                              const cableId = cableObj?.id;
                              const picked = cableObj?.picked || false;
                              const returnPicked = cableObj?.return_picked || false;

                              return (
                                <tr key={length} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {cableId && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                      <input
                                        type="checkbox"
                                        checked={returnPicked}
                                        onChange={(e) => handleCableReturnPickedChange(cableId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                      />
                                    ) : cableId ? (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleCablePickedChange(cableId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={!eventDetails?.specification_confirmed || !!eventDetails?.equipment_shipped}
                                      />
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{length}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {cableId ? (
                                      (isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={inputDraftValues[`cable_${cableId}`] !== undefined ? inputDraftValues[`cable_${cableId}`] : quantity}
                                          onChange={(e) => setInputDraftValues(prev => ({ ...prev, [`cable_${cableId}`]: e.target.value }))}
                                          onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) handleCableQuantityChange(cableId, val);
                                            setInputDraftValues(prev => { const n = { ...prev }; delete n[`cable_${cableId}`]; return n; });
                                          }}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => cableId && handleCableQuantityChange(cableId, Math.max(0, quantity - 1))}
                                          disabled={!cableId || quantity === 0}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={() => handleAddCableFromTemplate(template.type, length)}
                                          className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                        >
                                          <Plus className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'connectors' && (
            <>
              <div className="space-y-2">
                {CONNECTOR_TEMPLATES.map((template) => (
                  <div key={template.category} className="border border-gray-800 rounded">
                    <button
                      onClick={() => toggleConnectorCategory(template.category)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{template.category}</h3>
                      {expandedConnectorCategories[template.category] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {expandedConnectorCategories[template.category] && (
                      <div className="p-2">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Тип</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const connectorEntries = connectors.filter(c => c.connector_type === itemType);
                              const connector = connectorEntries[0];
                              const quantity = connectorEntries.reduce((sum, c) => sum + c.quantity, 0);
                              const picked = connectorEntries.length > 0 && connectorEntries.every(c => c.picked);
                              const returnPicked = connectorEntries.length > 0 && connectorEntries.every(c => c.return_picked);

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {connector && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                      <input
                                        type="checkbox"
                                        checked={returnPicked}
                                        onChange={(e) => handleConnectorGroupReturnPickedChange(itemType, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                      />
                                    ) : connector ? (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleConnectorGroupPickedChange(itemType, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={!eventDetails?.specification_confirmed || !!eventDetails?.equipment_shipped}
                                      />
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemType}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {connector ? (
                                      (isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={inputDraftValues[`connector_${connector.id}`] !== undefined ? inputDraftValues[`connector_${connector.id}`] : quantity}
                                          onChange={(e) => setInputDraftValues(prev => ({ ...prev, [`connector_${connector.id}`]: e.target.value }))}
                                          onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) handleConnectorQuantityChange(connector.id, val);
                                            setInputDraftValues(prev => { const n = { ...prev }; delete n[`connector_${connector.id}`]; return n; });
                                          }}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => connector && handleConnectorQuantityChange(connector.id, Math.max(0, quantity - 1))}
                                          disabled={!connector || quantity === 0}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={() => handleAddConnectorFromTemplate(itemType)}
                                          className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                        >
                                          <Plus className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'other' && (
            <>
              <div className="space-y-2">
                {OTHER_TEMPLATES.map((template) => (
                  <div key={template.category} className="border border-gray-800 rounded">
                    <button
                      onClick={() => toggleOtherCategory(template.category)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{template.category}</h3>
                      {expandedOtherCategories[template.category] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {expandedOtherCategories[template.category] && (
                      <div className="p-2">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Предмет</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const otherObj = otherItems.find(i => i.category === template.category && i.item_type === itemType);
                              const otherId = otherObj?.id;
                              const quantity = otherObj?.quantity || 0;
                              const picked = otherObj?.picked || false;
                              const returnPicked = otherObj?.return_picked || false;

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {otherId && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                      <input
                                        type="checkbox"
                                        checked={returnPicked}
                                        onChange={(e) => handleOtherReturnPickedChange(otherId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                      />
                                    ) : otherId ? (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleOtherPickedChange(otherId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={!eventDetails?.specification_confirmed || !!eventDetails?.equipment_shipped}
                                      />
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemType}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {otherId ? (
                                      (isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={inputDraftValues[`other_${otherId}`] !== undefined ? inputDraftValues[`other_${otherId}`] : quantity}
                                          onChange={(e) => setInputDraftValues(prev => ({ ...prev, [`other_${otherId}`]: e.target.value }))}
                                          onBlur={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) handleOtherQuantityChange(otherId, val);
                                            setInputDraftValues(prev => { const n = { ...prev }; delete n[`other_${otherId}`]; return n; });
                                          }}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => otherId && handleOtherQuantityChange(otherId, Math.max(0, quantity - 1))}
                                          disabled={!otherId || quantity === 0}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={() => handleAddOtherFromTemplate(template.category, itemType)}
                                          className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                        >
                                          <Plus className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'extra' && (
            <>
              <div className="mb-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEquipmentSelector(true)}
                    className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Добавить в добор
                  </button>
                  <span className="text-[10px] text-gray-500">Оборудование, забытое при первоначальной загрузке</span>
                </div>
              </div>

              {extraLocationGroups.length > 0 ? extraLocationGroups.map((locationGroup) => (
                <div key={locationGroup.locationId || `extra-no-location`} className="mb-4">
                  {locationGroup.locationName && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2 border border-orange-900/30 bg-orange-900/10">
                      <span className="w-2 h-6 rounded-full" style={{ backgroundColor: locationGroup.locationColor }} />
                      <h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider">{locationGroup.locationName}</h3>
                    </div>
                  )}
                  {locationGroup.categories.map((group) => (
                    <div key={`${locationGroup.locationId || 'no-location'}-extra-${group.categoryName}`} className="mb-3">
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">{group.categoryName}</h4>
                      <div className="overflow-x-auto rounded border border-orange-900/40">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-orange-900/10 border-b border-orange-900/30">
                          {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                            <th className="px-3 py-1.5 text-center w-12 text-[10px] text-green-500" title="Принято">↩</th>
                          ) : (
                            <th className="px-3 py-1.5 text-center w-12 text-[10px] text-orange-500">✓</th>
                          )}
                          <th className="px-3 py-1.5 text-left w-12 text-[10px] text-gray-500 uppercase">№</th>
                          <th className="px-3 py-1.5 text-left text-[10px] text-gray-500 uppercase">Наименование</th>
                          <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500 uppercase">Кол-во</th>
                          <th className="px-3 py-1.5 text-left w-20 text-[10px] text-gray-500 uppercase">Ед. изм.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-900/20">
                        {group.items.map((item, index) => (
                          <tr key={`${item.budgetItemId}-${index}`} className="bg-orange-900/5 hover:bg-orange-900/15 transition-colors">
                            <td className="px-3 py-1.5 text-center">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <input
                                  type="checkbox"
                                  checked={item.return_picked}
                                  onChange={(e) => handleReturnPickedChange(item.budgetItemId, e.target.checked)}
                                  className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={item.picked}
                                  onChange={(e) => handlePickedChange(item.budgetItemId, e.target.checked)}
                                  className="w-4 h-4 cursor-pointer rounded border-orange-700 bg-gray-800 text-orange-600"
                                  disabled={!eventDetails?.specification_confirmed || !!eventDetails?.equipment_shipped}
                                />
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center text-xs text-gray-500">{index + 1}</td>
                            <td className="px-3 py-1.5">
                              <div className="text-xs text-white font-medium">{item.name}</div>
                              {item.parentName && (
                                <div className="text-[10px] text-orange-400 mt-0.5">↳ {item.parentName}</div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-center text-xs text-white font-bold">{item.quantity}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                      </div>
                    </div>
                  ))}
                </div>
              )) : (
                <div className="text-center py-12 text-gray-600 border-2 border-dashed border-orange-900/30 rounded-lg">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Список добора пуст</p>
                  <p className="text-xs mt-1 text-gray-700">Добавьте оборудование, которое не вошло в первоначальную загрузку</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-800 p-3 bg-gray-900/80 flex flex-wrap justify-end items-center gap-2">
          <div className="flex flex-wrap gap-2 w-full justify-end">
            {modifiedItems.size > 0 && !eventDetails?.equipment_shipped && (
              <button
                onClick={handleSaveChanges}
                disabled={savingChanges}
                className="px-3 py-1.5 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {savingChanges ? (
                  <>...</>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Сохранить
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
            >
              Закрыть
            </button>
            {!eventDetails?.specification_confirmed && (
              <button
                onClick={() => setShowSpecificationConfirmDialog(true)}
                disabled={confirming}
                className="px-3 py-1.5 bg-green-700 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {confirming ? <>...</> : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Подтвердить спецификацию
                  </>
                )}
              </button>
            )}
            {eventDetails?.specification_confirmed && !eventDetails?.equipment_shipped && (
              <button
                onClick={handleConfirmShipment}
                disabled={confirmingShipment}
                title={!allPickedForShipment ? 'Проставьте все галочки перед отгрузкой' : undefined}
                className="px-3 py-1.5 bg-red-700 text-white text-xs rounded hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {confirmingShipment ? <>...</> : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    Подтвердить отгрузку
                  </>
                )}
              </button>
            )}
            {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned && (
              <button
                onClick={handleConfirmReturn}
                disabled={confirmingReturn}
                title={!allPickedForReturn ? 'Проставьте все галочки перед приёмкой' : undefined}
                className="px-3 py-1.5 bg-green-700 text-white text-xs rounded hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {confirmingReturn ? <>...</> : (
                  <>
                    <Truck className="w-3.5 h-3.5" style={{ transform: 'scaleX(-1)' }} />
                    Оборудование принято
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showModificationSelector && selectedBudgetItemForMod && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Выбор модификации</h3>
              <button
                onClick={() => setShowModificationSelector(false)}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Оборудование</label>
                <div className="text-white font-medium text-sm">{selectedBudgetItemForMod.equipment?.name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Модификации</label>
                {loadingModifications ? (
                  <div className="text-gray-500 text-xs py-2">Загрузка модификаций...</div>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {equipmentModifications[selectedBudgetItemForMod.equipment_id || '']?.length > 0 ? (
                      equipmentModifications[selectedBudgetItemForMod.equipment_id || ''].map((mod) => (
                        <button
                          key={mod.id}
                          onClick={() => handleModificationSelect(mod)}
                          className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded transition-colors"
                        >
                          <div className="font-medium">{mod.name}</div>
                          {mod.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{mod.description}</div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="text-gray-500 text-xs">Нет доступных модификаций</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowModificationSelector(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingConfirmMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {pendingConfirmMode === 'shipment' ? 'Нельзя подтвердить отгрузку' : 'Нельзя подтвердить приёмку'}
              </h3>
              <button
                onClick={() => {
                  setPendingConfirmMode(null);
                  setPendingConfirmItems([]);
                }}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-gray-300">
                Проставьте галочки для следующих позиций:
              </p>
              <ul className="space-y-1.5 text-sm text-gray-200">
                {pendingConfirmItems.map(item => (
                  <li key={item.id} className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>
                      {item.name}
                      <span className="text-gray-500"> ({item.group === 'equipment' ? 'Оборудование' : item.group === 'cables' ? 'Кабели' : item.group === 'connectors' ? 'Коннекторы' : 'Прочее'})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => {
                  setPendingConfirmMode(null);
                  setPendingConfirmItems([]);
                }}
                className="px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {showComponentsDialog && selectedModification && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Компоненты модификации: {selectedModification.name}</h3>
              <button
                onClick={() => {
                  setShowComponentsDialog(false);
                  setSelectedModification(null);
                  setModificationComponents([]);
                  setComponentQuantities({});
                }}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-[10px] text-gray-500 uppercase tracking-wider">Наименование</th>
                    <th className="px-3 py-2 text-center w-24 text-[10px] text-gray-500 uppercase tracking-wider">Количество</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {modificationComponents.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-800 transition-colors">
                      <td className="px-3 py-2">
                        <div className="text-xs text-white font-medium">{comp.component?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          value={componentQuantities[comp.id] || 0}
                          onChange={(e) => handleComponentQuantityChange(comp.id, parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                          min="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowComponentsDialog(false);
                  setSelectedModification(null);
                  setModificationComponents([]);
                  setComponentQuantities({});
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveComponents}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 transition-colors"
              >
                Добавить компоненты
              </button>
            </div>
          </div>
        </div>
      )}

      {showEquipmentSelector && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {activeTab === 'extra' ? 'Добавить в добор' : 'Добавить оборудование'}
              </h3>
              <button
                onClick={() => {
                  setShowEquipmentSelector(false);
                  setAddEquipmentTarget({ categoryId: null, locationId: null });
                }}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <EquipmentSelector
              onSelect={activeTab === 'extra' ? handleAddExtraEquipment : handleAddEquipment}
              onClose={() => {
                setShowEquipmentSelector(false);
                setAddEquipmentTarget({ categoryId: null, locationId: null });
              }}
            />
          </div>
        </div>
      )}

      {showSpecificationConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Подтвердить спецификацию
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              После подтверждения спецификация будет доступна всем для просмотра.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowSpecificationConfirmDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmSpecification}
                disabled={confirming}
                className="flex-1 px-4 py-2 bg-green-700 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {confirming ? '...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingQuantityChange && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Подтверждение изменения
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Изменить количество для{' '}
              <span className="text-white font-medium">«{pendingQuantityChange.itemName}»</span>{' '}
              с <span className="text-white font-semibold">{pendingQuantityChange.fromQuantity}</span> на{' '}
              <span className="text-white font-semibold">{pendingQuantityChange.toQuantity}</span>?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={cancelQuantityChange}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={applyQuantityChange}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
              Подтверждение удаления
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Удалить элемент <span className="text-white font-medium">«{pendingDeleteItem.itemName}»</span> из спецификации?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPendingDeleteItem(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  const target = pendingDeleteItem;
                  setPendingDeleteItem(null);
                  if (target) {
                    await handleDeleteSpecificationItem(target.budgetItemId);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-700 text-white text-xs rounded hover:bg-red-600 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-4 right-4 z-[80] max-w-sm">
          <div
            className={`px-4 py-3 rounded-lg border text-sm shadow-lg ${
              notification.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
                : 'bg-red-900/90 border-red-700 text-red-100'
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}
    </div>
  );
}
