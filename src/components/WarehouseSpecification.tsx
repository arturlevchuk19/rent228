import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Package, Download, ChevronDown, ChevronRight, CheckCircle, Layers, Calculator, Save } from 'lucide-react';
import { BudgetItem, getBudgetItems, getEvent, updateBudgetItemPicked, confirmSpecification, createBudgetItem, updateBudgetItem } from '../lib/events';
import { EquipmentItem, getEquipmentItems, getEquipmentModifications, EquipmentModification, ModificationComponent } from '../lib/equipment';
import { getEquipmentCompositions } from '../lib/equipmentCompositions';
import { Category, getCategories } from '../lib/categories';
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
  deleteCable,
  getConnectors,
  createConnector,
  updateConnector,
  deleteConnector,
  getOtherItems,
  createOtherItem,
  updateOtherItem,
  deleteOtherItem
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
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  category: string;
  notes: string;
  picked: boolean;
  isFromComposition: boolean;
  parentName?: string;
}

type TabType = 'budget' | 'cables' | 'connectors' | 'other';

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
  const [loading, setLoading] = useState(true);
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
  const [allEquipment, setAllEquipment] = useState<EquipmentItem[]>([]);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [expandedCableTypes, setExpandedCableTypes] = useState<Record<string, boolean>>({});
  const [expandedConnectorCategories, setExpandedConnectorCategories] = useState<Record<string, boolean>>({});
  const [expandedOtherCategories, setExpandedOtherCategories] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
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

  const isLedScreenItem = (item: ExpandedItem) => {
    const category = item.category || '';
    const name = item.name || '';
    const notes = item.notes || '';
    
    return (category === 'Видео' && (name.includes('LED') || name.includes('Светодиодный экран') ||
             name.includes('P2,6') || name.includes('P3,91'))) ||
           notes.includes('м.кв.') || notes.includes('×') || notes.includes('x') ||
           notes.match(/\d+\s*м²/);
  };

  const isLedScreenBudgetItem = (item: BudgetItem) => {
    const category = item.equipment?.category || '';
    const name = item.equipment?.name || '';
    const notes = item.notes || '';
    
    return (category === 'Видео' && (name.includes('LED') || name.includes('Светодиодный экран') ||
             name.includes('P2,6') || name.includes('P3,91'))) ||
           notes.includes('м.кв.') || notes.includes('×') || notes.includes('x') ||
           notes.match(/\d+\s*м²/);
  };

  const isPodiumItem = (item: ExpandedItem) => {
    const name = (item.name || "").toLowerCase();
    return name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов");
  };

  const isPodiumBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов");
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

  const groups = categories
    .map(cat => ({
      name: cat.name,
      items: expandedItems.filter(item => item.categoryId === cat.id)
    }))
    .filter(g => g.items.length > 0);

  const uncategorizedItemsForGroups = expandedItems.filter(item => !item.categoryId);
  if (uncategorizedItemsForGroups.length > 0) {
    groups.push({ name: 'Без категории', items: uncategorizedItemsForGroups });
  }

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetData, categoriesData, equipmentData, event, cablesData, connectorsData, otherData] = await Promise.all([
        getBudgetItems(eventId),
        getCategories(),
        getEquipmentItems(),
        getEvent(eventId),
        getCables(eventId),
        getConnectors(eventId),
        getOtherItems(eventId)
      ]);

      setCategories(categoriesData);
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

      for (const item of budgetData) {
        if (item.item_type !== 'equipment') continue;

        // Handle child items (e.g., LED cases) - show them as composition items
        if (item.parent_budget_item_id) {
          const parentItem = budgetData.find(b => b.id === item.parent_budget_item_id);

          items.push({
            budgetItemId: item.id,
            categoryId: item.category_id || null,
            name: item.name || 'Кейс',
            sku: item.sku || '',
            quantity: item.quantity,
            unit: 'шт.',
            category: parentItem?.equipment?.category || 'Видео',
            notes: item.notes || '',
            picked: item.picked || false,
            isFromComposition: true,
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
            name: item.equipment?.name || item.name || 'Unknown',
            sku: item.equipment?.sku || item.sku || '',
            quantity: item.quantity,
            unit: 'шт.',
            category: item.equipment?.category || 'Other',
            notes: item.notes || '',
            picked: item.picked || false,
            isFromComposition: isSavedVirtualItem
          });
        } else {
          // Virtual item - check if it's an LED screen
          if (isLedScreenBudgetItem(item)) {
            // LED screen: add as single item, don't expand
            items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              name: item.equipment?.name || 'Unknown',
              sku: item.equipment?.sku || '',
              quantity: item.quantity,
              unit: 'шт.',
              category: item.equipment?.category || 'Other',
              notes: item.notes || '',
              picked: item.picked || false,
              isFromComposition: false
            });

            // Кейсы для LED экранов добавляются только после нажатия "Сохранить" в LedSpecificationPanel
          } else if (isPodiumBudgetItem(item)) {
             items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              name: item.name || item.equipment?.name || "Unknown",
              sku: item.equipment?.sku || "",
              quantity: item.quantity,
              unit: "шт.",
              category: item.equipment?.category || "Other",
              notes: item.notes || "",
              picked: item.picked || false,
              isFromComposition: false
            });
            
            if (item.equipment_id) {
              try {
                const compositions = await getEquipmentCompositions(item.equipment_id);
                for (const comp of compositions) {
                  items.push({
                    budgetItemId: `${item.id}-comp-${comp.id}`,
                    categoryId: item.category_id || null,
                    name: comp.child_name || "Unknown",
                    sku: comp.child_sku || "",
                    quantity: item.quantity * comp.quantity,
                    unit: "шт.",
                    category: comp.child_category || "Components",
                    notes: item.notes || "",
                    picked: item.picked || false,
                    isFromComposition: true,
                    parentName: item.name || item.equipment?.name
                  });
                }
              } catch (error) {
                console.error("Error loading composition for", item.name || item.equipment?.name, ":", error);
              }
            }
          } else {
            // Non-LED virtual item - expand it into its components
            // Check for composition
            if (item.equipment_id) {
              try {
                const compositions = await getEquipmentCompositions(item.equipment_id);
                for (const comp of compositions) {
                  items.push({
                    budgetItemId: `${item.id}-comp-${comp.id}`,
                    categoryId: item.category_id || null,
                    name: comp.child_name || 'Unknown',
                    sku: comp.child_sku || '',
                    quantity: item.quantity * comp.quantity,
                    unit: 'шт.',
                    category: comp.child_category || 'Components',
                    notes: item.notes || '',
                    picked: item.picked || false,
                    isFromComposition: true,
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
                for (const component of components) {
                  items.push({
                    budgetItemId: `${item.id}-mod-${component.id}`,
                    categoryId: item.category_id || null,
                    name: component.component?.name || 'Unknown',
                    sku: component.component?.sku || '',
                    quantity: item.quantity * component.quantity,
                    unit: 'шт.',
                    category: component.component?.category || 'Modification Components',
                    notes: item.notes || '',
                    picked: item.picked || false,
                    isFromComposition: true,
                    parentName: item.equipment?.name
                  });
                }
              } catch (error) {
                console.error('Error loading modification components:', error);
              }
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

    if (ledItemsWithCases.has(budgetItemId)) {
      console.log('Removing existing cases for this LED item');
      setExpandedItems(prev => prev.filter(item => !item.budgetItemId.startsWith(`${budgetItemId}-case-`)));
    }

    const newCaseItems: ExpandedItem[] = cases.map(calculatedCase => ({
      budgetItemId: `${budgetItemId}-case-${calculatedCase.caseId}`,
      categoryId: budgetItem.category_id || null,
      name: calculatedCase.name,
      sku: calculatedCase.sku,
      quantity: calculatedCase.caseCount,
      unit: 'шт.',
      category: calculatedCase.category,
      notes: `Кейс для ${calculatedCase.modulesCount} шт. модулей`,
      picked: budgetItem.picked || false,
      isFromComposition: true,
      parentName: budgetItem.equipment?.name
    }));

    console.log('Created case items:', newCaseItems);

    const ledItemIndex = expandedItems.findIndex(item => item.budgetItemId === budgetItemId);
    const updatedItems = [...expandedItems];

    if (ledItemIndex >= 0) {
      updatedItems.splice(ledItemIndex + 1, 0, ...newCaseItems);
    } else {
      updatedItems.push(...newCaseItems);
    }

    console.log('Updated expanded items, new count:', updatedItems.length);
    setExpandedItems(updatedItems);
    setLedItemsWithCases(prev => new Set(prev).add(budgetItemId));
    setModifiedItems(prev => new Set(prev).add(budgetItemId));
  };

  const handlePickedChange = async (budgetItemId: string, picked: boolean) => {
    try {
      // Find the real budget item ID (ignoring composition suffixes like -comp-, -mod-, or -case-)
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      // We need to extract the full UUID before any suffix
      const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*)$/, '');
      await updateBudgetItemPicked(realId, picked);
      
      // Update all items sharing this budget item ID
      setExpandedItems(expandedItems.map(item =>
        item.budgetItemId.startsWith(realId) ? { ...item, picked } : item
      ));
    } catch (error) {
      console.error('Error updating picked status:', error);
      alert('Ошибка при обновлении статуса');
    }
  };

  const handleCablePickedChange = async (id: string, picked: boolean) => {
    try {
      await updateCable(id, { picked });
      setCables(cables.map(c => c.id === id ? { ...c, picked } : c));
    } catch (error) {
      console.error('Error updating cable picked status:', error);
      alert('Ошибка при обновлении статуса');
    }
  };

  const handleConnectorPickedChange = async (id: string, picked: boolean) => {
    try {
      await updateConnector(id, { picked });
      setConnectors(connectors.map(c => c.id === id ? { ...c, picked } : c));
    } catch (error) {
      console.error('Error updating connector picked status:', error);
      alert('Ошибка при обновлении статуса');
    }
  };

  const handleConfirmSpecification = async () => {
    if (!confirm('Подтвердить сборку спецификации? Это отметит прогресс подготовки оборудования.')) return;

    try {
      setConfirming(true);
      await confirmSpecification(eventId);
      setEventDetails({ ...eventDetails, specification_confirmed: true });
      alert('Спецификация подтверждена');
    } catch (error) {
      console.error('Error confirming specification:', error);
      alert('Ошибка при подтверждении спецификации');
    } finally {
      setConfirming(false);
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
        alert('Ошибка загрузки модификаций');
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
        name: comp.component?.name || 'Unknown',
        sku: comp.component?.sku || '',
        quantity: componentQuantities[comp.id],
        unit: 'шт.',
        category: comp.component?.category || 'Modification Components',
        notes: '',
        picked: false,
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
      const newItem = await createBudgetItem({
        event_id: eventId,
        equipment_id: equipment.id,
        modification_id: modificationId,
        item_type: 'equipment',
        quantity,
        price: equipment.rental_price,
        exchange_rate: 1,
        category_id: null,
        notes: ''
      });

      console.log('Created budget item:', newItem);
      setShowEquipmentSelector(false);
      await loadData();
      alert(`Добавлено: ${equipment.name} x ${quantity}${modificationId ? ' (с модификацией)' : ''}`);
    } catch (error) {
      console.error('Error adding equipment:', error);
      alert('Ошибка при добавлении оборудования');
    }
  };

  const handleQuantityChange = (budgetItemId: string, newQuantity: number) => {
    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === budgetItemId ? { ...item, quantity: Math.max(0, newQuantity) } : item
    ));
    // Track modified item (extract real budget item ID for composed items)
    const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*)$/, '');
    setModifiedItems(prev => new Set(prev).add(realId));
  };

  const handleNotesChange = (budgetItemId: string, newNotes: string) => {
    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === budgetItemId ? { ...item, notes: newNotes } : item
    ));
    // Track modified item (extract real budget item ID for composed items)
    const realId = budgetItemId.replace(/(-comp-.*|-mod-.*|-case-.*)$/, '');
    setModifiedItems(prev => new Set(prev).add(realId));
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
        
        // First, create all LED cases as new budget items with parent_budget_item_id
        const parentBudgetItem = budgetItems.find(b => b.id === budgetItemId);
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
            const newItem = await createBudgetItem({
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
        // Find the expanded item to get current values for quantity/notes update
        const expandedItem = expandedItems.find(item => item.budgetItemId === budgetItemId);
        
        if (!expandedItem) continue;
        
        // Check if this is the parent LED item that has cases attached
        const hasCases = caseItems.length > 0;
        
        if (hasCases) {
          // For items with LED cases, update the parent (cases are already created above)
          const budgetItem = budgetItems.find(b => b.id === budgetItemId);
          if (budgetItem) {
            try {
              await updateBudgetItem(budgetItemId, {
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
            const newItem = await createBudgetItem({
              event_id: eventId,
              item_type: 'equipment',
              equipment_id: null,
              work_item_id: null,
              category_id: expandedItem.categoryId,
              name: expandedItem.name,
              sku: expandedItem.sku,
              quantity: expandedItem.quantity,
              unit: expandedItem.unit,
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
            await updateBudgetItem(budgetItemId, {
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
        alert('Ошибка при сохранении: ' + errors.join(', '));
      } else {
        setModifiedItems(new Set());
        alert('Изменения сохранены');
        // Перезагружаем данные после успешного сохранения, чтобы получить реальные ID из базы
        await loadData();
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Ошибка при сохранении изменений');
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
      alert('Ошибка при добавлении кабеля');
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
      alert('Ошибка при обновлении кабеля');
    }
  };

  const handleCableNotesChange = async (id: string, newNotes: string) => {
    try {
      const updated = await updateCable(id, { notes: newNotes });
      setCables(cables.map(c => c.id === updated.id ? updated : c));
    } catch (error) {
      console.error('Error updating cable notes:', error);
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
      alert('Ошибка при добавлении коннектора');
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
      alert('Ошибка при обновлении коннектора');
    }
  };

  const handleConnectorNotesChange = async (id: string, newNotes: string) => {
    try {
      const updated = await updateConnector(id, { notes: newNotes });
      setConnectors(connectors.map(c => c.id === updated.id ? updated : c));
    } catch (error) {
      console.error('Error updating connector notes:', error);
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
      alert('Ошибка при добавлении предмета');
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
      alert('Ошибка при обновлении предмета');
    }
  };

  const handleOtherNotesChange = async (id: string, newNotes: string) => {
    try {
      const updated = await updateOtherItem(id, { notes: newNotes });
      setOtherItems(otherItems.map(i => i.id === updated.id ? updated : i));
    } catch (error) {
      console.error('Error updating other item notes:', error);
    }
  };

  const handleOtherPickedChange = async (id: string, picked: boolean) => {
    try {
      const updated = await updateOtherItem(id, { picked });
      setOtherItems(otherItems.map(i => i.id === updated.id ? updated : i));
    } catch (error) {
      console.error('Error updating other item picked status:', error);
      alert('Ошибка при обновлении статуса');
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
    const csvRows = [['№', 'Наименование', 'Артикул', 'Категория', 'Количество', 'Ед. изм.', 'Взято', 'Примечания']];
    
    let globalIndex = 1;
    groups.forEach(group => {
      group.items.forEach(item => {
        csvRows.push([
          globalIndex++,
          `"${item.name}"`,
          item.sku,
          `"${group.name}"`,
          item.quantity,
          item.unit,
          item.picked ? 'Да' : 'Нет',
          `"${item.notes}"`
        ]);
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

  const getCableNotes = (cableType: string, cableLength: string) => {
    const cable = cables.find(c => c.cable_type === cableType && c.cable_length === cableLength);
    return cable?.notes || '';
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl w-[95vw] max-w-[1400px] max-h-[90vh] flex flex-col">
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
          <div className="flex gap-2 px-4">
            {(['budget', 'cables', 'connectors', 'other'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'budget' ? 'Смета' : tab === 'cables' ? 'Кабеля' : tab === 'connectors' ? 'Коннекторы' : 'Прочее'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'budget' && (
            <>
              <div className="mb-3 flex justify-between items-center">
                {!isWarehouseUser && (
                  <button
                    onClick={() => setShowEquipmentSelector(true)}
                    className="px-3 py-1.5 bg-cyan-600 text-white text-xs rounded hover:bg-cyan-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить оборудование
                  </button>
                )}
                <button
                  onClick={handleExportBudget}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 text-xs rounded hover:bg-gray-700 flex items-center gap-1.5 ml-auto transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Экспорт CSV
                </button>
              </div>

              {groups.map((group) => (
                <div key={group.name} className="mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                    {group.name}
                  </h3>
                  <div className="overflow-x-auto rounded border border-gray-800">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                          <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500 uppercase tracking-wider">✓</th>
                          <th className="px-3 py-1.5 text-left w-12 text-[10px] text-gray-500 uppercase tracking-wider">№</th>
                          <th className="px-3 py-1.5 text-left text-[10px] text-gray-500 uppercase tracking-wider">Наименование</th>
                          <th className="px-3 py-1.5 text-left w-28 text-[10px] text-gray-500 uppercase tracking-wider">Артикул</th>
                          <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500 uppercase tracking-wider">Кол-во</th>
                          <th className="px-3 py-1.5 text-left w-20 text-[10px] text-gray-500 uppercase tracking-wider">Ед. изм.</th>
                          {!isWarehouseUser && (
                            <th className="px-3 py-1.5 text-left text-[10px] text-gray-500 uppercase tracking-wider">Примечания</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {group.items.map((item, index) => (
                          <tr key={`${item.budgetItemId}-${index}`} className={`${item.isFromComposition ? 'bg-cyan-900/10' : 'bg-gray-900'} hover:bg-gray-800 transition-colors`}>
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={item.picked}
                                onChange={(e) => handlePickedChange(item.budgetItemId, e.target.checked)}
                                className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600 focus:ring-offset-gray-900"
                                disabled={eventDetails?.specification_confirmed && !isWarehouseUser}
                              />
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
                                {!item.isFromComposition && hasModifications(item.budgetItemId) && (
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
                                {(isLedScreenItem(item) || (item.notes && (item.notes.includes('м.кв.') || item.notes.match(/\d+\s*[×x]\s*\d+/)))) && (
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
                            <td className="px-3 py-1.5 text-xs text-gray-400">{item.sku}</td>
                            <td className="px-3 py-1.5 text-center">
                              <div className="flex justify-center items-center gap-1">
                                <button
                                  onClick={() => handleQuantityChange(item.budgetItemId, item.quantity - 1)}
                                  disabled={item.quantity === 0}
                                  className="p-0.5 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs text-white font-bold w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => handleQuantityChange(item.budgetItemId, item.quantity + 1)}
                                  className="p-0.5 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{item.unit}</td>
                            
                              <td className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => handleNotesChange(item.budgetItemId, e.target.value)}
                                  className="w-full px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-300 focus:outline-none focus:border-cyan-500"
                                  placeholder="..."
                                />
                              </td>
                            
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {expandedItems.length === 0 && (
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
                  onSaveWithComposition={() => {
                    loadData();
                  }}
                />
              )}
            </>
          )}

          {activeTab === 'cables' && (
            <>
              <div className="mb-3 flex justify-end">
                <button
                  onClick={handleExportCables}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 text-xs rounded hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Экспорт CSV
                </button>
              </div>

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
                              <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Длина</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && (
                                <>
                                  <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Примечания</th>
                                  <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.lengths.map((length) => {
                              const quantity = getCableQuantity(template.type, length);
                              const cableId = getCableId(template.type, length);
                              const notes = getCableNotes(template.type, length);
                              const picked = getCablePicked(template.type, length);

                              return (
                                <tr key={length} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {cableId && (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleCablePickedChange(cableId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={eventDetails?.specification_confirmed && !isWarehouseUser}
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{length}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {cableId ? (
                                      isWarehouseUser ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={quantity}
                                          onChange={(e) => handleCableQuantityChange(cableId, parseInt(e.target.value) || 0)}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && (
                                    <>
                                      <td className="px-3 py-1.5">
                                        {cableId && (
                                          <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => handleCableNotesChange(cableId, e.target.value)}
                                            className="w-full px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-300"
                                            placeholder="..."
                                          />
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <div className="flex justify-center gap-1.5">
                                          <button
                                            onClick={() => cableId && handleCableQuantityChange(cableId, Math.max(0, quantity - 1))}
                                            disabled={!cableId || quantity === 0}
                                            className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleAddCableFromTemplate(template.type, length)}
                                            className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
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
              <div className="mb-3 flex justify-end">
                <button
                  onClick={handleExportConnectors}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 text-xs rounded hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Экспорт CSV
                </button>
              </div>

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
                              <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Тип</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && (
                                <>
                                  <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Примечания</th>
                                  <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const connector = connectors.find(c => c.connector_type === itemType);
                              const quantity = connector?.quantity || 0;
                              const notes = connector?.notes || '';
                              const picked = connector?.picked || false;

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {connector && (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleConnectorPickedChange(connector.id, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={eventDetails?.specification_confirmed && !isWarehouseUser}
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemType}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {connector ? (
                                      isWarehouseUser ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={quantity}
                                          onChange={(e) => handleConnectorQuantityChange(connector.id, parseInt(e.target.value) || 0)}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && (
                                    <>
                                      <td className="px-3 py-1.5">
                                        {connector && (
                                          <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => handleConnectorNotesChange(connector.id, e.target.value)}
                                            className="w-full px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-300"
                                            placeholder="..."
                                          />
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <div className="flex justify-center gap-1.5">
                                          <button
                                            onClick={() => connector && handleConnectorQuantityChange(connector.id, Math.max(0, quantity - 1))}
                                            disabled={!connector || quantity === 0}
                                            className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleAddConnectorFromTemplate(itemType)}
                                            className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
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
              <div className="mb-3 flex justify-end">
                <button
                  onClick={handleExportOther}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 text-xs rounded hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Экспорт CSV
                </button>
              </div>

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
                              <th className="px-3 py-1.5 text-center w-12 text-[10px] text-gray-500">✓</th>
                              <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Предмет</th>
                              <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500">Кол-во</th>
                              {!isWarehouseUser && (
                                <>
                                  <th className="px-3 py-1.5 text-left text-[10px] text-gray-500">Примечания</th>
                                  <th className="px-3 py-1.5 text-center w-20 text-[10px] text-gray-500"></th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const otherId = getOtherId(template.category, itemType);
                              const quantity = getOtherQuantity(template.category, itemType);
                              const notes = getOtherNotes(template.category, itemType);
                              const picked = getOtherPicked(template.category, itemType);

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    {otherId && (
                                      <input
                                        type="checkbox"
                                        checked={picked}
                                        onChange={(e) => handleOtherPickedChange(otherId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-cyan-600"
                                        disabled={eventDetails?.specification_confirmed && !isWarehouseUser}
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemType}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {otherId ? (
                                      isWarehouseUser ? (
                                        <div className="text-xs text-white font-bold">{quantity}</div>
                                      ) : (
                                        <input
                                          type="number"
                                          value={quantity}
                                          onChange={(e) => handleOtherQuantityChange(otherId, parseInt(e.target.value) || 0)}
                                          className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                          min="0"
                                        />
                                      )
                                    ) : (
                                      <div className="text-center text-gray-600 text-xs">0</div>
                                    )}
                                  </td>
                                  {!isWarehouseUser && (
                                    <>
                                      <td className="px-3 py-1.5">
                                        {otherId && (
                                          <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => handleOtherNotesChange(otherId, e.target.value)}
                                            className="w-full px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-300"
                                            placeholder="..."
                                          />
                                        )}
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <div className="flex justify-center gap-1.5">
                                          <button
                                            onClick={() => otherId && handleOtherQuantityChange(otherId, Math.max(0, quantity - 1))}
                                            disabled={!otherId || quantity === 0}
                                            className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                          >
                                            <Minus className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleAddOtherFromTemplate(template.category, itemType)}
                                            className="p-1 text-cyan-500/50 hover:text-cyan-400 transition-colors"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
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
        </div>

        <div className="border-t border-gray-800 p-3 bg-gray-900/80 flex justify-between items-center">
          <div className="text-[10px] text-gray-500 font-medium">
            {isWarehouseUser && (
              <p>Отметьте элементы и подтвердите сборку</p>
            )}
          </div>
          <div className="flex gap-2">
            {modifiedItems.size > 0 && (
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
            {(isWarehouseUser || !eventDetails?.specification_confirmed) && (
              <button
                onClick={handleConfirmSpecification}
                disabled={confirming || eventDetails?.specification_confirmed}
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {confirming ? (
                  <>...</>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Подтвердить сборку
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
                    <th className="px-3 py-2 text-left w-28 text-[10px] text-gray-500 uppercase tracking-wider">Артикул</th>
                    <th className="px-3 py-2 text-center w-24 text-[10px] text-gray-500 uppercase tracking-wider">Количество</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {modificationComponents.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-800 transition-colors">
                      <td className="px-3 py-2">
                        <div className="text-xs text-white font-medium">{comp.component?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{comp.component?.sku || ''}</td>
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

      {showEquipmentSelector && !isWarehouseUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Добавить оборудование</h3>
              <button
                onClick={() => setShowEquipmentSelector(false)}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <EquipmentSelector
              onSelect={handleAddEquipment}
              onClose={() => setShowEquipmentSelector(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
