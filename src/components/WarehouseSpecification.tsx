import './warehouseSpecification.css';
import { MobileHeaderContent } from './MobileHeaderContent';
import { createOptimisticSpecificationMarks } from '../lib/optimisticSpecificationMarks';
import { canAdjustSpecificationAccessories } from '../lib/specificationPermissions';
import { SpecificationLogs } from './SpecificationLogs';
import { useSpecificationCollaboration } from '../lib/useSpecificationCollaboration';
import { mergeSharedMarks, resetWarehouseSpecificationMarks, saveGeneratedRowMark, specificationStructureKey, type CollaborationSnapshot } from '../lib/specificationCollaboration';
import { canViewSpecificationLogs } from '../lib/specificationPermissions';
import { canEditMainSpecification as mayEditMainSpecification, canMarkMainSpecification as mayMarkMainSpecification } from '../lib/specificationPermissions';
import { withBudgetUnits } from '../lib/specificationUnits';
import { createSpecificationCatalog, loadSpecificationContents, type SpecificationContents } from '../lib/specificationContents';
import { cableDisplayName, cableLengthDisplayName } from '../lib/cableNames';
import { connectorDisplayName } from '../lib/connectorNames';
import { useSpecificationNotes } from '../lib/useSpecificationNotes';
import { BudgetScope } from './BudgetScope';
import { getBudgetEvent, updateBudgetSpecification } from '../lib/eventBudgets';
import { createOptimisticQuantityQueue, writeGroupedQuantity } from '../lib/specificationQuantity';
import { getErrorMessage } from '../lib/errors';
import { canAccess } from '../lib/roles';
import { useState, useEffect, useRef, useMemo, useCallback, startTransition } from 'react';
import { X, Plus, Minus, Package, MoreHorizontal, AlertCircle, ChevronDown, ChevronRight, CheckCircle, Layers, Calculator, Save, Truck, Trash2, StickyNote } from 'lucide-react';
import { budgetSpecificationPreview, specificationIsEditable, isBudgetSpecificationItem, getSpecificationDifferences } from '../lib/specificationServices';
import { getBudgetItems, type BudgetItem, type Event } from '../lib/events';
import { EquipmentItem, getEquipmentModifications, getModificationsForEquipment, EquipmentModification, ModificationComponent } from '../lib/equipment';
import { findCasesContainingComponents, ComponentCaseOption } from '../lib/equipmentCompositions';
import { Category, getCategories, getCategoriesForEvent } from '../lib/categories';
import { Location, getLocationsForEvent } from '../lib/locations';
import { CalculatedCase } from './LedSpecificationPanel';
import { EquipmentSelector } from './EquipmentSelector';
import { LedSpecificationPanel } from './LedSpecificationPanel';
import { PodiumSpecificationPanel } from './PodiumSpecificationPanel';
import { StageRailingSpecificationPanel } from './StageRailingSpecificationPanel';
import type { PodiumModule } from '../lib/podiumSpecification';
import { isStageRailing, STAGE_RAILING_CALCULATOR_TITLE } from '../lib/stageRailing';
import { useAuth } from '../contexts/authContext';
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
  getConnectors,
  createConnector,
  updateConnector,
  getOtherItems,
  createOtherItem,
  updateOtherItem,
  getSpecificationBudgetItems,
  saveSpecificationComponentChoice,
  excludeSpecificationChild,
  createSpecificationBudgetItem,
  updateSpecificationBudgetItem,
  updateSpecificationBudgetItemPicked,
  updateSpecificationBudgetItemReturnPicked,
  deleteSpecificationBudgetItem,
  ensureWarehouseSpecificationSnapshot,
  resetWarehouseSpecificationSnapshot
} from '../lib/warehouseSpecification';
import { getModificationComponents } from '../lib/equipment';
import { createCatalogLookup } from '../lib/catalogLookup';
import { StickyNotePanel } from './StickyNotePanel';

interface WarehouseSpecificationProps {
  budgetId?: string;
  eventId: string;
}

interface ExpandedItem {
  budgetItemId: string;
  parentBudgetItemId?: string;
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

function indexChildRows(items: ExpandedItem[]) {
  const parentIds = new Set<string>();
  const legacyParentNames = new Set<string>();
  for (const item of items) {
    if (item.parentBudgetItemId) parentIds.add(item.parentBudgetItemId);
    else if (item.parentName !== undefined) legacyParentNames.add(item.parentName);
  }
  return (item: ExpandedItem) => parentIds.has(item.budgetItemId) || legacyParentNames.has(item.name);
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
  group: 'equipment' | 'extra' | 'cables' | 'connectors' | 'other';
}

interface AddEquipmentTarget {
  categoryId: string | null;
  locationId: string | null;
}

interface PendingDeleteItem {
  budgetItemId: string;
  itemName: string;
}

interface ComponentDecisionItem {
  budgetItemId: string;
  equipmentId: string;
  name: string;
  sku: string;
  quantity: number;
  notes: string;
  categoryId: string | null;
  locationId: string | null;
  locationName: string;
  picked: boolean;
  return_picked: boolean;
  isExtra: boolean;
  caseCapacityByCaseId: Record<string, number>;
}

interface ComponentDecisionGroup {
  groupId: string;
  caseOptions: ComponentCaseOption[];
  items: ComponentDecisionItem[];
}

type TabType = 'budget' | 'cables' | 'connectors' | 'other' | 'extra';

const CONNECTOR_SCOPE_DELIMITER = '::';

const buildConnectorScopedType = (category: string, itemType: string) => `${category}${CONNECTOR_SCOPE_DELIMITER}${itemType}`;

const parseConnectorScopedType = (connectorType: string) => {
  const [category, ...itemParts] = connectorType.split(CONNECTOR_SCOPE_DELIMITER);
  if (itemParts.length === 0) {
    return { category: null, itemType: connectorType };
  }

  return {
    category,
    itemType: itemParts.join(CONNECTOR_SCOPE_DELIMITER)
  };
};

const getConnectorCategory = (connector: ConnectorItem) => (
  parseConnectorScopedType(connector.connector_type).category ?? connector.connector_type
);

const getConnectorItem = (connector: ConnectorItem) => (
  connector.connector_item || parseConnectorScopedType(connector.connector_type).itemType
);

const isConnectorMatch = (connector: ConnectorItem, category: string, itemType: string) => {
  const connectorCategory = getConnectorCategory(connector);
  const connectorItem = getConnectorItem(connector);
  return connectorCategory === category && connectorItem === itemType;
};

const isLegacyConnectorMatch = (connector: ConnectorItem, scopedType: string, itemType: string) => {
  const hasStructuredItem = Boolean(connector.connector_item && connector.connector_item.trim().length > 0);
  if (hasStructuredItem) return false;
  return connector.connector_type === scopedType || connector.connector_type === itemType;
};

const DUPLICATE_CONNECTOR_ITEMS = new Set(
  CONNECTOR_TEMPLATES
    .flatMap(template => template.items)
    .filter((item, index, all) => all.indexOf(item) !== index)
);

const buildCableDraftKey = (cableType: string, cableLength: string) => `cable_${cableType}__${cableLength}`;
const buildConnectorDraftKey = (connectorType: string) => `connector_${connectorType}`;
const buildOtherDraftKey = (category: string, itemType: string) => `other_${category}__${itemType}`;
const COMPOSED_ITEM_ID_SUFFIX_REGEX = /(-comp-.*|-mod-.*|-case-.*|-kitcase-.*|-podium-.*)$/;

const getPersistedBudgetItemId = (budgetItemId: string) => budgetItemId.replace(COMPOSED_ITEM_ID_SUFFIX_REGEX, '');

const isGeneratedCompositionItemId = (budgetItemId: string) => COMPOSED_ITEM_ID_SUFFIX_REGEX.test(budgetItemId);

// Browser copy is a cache of shared generated-row checkboxes; authoritative
// values live in specification_row_marks and are updated by the guarded RPC.
const buildCompositionPickedStorageKey = (eventId: string) => `spec_composition_picked_${eventId}`;

type CompositionPickedSnapshot = Record<string, { picked?: boolean; return_picked?: boolean }>;

const readCompositionPickedSnapshot = (budgetId: string): CompositionPickedSnapshot => {
  try {
    const raw = localStorage.getItem(buildCompositionPickedStorageKey(budgetId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as CompositionPickedSnapshot : {};
  } catch {
    return {};
  }
};

const writeCompositionPickedSnapshot = (budgetId: string, snapshot: CompositionPickedSnapshot) => {
  try {
    localStorage.setItem(buildCompositionPickedStorageKey(budgetId), JSON.stringify(snapshot));
  } catch {
    // ignore storage errors
  }
};

// Строит стабильный ключ виртуального субэлемента привязки к родителю,
// составу/модификации и компоненту. Ключ не зависит от времени, поэтому
// восстановленные после перезагрузки отметки совпадают с новыми строками.
const buildStableCompositionItemKey = (
  parentBudgetItemId: string,
  kind: 'comp' | 'mod',
  sourceId: string,
  childEquipmentId?: string | null
) => `${parentBudgetItemId}-${kind}-${sourceId}${childEquipmentId ? `-${childEquipmentId}` : ''}`;

export function WarehouseSpecification(props: WarehouseSpecificationProps) {
  return <BudgetScope eventId={props.eventId} budgetId={props.budgetId} presentation="page">{(id, name) => <ScopedWarehouseSpecification key={id} {...props} budgetName={name} budgetId={id} />}</BudgetScope>;
}
function ScopedWarehouseSpecification({ eventId, budgetName, budgetId }: WarehouseSpecificationProps & { budgetId: string; budgetName: string }) {
  const { user } = useAuth();
  const isWarehouseUser = isWarehouse(user);

  const [showLogs, setShowLogs] = useState(false);
  const [remoteStructureChanged, setRemoteStructureChanged] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const [liveBudgetItems, setLiveBudgetItems] = useState<BudgetItem[]>([]);
  const [comparisonRequest, setComparisonRequest] = useState<{
    budget: BudgetItem[];
    specification: BudgetItem[];
    catalog?: ReturnType<typeof createSpecificationCatalog>;
  } | null>(null);
  const [comparisonResult, setComparisonResult] = useState<{
    request: NonNullable<typeof comparisonRequest>;
    contents: SpecificationContents | null;
  } | null>(null);
  const currentComparison = comparisonResult?.request === comparisonRequest ? comparisonResult : null;
  const comparisonContents = currentComparison?.contents;
  const comparisonError = currentComparison && !comparisonContents
    ? 'Не удалось проверить содержимое комплектов. Откройте спецификацию повторно.'
    : '';
  const [showBudgetChanges, setShowBudgetChanges] = useState(false);
  const checkedOpeningDifferences = useRef(false);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [budgetSourceError, setBudgetSourceError] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const budgetItemsById = useMemo(() => new Map(budgetItems.map(item => [item.id, item])), [budgetItems]);
  const [expandedItems, setExpandedItems] = useState<ExpandedItem[]>([]);
  const [cables, setCables] = useState<CableItem[]>([]);
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [otherItems, setOtherItems] = useState<OtherItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false);
  const [eventDetails, setEventDetails] = useState<Partial<Event> | null>(null);
  const confirmedProject = specificationIsEditable(eventDetails?.status);
  const canEditSpecification = confirmedProject && canAccess(user, 'specifications', 2) && (user?.role !== 'foreman' || eventDetails?.site_manager_id === user?.id);
  const canEditMainSpecification = confirmedProject && mayEditMainSpecification(user, eventDetails?.site_manager_id);
  const canMarkMainSpecification = confirmedProject && mayMarkMainSpecification(user);
  const canAdjustAccessories = confirmedProject && canAdjustSpecificationAccessories(user, eventDetails?.site_manager_id);
  const canEditNotes = canEditSpecification;
  const [expandedCableTypes, setExpandedCableTypes] = useState<Record<string, boolean>>({});
  const [expandedConnectorCategories, setExpandedConnectorCategories] = useState<Record<string, boolean>>({});
  const [expandedOtherCategories, setExpandedOtherCategories] = useState<Record<string, boolean>>({});
  const [confirmingShipment, setConfirmingShipment] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [equipmentModifications, setEquipmentModifications] = useState<Record<string, EquipmentModification[]>>({});
  const [showModificationSelector, setShowModificationSelector] = useState(false);
  const [selectedBudgetItemForMod, setSelectedBudgetItemForMod] = useState<BudgetItem | null>(null);
  const [showComponentsDialog, setShowComponentsDialog] = useState(false);
  const [showStickyNotes, setShowStickyNotes] = useState(false);
  const { notes: stickyNotes, changeNotes, ready: notesReady, error: notesError } = useSpecificationNotes(eventId, budgetId, canEditNotes);
  const [selectedModification, setSelectedModification] = useState<EquipmentModification | null>(null);
  const [modificationComponents, setModificationComponents] = useState<ModificationComponent[]>([]);
  const [componentQuantities, setComponentQuantities] = useState<Record<string, number>>({});
  const [loadingModifications, setLoadingModifications] = useState(false);
  const [itemsWithAppliedModifications, setItemsWithAppliedModifications] = useState<Set<string>>(new Set());
  const [showLedSpecification, setShowLedSpecification] = useState<string | null>(null);
  const [ledItemsWithCases, setLedItemsWithCases] = useState<Set<string>>(new Set());
  const [showStageSpecification, setShowStageSpecification] = useState<string | null>(null);
  const [stageCompositionDrafts, setStageCompositionDrafts] = useState<Set<string>>(new Set());
  const stageBudgetItem = budgetItems.find(item => item.id === showStageSpecification);
  const stageRow = expandedItems.find(item => item.budgetItemId === showStageSpecification);
  const isRailingCalculator = isStageRailing(stageRow?.name, stageRow?.sku)
    || isStageRailing(stageBudgetItem?.equipment?.name, stageBudgetItem?.equipment?.sku);
  const StageCalculator = isRailingCalculator ? StageRailingSpecificationPanel : PodiumSpecificationPanel;
  const stageQuantityMultiplier = isRailingCalculator ? 1 : stageRow?.quantity || 1;
  const [modifiedItems, setModifiedItems] = useState<Set<string>>(new Set());
  const [savingChanges, setSavingChanges] = useState(false);
  const [inputDraftValues, setInputDraftValues] = useState<Record<string, string>>({});
  const [pendingQuantityChange, setPendingQuantityChange] = useState<QuantityChangeRequest | null>(null);
  const [notification, setNotification] = useState<CustomNotification | null>(null);
  const [openNote, setOpenNote] = useState<{ budgetItemId: string; itemName: string; value: string } | null>(null);
  const [pendingConfirmItems, setPendingConfirmItems] = useState<PendingConfirmationItem[]>([]);
  const [pendingConfirmMode, setPendingConfirmMode] = useState<'shipment' | 'return' | null>(null);
  const [addEquipmentTarget, setAddEquipmentTarget] = useState<AddEquipmentTarget>({ categoryId: null, locationId: null });
  const [pendingDeleteItem, setPendingDeleteItem] = useState<PendingDeleteItem | null>(null);
  // Загруженные раскладные составы/модификации по id бюджетной позиции родителя —
  // нужны, чтобы при сохранении воссоздать субэлементы как реальные записи БД.
  const [, setCompositionPartsByParentId] = useState<Record<string, Array<{
    key: string;
    kind: 'comp' | 'mod';
    equipment_id: string | null;
    name: string;
    sku: string;
    category: string;
    quantity: number;
  }>>>({});
  const [componentDecisionQueue, setComponentDecisionQueue] = useState<ComponentDecisionGroup[]>([]);
  const [activeComponentDecisionIndex, setActiveComponentDecisionIndex] = useState(0);
  const [savingComponentChoice, setSavingComponentChoice] = useState(false);
  const quantityQueue = useRef(createOptimisticQuantityQueue());
  const [, refreshQuantityDisplay] = useState(0);
  const optimisticMarks = useRef(createOptimisticSpecificationMarks());
  const loadedStructure = useRef<string>();
  const loadedSnapshot = useRef<CollaborationSnapshot>();
  const componentChoiceInFlight = useRef(false);
  const cablesRef = useRef(cables);
  cablesRef.current = cables;
  const connectorsRef = useRef(connectors);
  const otherItemsRef = useRef(otherItems);
  connectorsRef.current = connectors;
  otherItemsRef.current = otherItems;
  const [showResetActions, setShowResetActions] = useState(false);
  const [resetDialog, setResetDialog] = useState<'selections' | 'specification' | null>(null);
  const [resettingSpecification, setResettingSpecification] = useState(false);
  const [resettingSelections, setResettingSelections] = useState(false);
  const resetInProgress = resettingSpecification || resettingSelections;
  const selectionResetInFlight = useRef(false);
  const [collapsedParentItems, setCollapsedParentItems] = useState<Set<string>>(new Set());

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
    return !item.parentBudgetItemId && (name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов"));
  };

  const isPodiumBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("сценический подиум") || name.includes("ступенька из сценических подиумов");
  };

  const isUShapeBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return /п-образная (фермовая )?конструкция/.test(name);
  };

  const isTotemBudgetItem = (item: BudgetItem) => {
    const name = (item.equipment?.name || item.name || "").toLowerCase();
    return name.includes("тотем");
  };

  const buildCaseExpandedItems = (group: ComponentDecisionGroup, selectedCase: ComponentCaseOption): ExpandedItem[] => {
    if (group.items.length === 0) return [];

    const caseCount = group.items.reduce((maxCount, item) => {
      const perCase = Math.max(
        1,
        item.caseCapacityByCaseId[selectedCase.caseId] || selectedCase.componentQuantityInCase || 1
      );
      const requiredForItem = Math.max(1, Math.ceil(item.quantity / perCase));
      return Math.max(maxCount, requiredForItem);
    }, 1);

    const componentsSummary = group.items
      .map(item => `${item.name} (${item.quantity} шт.)`)
      .join(', ');

    const firstItem = group.items[0];

    return [{
      budgetItemId: `${firstItem.budgetItemId}-kitcase-${selectedCase.caseId}`,
      categoryId: firstItem.categoryId,
      locationId: firstItem.locationId,
      locationName: firstItem.locationName,
      name: selectedCase.caseName,
      sku: selectedCase.caseSku,
      quantity: caseCount,
      unit: 'шт.',
      category: selectedCase.caseCategory || selectedCase.caseType || 'Кейсы',
      notes: `Вместо комплектующих: ${componentsSummary}`,
      picked: firstItem.picked,
      return_picked: firstItem.return_picked,
      isFromComposition: true,
      isExtra: firstItem.isExtra,
      parentName: componentsSummary
    }];
  };

  const hasModifications = (budgetItemId: string) => {
    // Check if modifications have been applied to this item
    if (itemsWithAppliedModifications.has(budgetItemId)) {
      return false;
    }
    
    // Find the budget item
    const budgetItem = budgetItemsById.get(budgetItemId);
    if (!budgetItem?.equipment_id) return false;
    
    // Check if we already know this equipment has no modifications
    if (equipmentModifications[budgetItem.equipment_id] !== undefined) {
      return equipmentModifications[budgetItem.equipment_id].length > 0;
    }
    
    // If not loaded yet, we need to check
    return false;
  };

  const toggleParentRow = (parentBudgetItemId: string) => {
    setCollapsedParentItems((prev) => {
      const next = new Set(prev);
      if (next.has(parentBudgetItemId)) {
        next.delete(parentBudgetItemId);
      } else {
        next.add(parentBudgetItemId);
      }
      return next;
    });
  };

  const orderItemsWithChildren = (items: ExpandedItem[]) => {
    const childrenByParentId = new Map<string, ExpandedItem[]>();
    const parentIds = new Set(items.map(item => item.budgetItemId));

    items.forEach((item) => {
      if (!item.parentBudgetItemId || !parentIds.has(item.parentBudgetItemId)) return;

      const siblings = childrenByParentId.get(item.parentBudgetItemId) || [];
      siblings.push(item);
      childrenByParentId.set(item.parentBudgetItemId, siblings);
    });

    const ordered: ExpandedItem[] = [];
    const insertedChildIds = new Set<string>();

    items.forEach((item) => {
      if (item.parentBudgetItemId) return;
      ordered.push(item);
      const children = childrenByParentId.get(item.budgetItemId) || [];
      children.forEach((child) => {
        ordered.push(child);
        insertedChildIds.add(child.budgetItemId);
      });
    });

    // legacy or orphan children
    items.forEach((item) => {
      if (!item.parentBudgetItemId) return;
      if (insertedChildIds.has(item.budgetItemId)) return;
      ordered.push(item);
    });
    return ordered;
  };

  const pickableExpandedItems = useMemo(() => {
    const hasChildren = indexChildRows(expandedItems);
    return expandedItems.filter(item => !hasChildren(item));
  }, [expandedItems]);

  const allPickedForShipment =
    pickableExpandedItems.every(item => item.picked) &&
    cables.filter(row => row.quantity > 0).every(c => c.picked) &&
    connectors.filter(row => row.quantity > 0).every(c => c.picked) &&
    otherItems.filter(row => row.quantity > 0).every(i => i.picked);

  const allPickedForReturn =
    pickableExpandedItems.every(item => item.return_picked) &&
    cables.filter(row => row.quantity > 0).every(c => c.return_picked) &&
    connectors.filter(row => row.quantity > 0).every(c => c.return_picked) &&
    otherItems.filter(row => row.quantity > 0).every(i => i.return_picked);

  const buildLocationGroups = useCallback((items: ExpandedItem[]) => {
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
  }, [categories, locations]);

  const { mainItems, extraItems, locationGroups, extraLocationGroups } = useMemo(() => {
    const mainItems = expandedItems.filter(item => !item.isExtra);
    const extraItems = expandedItems.filter(item => item.isExtra);
    return {
      mainItems,
      extraItems,
      locationGroups: buildLocationGroups(mainItems),
      extraLocationGroups: buildLocationGroups(extraItems),
    };
  }, [buildLocationGroups, expandedItems]);

  useEffect(() => {
    loadData();
  }, [eventId, budgetId]);

  const markKey = (kind: string, id: string, field: 'picked' | 'return_picked') => JSON.stringify([kind, id, field]);
  const overlayMarks = <T extends {picked?: boolean; return_picked?: boolean}>(kind: string, rows: T[], identify: (row: T) => string): T[] => rows.map(row => ({ ...row,
    picked: optimisticMarks.current.overlay(markKey(kind, identify(row), 'picked'), !!row.picked),
    return_picked: optimisticMarks.current.overlay(markKey(kind, identify(row), 'return_picked'), !!row.return_picked),
  }));

  const collaboration = useSpecificationCollaboration(eventId, budgetId, !initialLoading && confirmedProject, snapshot => {
    if (selectionResetInFlight.current) return;
    const marks = snapshot.marks.map(row => ({ id: row.row_key, picked: row.picked, return_picked: row.return_picked }));
    const markedKeys = new Set(snapshot.marks.map(row => row.row_key));
    writeCompositionPickedSnapshot(budgetId, Object.fromEntries(snapshot.marks.map(row => [row.row_key, {picked: row.picked, return_picked: row.return_picked}])));
    setExpandedItems(previous => overlayMarks('equipment', mergeSharedMarks(previous.map(row => isGeneratedCompositionItemId(row.budgetItemId) && !markedKeys.has(row.budgetItemId) ? { ...row, picked: false, return_picked: false } : row), [...snapshot.equipment, ...marks], row => row.budgetItemId), row => row.budgetItemId));
    setBudgetItems(previous => mergeSharedMarks(previous, snapshot.equipment, row => row.id));
    setCables(previous => overlayMarks('cables', mergeSharedMarks(previous, snapshot.cables, row => row.id), row => row.id));
    setConnectors(previous => overlayMarks('connectors', mergeSharedMarks(previous, snapshot.connectors, row => row.id), row => row.id));
    setOtherItems(previous => overlayMarks('other', mergeSharedMarks(previous, snapshot.other, row => row.id), row => row.id));
    setEventDetails(previous => previous ? { ...previous, equipment_shipped: false, equipment_returned: false, specification_confirmed: false, ...snapshot.state } : previous);
    // Keep the optimistic quantity visible without a false remote-change banner.
    // The last queued write schedules another read, which reconciles structure.
    if (quantityQueue.current.hasPending() || componentChoiceInFlight.current || loading) return;
    if (loadedStructure.current !== undefined && loadedStructure.current !== specificationStructureKey(snapshot)) {
      if ((optimisticMarks.current.hasPending() || quantityQueue.current.hasPending()) || modifiedItems.size || savingChanges || Object.keys(inputDraftValues).length || openNote || showComponentsDialog || showLedSpecification || showStageSpecification) setRemoteStructureChanged(true);
      else { setRemoteStructureChanged(false); void loadData(); }
    }
  });

  useEffect(() => {
    if (!eventDetails || loading) return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const [latest, current] = await Promise.all([getBudgetItems(eventId, budgetId), getBudgetEvent(eventId, budgetId)]);
        if (!active) return;
        setEventDetails(current);
        if (current.status !== eventDetails.status) await loadData();
        else if (JSON.stringify(latest) !== JSON.stringify(liveBudgetItems)) {
          if (specificationIsEditable(current.status)) {
            setComparisonRequest(canViewSpecificationLogs(user, current.site_manager_id)
              ? { budget: latest, specification: budgetItems }
              : null);
            setLiveBudgetItems(latest);
          }
          else await loadData();
        }
      } catch { if (active) setBudgetSourceError('Не удалось обновить смету. Проверьте соединение и откройте спецификацию повторно.'); }
      finally { refreshing = false; }
    };
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [eventId, budgetId, eventDetails?.status, liveBudgetItems, loading]);

  useEffect(() => {
    if (!comparisonRequest) return;
    let active = true;
    const { budget, specification, catalog } = comparisonRequest;
    const finish = (contents: SpecificationContents | null) => {
      if (active) startTransition(() => setComparisonResult({ request: comparisonRequest, contents }));
    };
    void loadSpecificationContents(budget, specification, catalog).then(finish, () => finish(null));
    return () => { active = false; };
  }, [comparisonRequest]);

  const extraCategoryIds = useMemo(() => new Set(
    categories.filter(category => category.description === '__extra_service__').map(category => category.id)
  ), [categories]);
  const differences = useMemo(() => comparisonContents ? getSpecificationDifferences(
    liveBudgetItems.filter(item => isBudgetSpecificationItem(item, extraCategoryIds)),
    budgetItems.filter(item => isBudgetSpecificationItem(item, extraCategoryIds)),
    comparisonContents,
  ) : [], [liveBudgetItems, budgetItems, extraCategoryIds, comparisonContents]);
  const canReviewSpecification = canViewSpecificationLogs(user, eventDetails?.site_manager_id);
  const canApplyBudgetChanges = canEditMainSpecification && !eventDetails?.equipment_shipped;
  const hasBudgetDifferences = canReviewSpecification && confirmedProject && !!comparisonContents && !budgetSourceError && differences.length > 0;
  const openBudgetChanges = useCallback(() => {
    setSelectedChanges(new Set(differences.filter(row => row.kind === 'add' && !row.requiresManual).map(row => row.sourceId)));
    setShowBudgetChanges(true);
  }, [differences]);
  useEffect(() => {
    if (checkedOpeningDifferences.current || !canReviewSpecification || initialLoading || !comparisonContents || budgetSourceError) return;
    checkedOpeningDifferences.current = true;
    if (hasBudgetDifferences) openBudgetChanges();
  }, [canReviewSpecification, initialLoading, comparisonContents, budgetSourceError, hasBudgetDifferences, openBudgetChanges]);
  const applyBudgetChanges = async () => {
    if (!canEditMainSpecification || !comparisonContents || budgetSourceError || applyingChanges || eventDetails?.equipment_shipped || modifiedItems.size) return;
    setApplyingChanges(true);
    try {
      const [latest, current] = await Promise.all([getBudgetItems(eventId, budgetId), getBudgetEvent(eventId, budgetId)]);
      if (!specificationIsEditable(current.status) || current.equipment_shipped || JSON.stringify(latest) !== JSON.stringify(liveBudgetItems)) {
        setShowBudgetChanges(false);
        throw new Error('Смета или состояние мероприятия изменились. Проверьте обновлённое сравнение.');
      }
      const idMap = new Map(budgetItems.flatMap(item => item.source_budget_item_id ? [[item.source_budget_item_id, item.id] as const] : []));
      const selected = differences.filter(row => !row.requiresManual && selectedChanges.has(row.sourceId));
      const additions = selected.filter(row => row.kind === 'add');
      while (additions.length) {
        const index = additions.findIndex(row => !row.source?.parent_budget_item_id || idMap.has(row.source.parent_budget_item_id));
        if (index < 0) throw new Error('Сначала выберите добавление родительской позиции.');
        const change = additions.splice(index, 1)[0];
        const source = change.source!;
        const created = await createSpecificationBudgetItem({ event_id: eventId, budget_id: budgetId, source_budget_item_id: source.id, item_type: source.item_type, equipment_id: source.equipment_id, work_item_id: source.work_item_id, modification_id: source.modification_id, parent_budget_item_id: source.parent_budget_item_id ? idMap.get(source.parent_budget_item_id) : null, category_id: source.category_id, location_id: source.location_id, name: source.name, sku: source.sku, quantity: source.quantity, price: source.price, total: source.total, notes: source.notes, sort_order: source.sort_order, is_extra: source.is_extra, picked: false, return_picked: false });
        idMap.set(source.id, created.id);
      }
      for (const change of selected.filter(row => row.kind === 'update')) {
        const source = change.source!;
        await updateSpecificationBudgetItem(change.saved!.id, { quantity: source.quantity, equipment_id: source.equipment_id, work_item_id: source.work_item_id, modification_id: source.modification_id, category_id: source.category_id, location_id: source.location_id, name: source.name, picked: false, return_picked: false });
      }
      for (const change of selected.filter(row => row.kind === 'remove')) {
        if (!canAccess(user, 'specifications', 3)) throw new Error('Нет права удаления позиций.');
        await deleteSpecificationBudgetItem(change.saved!.id);
      }
      setShowBudgetChanges(false);
      await loadData();
    } catch (error) { showNotification(getErrorMessage(error) + ' Уже применённые позиции сохранены; откройте сравнение повторно.'); await loadData(); }
    finally { setApplyingChanges(false); }
  };

  const loadData = async (pendingChanges?: { id: string; quantity?: number; notes?: string }[]) => {
    try {
      setLoading(true);
      setLoadError(false);
      setComparisonRequest(null);
      const eventRequest = getBudgetEvent(eventId, budgetId);
      const liveItemsRequest = getBudgetItems(eventId, budgetId).then(items => {
        setBudgetSourceError('');
        return items;
      }).catch(() => {
        setBudgetSourceError('Не удалось проверить актуальную смету. Откройте спецификацию повторно.');
        return null;
      });
      const snapshotRequest = eventRequest.then(async current => {
        if (!specificationIsEditable(current.status)) {
          const items = await liveItemsRequest;
          if (!items) throw new Error('Не удалось загрузить смету для предпросмотра спецификации.');
          return budgetSpecificationPreview(items);
        }
        const items = await getSpecificationBudgetItems(eventId, budgetId);
        if (items.length || !mayEditMainSpecification(user, current.site_manager_id) || (await liveItemsRequest)?.length === 0) return items;
        await ensureWarehouseSpecificationSnapshot(eventId, budgetId);
        return getSpecificationBudgetItems(eventId, budgetId);
      });
      const [rawBudgetData, globalCategoriesData, eventCategoriesData, locationsData, event, cablesData, connectorsData, otherData, liveItems] = await Promise.all([
        snapshotRequest,
        getCategories(),
        getCategoriesForEvent(eventId, budgetId),
        getLocationsForEvent(eventId, budgetId),
        eventRequest,
        getCables(eventId, budgetId),
        getConnectors(eventId, budgetId),
        getOtherItems(eventId, budgetId),
        liveItemsRequest,
      ]);

      loadedSnapshot.current = {equipment: rawBudgetData, cables: cablesData, connectors: connectorsData, other: otherData, marks: [], state: {}} as unknown as CollaborationSnapshot;
      loadedStructure.current = specificationStructureKey(loadedSnapshot.current);
      const budgetData = withBudgetUnits(rawBudgetData, liveItems || []);
      const mergedCategories = [...globalCategoriesData, ...eventCategoriesData];
      setCategories(mergedCategories);
      setLocations(locationsData || []);
      setEventDetails(event);
      setBudgetItems(budgetData || []);
      if (liveItems) setLiveBudgetItems(liveItems);
      setCables(cablesData || []);
      setConnectors(connectorsData || []);
      setOtherItems(otherData || []);

      const items: ExpandedItem[] = [];
      const pendingComponentDecisions: ComponentDecisionGroup[] = [];
      const pendingGroupsByKey = new Map<string, ComponentDecisionGroup>();
      const compositionPartsMap: Record<string, Array<{
        key: string;
        kind: 'comp' | 'mod';
        equipment_id: string | null;
        name: string;
        sku: string;
        category: string;
        quantity: number;
      }>> = {};

      const locationsById = new Map(locationsData.map(location => [location.id, location]));

      // Предзагружаем связанные данные параллельно. Раньше запросы выполнялись
      // последовательно внутри цикла по каждой позиции спецификации.
      const equipmentIds = specificationIsEditable(event.status) && mayEditMainSpecification(user, event.site_manager_id) ? [...new Set(
        budgetData
          .filter(item => item.item_type === 'equipment' && item.equipment_id)
          .map(item => item.equipment_id)
          .filter((id): id is string => Boolean(id))
      )] : [];
      const compositionIds = [...new Set(
        budgetData
          .filter(item => item.item_type === 'equipment' && item.equipment_id && (item.equipment?.object_type !== 'physical' || item.equipment?.has_composition) && !item.parent_budget_item_id)
          .map(item => item.equipment_id)
          .filter((id): id is string => Boolean(id))
      )];
      const modificationIds = [...new Set(
        budgetData
          .filter(item => item.item_type === 'equipment' && item.modification_id)
          .map(item => item.modification_id)
          .filter((id): id is string => Boolean(id))
      )];
      const mayChooseCase = (item: BudgetItem) =>
        item.equipment?.is_component && item.equipment.object_type !== 'virtual' && item.equipment_id &&
        !item.parent_budget_item_id && item.component_selection !== 'separate' &&
        specificationIsEditable(event.status) && !event.equipment_shipped &&
        (item.is_extra && !item.source_budget_item_id
          ? canAccess(user, 'specifications', 2) && (user?.role !== 'foreman' || event.site_manager_id === user.id)
          : mayEditMainSpecification(user, event.site_manager_id));
      const componentIds = budgetData.flatMap(item =>
        item.item_type === 'equipment' && item.equipment_id && mayChooseCase(item) ? [item.equipment_id] : []
      );
      const catalog = createSpecificationCatalog();
      const lookupCases = createCatalogLookup(findCasesContainingComponents, row => row.componentId);
      const lookupModifications = createCatalogLookup(getModificationsForEquipment, row => row.equipment_id);
      const canReviewBudget = canViewSpecificationLogs(user, event.site_manager_id);
      const [caseOptionsByEquipmentId, compositionsByEquipmentId, modificationComponentsById, modificationEntries] = await Promise.all([
        lookupCases(componentIds),
        catalog.compositions(compositionIds),
        catalog.modificationComponents(modificationIds),
        lookupModifications(equipmentIds).catch(error => {
          console.error('Error pre-loading modifications:', error);
          return new Map<string, EquipmentModification[]>();
        }),
      ]);
      setEquipmentModifications(Object.fromEntries(modificationEntries));

      const budgetItemsById = new Map(budgetData.map(item => [item.id, item]));
      for (const item of budgetData) {
        if (item.item_type === 'work') {
          if (mergedCategories.find(category => category.id === item.category_id)?.description !== '__extra_service__') continue;
          items.push({ budgetItemId: item.id, categoryId: item.category_id || null, locationId: item.location_id || null, locationName: locationsById.get(item.location_id || '')?.name || 'Без локации', name: item.name || item.work_item?.name || 'Позиция', sku: '', quantity: item.quantity, unit: item.unit || item.work_item?.unit || 'усл.', category: mergedCategories.find(category => category.id === item.category_id)?.name || 'Прочее', notes: item.notes || '', picked: item.picked || false, return_picked: item.return_picked || false, isFromComposition: false, isExtra: false });
          continue;
        }
        const itemLocationId = item.location_id || null;
        const itemLocation = itemLocationId ? locationsById.get(itemLocationId) : null;
        const itemLocationName = itemLocation?.name || item.location?.name || 'Без локации';

        // Physical equipment keeps its own row; contents use the same linked rows
        // and stable keys as virtual compositions (including exclusion/pick state).
        const appendContents = () => {
          const compositions = item.equipment_id ? compositionsByEquipmentId.get(item.equipment_id) || [] : [];
          for (const comp of compositions) {
            const subKey = buildStableCompositionItemKey(item.id, 'comp', comp.id, comp.child_id);
            items.push({
              budgetItemId: subKey,
              parentBudgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: comp.child_name || 'Unknown',
              sku: comp.child_sku || '',
              quantity: item.quantity * comp.quantity,
              unit: comp.child_unit || 'шт.',
              category: comp.child_category || 'Components',
              notes: item.notes || '',
              picked: item.equipment?.object_type === 'physical' ? false : item.picked || false,
              return_picked: item.equipment?.object_type === 'physical' ? false : item.return_picked || false,
              isFromComposition: true,
              isExtra: !!item.is_extra && !item.source_budget_item_id,
              parentName: item.equipment?.name
            });
            (compositionPartsMap[item.id] = compositionPartsMap[item.id] || []).push({
              key: subKey,
              kind: 'comp',
              equipment_id: comp.child_id || null,
              name: comp.child_name || 'Unknown',
              sku: comp.child_sku || '',
              category: comp.child_category || 'Components',
              quantity: item.quantity * comp.quantity
            });
          }
          return compositions.length > 0;
        };

        // Handle child items (e.g., LED cases) - show them as composition items
        if (item.parent_budget_item_id) {
          const parentItem = budgetItemsById.get(item.parent_budget_item_id);
          const locationId = item.location_id || parentItem?.location_id || null;
          const location = locationId ? locationsById.get(locationId) : null;

          items.push({
            budgetItemId: item.id,
            parentBudgetItemId: item.parent_budget_item_id,
            categoryId: item.category_id || null,
            locationId,
            locationName: location?.name || item.location?.name || parentItem?.location?.name || 'Без локации',
            name: item.name || 'Кейс',
            sku: item.sku || '',
            quantity: item.quantity,
            unit: item.unit || item.equipment?.unit || 'шт.',
            category: parentItem?.equipment?.category || 'Видео',
            notes: item.notes || '',
            picked: item.picked || false,
            return_picked: item.return_picked || false,
            isFromComposition: true,
            isExtra: !!item.is_extra && !item.source_budget_item_id,
            parentName: parentItem?.equipment?.name || parentItem?.name
          });
          continue;
        }

        const isVirtual = item.equipment?.object_type === 'virtual';
        const isRailing = isStageRailing(item.equipment?.name, item.equipment?.sku) || isStageRailing(item.name, item.sku);

        if (!isVirtual) {
          if (item.equipment_id && mayChooseCase(item)) {
            try {
              const caseOptions = caseOptionsByEquipmentId.get(item.equipment_id) || [];
              if (caseOptions.length > 0) {
                const caseCapacityByCaseId = caseOptions.reduce<Record<string, number>>((acc, option) => {
                  acc[option.caseId] = option.componentQuantityInCase;
                  return acc;
                }, {});
                const optionsKey = caseOptions
                  .map(option => option.caseId)
                  .sort()
                  .join('|');
                const groupKey = `${optionsKey}::${item.location_id || 'no-location'}::${item.is_extra ? 'extra' : 'regular'}`;
                const componentItem: ComponentDecisionItem = {
                  budgetItemId: item.id,
                  equipmentId: item.equipment_id,
                  name: item.equipment?.name || item.name || 'Unknown',
                  sku: item.equipment?.sku || item.sku || '',
                  quantity: item.quantity,
                  notes: item.notes || '',
                  categoryId: item.category_id || null,
                  locationId: itemLocationId,
                  locationName: itemLocationName,
                  picked: item.picked || false,
                  return_picked: item.return_picked || false,
                  isExtra: !!item.is_extra && !item.source_budget_item_id,
                  caseCapacityByCaseId
                };

                const existingGroup = pendingGroupsByKey.get(groupKey);
                if (existingGroup) {
                  existingGroup.items.push(componentItem);
                } else {
                  const newGroup: ComponentDecisionGroup = {
                    groupId: groupKey,
                    caseOptions,
                    items: [componentItem]
                  };
                  pendingGroupsByKey.set(groupKey, newGroup);
                  pendingComponentDecisions.push(newGroup);
                }
              }
            } catch (error) {
              console.error('Error loading component case options:', error);
            }
          }

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
            unit: item.unit || item.equipment?.unit || 'шт.',
            category: item.equipment?.category || 'Other',
            notes: item.notes || '',
            picked: item.picked || false,
            return_picked: item.return_picked || false,
            isFromComposition: !!isSavedVirtualItem,
            isExtra: !!item.is_extra && !item.source_budget_item_id,
          });
          if (!isRailing && item.equipment?.object_type === 'physical' && item.equipment.has_composition) appendContents();
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
              unit: item.unit || item.equipment?.unit || 'шт.',
              category: item.equipment?.category || 'Other',
              notes: item.notes || '',
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: !!item.is_extra && !item.source_budget_item_id,
            });

            // Кейсы для LED экранов добавляются только после нажатия "Сохранить" в LedSpecificationPanel
          } else if (isPodiumBudgetItem(item) || isRailing) {
             items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: item.name || item.equipment?.name || "Unknown",
              sku: item.equipment?.sku || "",
              quantity: item.quantity,
              unit: item.unit || item.equipment?.unit || 'шт.',
              category: item.equipment?.category || "Other",
              notes: item.notes || "",
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: !!item.is_extra && !item.source_budget_item_id,
            });

            // Подиумы и ограждения получают дочерние строки после расчёта в спецификации.
          } else if (isUShapeBudgetItem(item) || isTotemBudgetItem(item)) {
            items.push({
              budgetItemId: item.id,
              categoryId: item.category_id || null,
              locationId: itemLocationId,
              locationName: itemLocationName,
              name: item.equipment?.name || item.name || 'Unknown',
              sku: item.equipment?.sku || item.sku || '',
              quantity: item.quantity,
              unit: item.unit || item.equipment?.unit || 'шт.',
              category: item.equipment?.category || 'Other',
              notes: item.notes || '',
              picked: item.picked || false,
              return_picked: item.return_picked || false,
              isFromComposition: false,
              isExtra: !!item.is_extra && !item.source_budget_item_id,
            });
          } else {
            // Non-LED virtual item - expand it into its components
            let hasExpandedChildren = false;

            // Check for composition
            if (item.equipment_id) {
              try {
                const compositions = compositionsByEquipmentId.get(item.equipment_id) || [];
                if (compositions.length > 0) {
                  hasExpandedChildren = true;
                }
                appendContents();
              } catch (error) {
                console.error('Error loading composition for', item.equipment?.name, ':', error);
              }
            }

            // Check for modifications
            if (item.modification_id) {
              try {
                const components = modificationComponentsById.get(item.modification_id) || [];
                if (components.length > 0) {
                  hasExpandedChildren = true;
                }
                for (const component of components) {
                  const subKey = buildStableCompositionItemKey(item.id, 'mod', component.id, component.component_equipment_id);
                  items.push({
                    budgetItemId: subKey,
                    parentBudgetItemId: item.id,
                    categoryId: item.category_id || null,
                    locationId: itemLocationId,
                    locationName: itemLocationName,
                    name: component.component?.name || 'Unknown',
                    sku: component.component?.sku || '',
                    quantity: item.quantity * component.quantity,
                    unit: component.component?.unit || 'шт.',
                    category: component.component?.category || 'Modification Components',
                    notes: item.notes || '',
                    picked: item.picked || false,
                    return_picked: item.return_picked || false,
                    isFromComposition: true,
                    isExtra: !!item.is_extra && !item.source_budget_item_id,
                    parentName: item.equipment?.name
                  });
                  (compositionPartsMap[item.id] = compositionPartsMap[item.id] || []).push({
                    key: subKey,
                    kind: 'mod',
                    equipment_id: component.component_equipment_id || null,
                    name: component.component?.name || 'Unknown',
                    sku: component.component?.sku || '',
                    category: component.component?.category || 'Modification Components',
                    quantity: item.quantity * component.quantity
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
                unit: item.unit || item.equipment?.unit || 'шт.',
                category: item.equipment?.category || 'Other',
                notes: item.notes || '',
                picked: item.picked || false,
                return_picked: item.return_picked || false,
                isFromComposition: false,
                isExtra: !!item.is_extra && !item.source_budget_item_id,
              });
            }
            }
            }
            }

            setComponentDecisionQueue(pendingComponentDecisions);
            setActiveComponentDecisionIndex(0);
            setCompositionPartsByParentId(compositionPartsMap);

            if (pendingChanges && pendingChanges.length > 0) {
              for (const change of pendingChanges) {
                const idx = items.findIndex(i => i.budgetItemId === change.id);
                if (idx >= 0) {
                  if (change.quantity !== undefined) items[idx].quantity = change.quantity;
                  if (change.notes !== undefined) items[idx].notes = change.notes;
                }
              }
            }

            // Восстанавливаем отметки виртуальных субэлементов раскладного состава,
            // сохранённые до перезагрузки страницы
            const compositionPickedSnapshot = readCompositionPickedSnapshot(budgetId);
            items.forEach((subItem) => {
              if (!isGeneratedCompositionItemId(subItem.budgetItemId)) return;
              const saved = compositionPickedSnapshot[subItem.budgetItemId];
              if (!saved) return;
              if (saved.picked !== undefined) subItem.picked = saved.picked;
              if (saved.return_picked !== undefined) subItem.return_picked = saved.return_picked;
            });

            const excludedKeys = new Set(budgetData.flatMap(item => item.excluded_child_keys || []));
            setExpandedItems(overlayMarks('equipment', items.filter(item => !excludedKeys.has(item.budgetItemId)), row => row.budgetItemId));
            if (liveItems && canReviewBudget && specificationIsEditable(event.status)) {
              setComparisonRequest({ budget: liveItems, specification: budgetData, catalog });
            }
    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      setRemoteStructureChanged(false);
    }
  };

  const handleLedCasesCalculated = (budgetItemId: string, cases: CalculatedCase[]) => {
    if (!canEditMainSpecification) return;
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
      parentBudgetItemId: budgetItemId,
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

  const handleStageCompositionCalculated = (budgetItemId: string, selectedModules: PodiumModule[], multiplier: number) => {
    if (!canEditMainSpecification) return;
    const parent = expandedItems.find(item => item.budgetItemId === budgetItemId);
    if (!parent) return;

    const currentChildren = new Map(expandedItems.filter(item => item.parentBudgetItemId === budgetItemId)
      .map(item => [item.budgetItemId, item]));
    const newChildItems: ExpandedItem[] = selectedModules.map(module => {
      const quantity = multiplier * module.quantity;
      const existing = currentChildren.get(module.id);
      return existing ? { ...existing, quantity } : {
        budgetItemId: `${budgetItemId}-podium-${module.id}`,
        parentBudgetItemId: budgetItemId,
        categoryId: parent.categoryId,
        locationId: parent.locationId,
        locationName: parent.locationName,
        name: module.name,
        sku: module.sku,
        quantity,
        unit: 'шт.',
        category: module.category || 'Конструкции',
        notes: isRailingCalculator ? 'Элемент ограждения' : `Элемент подиума для ${parent.name}`,
        picked: parent.picked,
        return_picked: false,
        isFromComposition: true,
        parentName: parent.name,
      };
    });

    setExpandedItems(prev => {
      const filtered = prev.filter(item => item.parentBudgetItemId !== budgetItemId);
      const parentIndex = filtered.findIndex(item => item.budgetItemId === budgetItemId);
      const updated = [...filtered];
      if (parentIndex >= 0) {
        updated.splice(parentIndex + 1, 0, ...newChildItems);
      } else {
        updated.push(...newChildItems);
      }
      return updated;
    });
    setStageCompositionDrafts(prev => new Set(prev).add(budgetItemId));
    setModifiedItems(prev => new Set([...prev].filter(id => !currentChildren.has(id))).add(budgetItemId));
  };

  const handleComponentDecision = async (selectedCase: ComponentCaseOption | null) => {
    const group = componentDecisionQueue[activeComponentDecisionIndex];
    if (!group || loading || componentChoiceInFlight.current || group.items.some(item => item.isExtra ? !canEditSpecification : !canEditMainSpecification)) return;
    componentChoiceInFlight.current = true;
    setSavingComponentChoice(true);
    try {
      const replacement = selectedCase ? buildCaseExpandedItems(group, selectedCase)[0] : null;
      if (selectedCase && !replacement) return;
      const itemIds = group.items.map(item => item.budgetItemId);
      await saveSpecificationComponentChoice(eventId, itemIds, replacement);
      setActiveComponentDecisionIndex(index => index + 1);
      showNotification('Выбор сохранён', 'success');

      if (!replacement) {
        const selectedIds = new Set(itemIds);
        const markSeparate = <T extends { id: string },>(rows: T[]) =>
          rows.map(row => selectedIds.has(row.id) ? { ...row, component_selection: 'separate' as const } : row);
        setBudgetItems(markSeparate);
        const snapshot = loadedSnapshot.current;
        if (snapshot) {
          snapshot.equipment = markSeparate(snapshot.equipment);
          loadedStructure.current = specificationStructureKey(snapshot);
        }
        return;
      }

      // The server allocates the replacement row ID. Refresh after advancing the
      // dialog and preserve unrelated changes while the new row loads.
      const changed = expandedItems.filter(item => modifiedItems.has(item.budgetItemId))
        .map(item => ({ id: item.budgetItemId, quantity: item.quantity, notes: item.notes }));
      await loadData(changed);
    } catch (error) {
      showNotification(getErrorMessage(error));
    } finally {
      componentChoiceInFlight.current = false;
      setSavingComponentChoice(false);
    }
  };

  const handleComponentDecisionSeparate = () => { void handleComponentDecision(null); };
  const handleComponentDecisionUseCase = (selectedCase: ComponentCaseOption) => { void handleComponentDecision(selectedCase); };

  const canEditEquipmentRow = (id: string) => {
    const row = expandedItems.find(item => item.budgetItemId === id);
    if (row) return row.isExtra ? canEditSpecification : canEditMainSpecification;
    // Virtual parents have no displayed row, but own their generated children.
    const parent = budgetItems.find(item => item.id === id);
    return !!parent && (parent.is_extra && !parent.source_budget_item_id ? canEditSpecification : canEditMainSpecification);
  };
  const canMarkEquipmentRow = (id: string) => {
    const row = expandedItems.find(item => item.budgetItemId === id);
    return !!row && (row.isExtra ? confirmedProject && canAccess(user, 'specifications', 2) : canMarkMainSpecification);
  };

  const persistCompositionPickedState = async (budgetItemId: string, patch: { picked?: boolean; return_picked?: boolean }) => {
    const row = expandedItems.find(item => item.budgetItemId === budgetItemId);
    if (!row) throw new Error('Позиция не найдена. Обновите спецификацию.');
    const parentId = row.parentBudgetItemId || getPersistedBudgetItemId(budgetItemId);
    for (const field of ['picked', 'return_picked'] as const) {
      const value = patch[field];
      if (value !== undefined) await saveGeneratedRowMark(eventId, budgetId, parentId, budgetItemId, field, value, row.name);
    }
    const snapshot = readCompositionPickedSnapshot(budgetId);
    snapshot[budgetItemId] = { ...(snapshot[budgetItemId] || {}), ...patch };
    writeCompositionPickedSnapshot(budgetId, snapshot);
    collaboration.refresh();
  };

  const changeEquipmentMark = (id: string, field: 'picked' | 'return_picked', value: boolean) => {
    if (selectionResetInFlight.current || !canMarkEquipmentRow(id) || (field === 'picked' ? eventDetails?.equipment_shipped : !eventDetails?.equipment_shipped || eventDetails?.equipment_returned)) return Promise.resolve();
    const row = expandedItems.find(item => item.budgetItemId === id);
    return optimisticMarks.current.change(markKey('equipment', id, field), value, {
      read: () => !!row?.[field],
      apply: next => setExpandedItems(previous => previous.map(item => item.budgetItemId === id ? { ...item, [field]: next } : item)),
      save: () => isGeneratedCompositionItemId(id) ? persistCompositionPickedState(id, { [field]: value }) : field === 'picked' ? updateSpecificationBudgetItemPicked(id, value) : updateSpecificationBudgetItemReturnPicked(id, value),
      onError: () => showNotification('Не удалось сохранить отметку. Предыдущее значение восстановлено.'),
      settled: () => collaboration.refresh(),
    });
  };
  const handlePickedChange = (id: string, picked: boolean) => changeEquipmentMark(id, 'picked', picked);

  const changeAccessoryMark = (kind: 'cables' | 'connectors' | 'other', id: string, field: 'picked' | 'return_picked', value: boolean) => {
    if (selectionResetInFlight.current || !canAdjustAccessories || (field === 'picked' ? eventDetails?.equipment_shipped : !eventDetails?.equipment_shipped || eventDetails?.equipment_returned)) return Promise.resolve();
    const rows = kind === 'cables' ? cables : kind === 'connectors' ? connectors : otherItems;
    const row = rows.find(item => item.id === id);
    const apply = (next: boolean) => {
      if (kind === 'cables') setCables(previous => previous.map(item => item.id === id ? {...item, [field]: next} : item));
      else if (kind === 'connectors') setConnectors(previous => previous.map(item => item.id === id ? {...item, [field]: next} : item));
      else setOtherItems(previous => previous.map(item => item.id === id ? {...item, [field]: next} : item));
    };
    return optimisticMarks.current.change(markKey(kind, id, field), value, {
      read: () => !!row?.[field], apply,
      save: () => kind === 'cables' ? updateCable(id, {[field]:value}) : kind === 'connectors' ? updateConnector(id, {[field]:value}) : updateOtherItem(id, {[field]:value}),
      onError: () => showNotification('Не удалось сохранить отметку. Предыдущее значение восстановлено.'),
      settled: () => collaboration.refresh(),
    });
  };
  const handleCablePickedChange = (id: string, picked: boolean) => changeAccessoryMark('cables', id, 'picked', picked);
  const handleConnectorGroupPickedChange = (category: string, itemType: string, picked: boolean) => Promise.all(connectors.filter(row => isConnectorMatch(row, category, itemType)).map(row => changeAccessoryMark('connectors', row.id, 'picked', picked)));

  const handleConfirmShipment = async () => {
    if ((optimisticMarks.current.hasPending() || quantityQueue.current.hasPending())) { showNotification('Дождитесь сохранения изменений.'); return; }
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
      await updateBudgetSpecification(eventId, budgetId, { equipment_shipped: true, equipment_shipped_at: new Date().toISOString() });
      setEventDetails({ ...eventDetails, equipment_shipped: true });
    } catch (error) {
      console.error('Error confirming shipment:', error);
      showNotification('Ошибка при подтверждении отгрузки');
    } finally {
      setConfirmingShipment(false);
    }
  };

  const handleConfirmReturn = async () => {
    if ((optimisticMarks.current.hasPending() || quantityQueue.current.hasPending())) { showNotification('Дождитесь сохранения изменений.'); return; }
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
      await updateBudgetSpecification(eventId, budgetId, { equipment_returned: true, equipment_returned_at: new Date().toISOString() });
      setEventDetails({ ...eventDetails, equipment_returned: true });
    } catch (error) {
      console.error('Error confirming return:', error);
      showNotification('Ошибка при подтверждении приёма');
    } finally {
      setConfirmingReturn(false);
    }
  };

  const handleResetSpecification = async () => {
    if (!canEditMainSpecification || !canAccess(user, 'specifications', 3) || eventDetails?.equipment_shipped || resetInProgress) return;
    try {
      setResettingSpecification(true);
      await resetWarehouseSpecificationSnapshot(eventId, budgetId);
      // При сбросе спецификации очищаем и локальные отметки субэлементов раскладного состава
      try {
        localStorage.removeItem(buildCompositionPickedStorageKey(budgetId));
      } catch {
        // ignore storage errors
      }
      setModifiedItems(new Set());
      setItemsWithAppliedModifications(new Set());
      setLedItemsWithCases(new Set());
      setStageCompositionDrafts(new Set());
      setComponentDecisionQueue([]);
      setActiveComponentDecisionIndex(0);
      setResetDialog(null);
      await loadData();
      showNotification('Спецификация сброшена до состояния сметы', 'success');
    } catch (error) {
      console.error('Error resetting specification:', error);
      showNotification('Ошибка при сбросе спецификации');
    } finally {
      setResettingSpecification(false);
    }
  };

  const handleResetAllSelections = async () => {
    if (!canEditMainSpecification || eventDetails?.equipment_shipped || selectionResetInFlight.current) return;
    if (optimisticMarks.current.hasPending()) {
      showNotification('Дождитесь сохранения отметок и повторите сброс.');
      return;
    }
    selectionResetInFlight.current = true;
    setResettingSelections(true);
    try {
      await resetWarehouseSpecificationMarks(eventId, budgetId);

      writeCompositionPickedSnapshot(budgetId, {});
      const clearMarks = <T extends { picked?: boolean; return_picked?: boolean },>(rows: T[]): T[] =>
        rows.map(row => row.picked || row.return_picked ? { ...row, picked: false, return_picked: false } : row);
      setExpandedItems(clearMarks);
      setBudgetItems(clearMarks);
      setCables(clearMarks);
      setConnectors(clearMarks);
      setOtherItems(clearMarks);
      setResetDialog(null);
      showNotification('Все выделения сброшены', 'success');
    } catch (error) {
      console.error('Error resetting all selections:', error);
      showNotification('Ошибка при сбросе выделений');
    } finally {
      selectionResetInFlight.current = false;
      setResettingSelections(false);
      collaboration.refresh();
    }
  };

  const handleReturnPickedChange = (id: string, value: boolean) => changeEquipmentMark(id, 'return_picked', value);
  const handleCableReturnPickedChange = (id: string, value: boolean) => changeAccessoryMark('cables', id, 'return_picked', value);
  const handleConnectorGroupReturnPickedChange = (category: string, itemType: string, value: boolean) => Promise.all(connectors.filter(row => isConnectorMatch(row, category, itemType)).map(row => changeAccessoryMark('connectors', row.id, 'return_picked', value)));
  const handleOtherReturnPickedChange = (id: string, value: boolean) => changeAccessoryMark('other', id, 'return_picked', value);

  const getPendingConfirmationItems = (mode: 'shipment' | 'return'): PendingConfirmationItem[] => {
    const isPicked = (picked: boolean, returnPicked: boolean) => mode === 'shipment' ? picked : returnPicked;
    const normalizeText = (value?: string | null) => (value || '').trim();
    const fallbackName = (value: string, fallback: string) => value.length > 0 ? value : fallback;

    const equipmentPending = pickableExpandedItems
      .filter(item => !item.isExtra)
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `eq-${item.budgetItemId}`,
        name: item.name,
        group: 'equipment' as const
      }));

    const extraPending = pickableExpandedItems
      .filter(item => item.isExtra)
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `extra-${item.budgetItemId}`,
        name: item.name,
        group: 'extra' as const
      }));

    // Keep only the first record per cable type/length pair to match how cables are rendered in the table.
    // Historical duplicated rows may exist in DB, and showing each duplicate here can produce false pending items.
    const visibleCablesByKey = new Map<string, CableItem>();
    cables.filter(item => item.quantity > 0).forEach(item => {
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
          `${normalizeText(item.cable_type)} ${cableLengthDisplayName(normalizeText(item.cable_type), normalizeText(item.cable_length))}`.trim(),
          `Кабель #${item.id.slice(0, 8)}`
        ),
        group: 'cables' as const
      }));

    const connectorsPendingByType = new Map<string, PendingConfirmationItem>();
    connectors
      .filter(item => item.quantity > 0)
      .filter(item => !isPicked(item.picked, item.return_picked))
      .forEach(item => {
        const normalizedType = normalizeText(item.connector_type);
        const key = normalizedType || item.id;
        if (!connectorsPendingByType.has(key)) {
          connectorsPendingByType.set(key, {
            id: `connector-${key}`,
            name: fallbackName(connectorDisplayName(parseConnectorScopedType(normalizedType).itemType), `Коннектор #${item.id.slice(0, 8)}`),
            group: 'connectors'
          });
        }
      });
    const connectorsPending = Array.from(connectorsPendingByType.values());

    // Keep only the first record per (category + item_type) pair to match template rendering in "Прочее".
    // Historical duplicated rows may exist in DB, and hidden duplicates should not block confirmation modal.
    const visibleOtherByKey = new Map<string, OtherItem>();
    otherItems.filter(item => item.quantity > 0).forEach(item => {
      const normalizedCategory = normalizeText(item.category);
      const normalizedItemType = normalizeText(item.item_type);
      const key = `${normalizedCategory}|${normalizedItemType}`;
      if (!visibleOtherByKey.has(key)) {
        visibleOtherByKey.set(key, item);
      }
    });

    const otherPending = Array.from(visibleOtherByKey.values())
      .filter(item => !isPicked(item.picked, item.return_picked))
      .map(item => ({
        id: `other-${item.id}`,
        name: fallbackName(
          `${normalizeText(item.category)} ${normalizeText(item.item_type)}`.trim(),
          `Прочее #${item.id.slice(0, 8)}`
        ),
        group: 'other' as const
      }));

    return [...equipmentPending, ...extraPending, ...cablesPending, ...connectorsPending, ...otherPending];
  };

  const addItemToLocalState = (newItem: BudgetItem, equipment?: EquipmentItem) => {
    setBudgetItems(prev => [...prev, newItem]);
    const locationName = newItem.location_id
      ? locations.find(l => l.id === newItem.location_id)?.name || ''
      : '';
    const newExpandedItem: ExpandedItem = {
      budgetItemId: newItem.id,
      categoryId: newItem.category_id || null,
      locationId: newItem.location_id || null,
      locationName: locationName || 'Без локации',
      name: newItem.equipment?.name || equipment?.name || newItem.name || 'Unknown',
      sku: newItem.equipment?.sku || equipment?.sku || newItem.sku || '',
      quantity: newItem.quantity,
      unit: newItem.unit || newItem.equipment?.unit || equipment?.unit || 'шт.',
      category: newItem.equipment?.category || equipment?.category || 'Other',
      notes: newItem.notes || '',
      picked: newItem.picked || false,
      return_picked: newItem.return_picked || false,
      isFromComposition: false,
      isExtra: newItem.is_extra || false,
    };
    setExpandedItems(prev => [...prev, newExpandedItem]);
  };

  const handleAddExtraEquipment = async (equipment: EquipmentItem, quantity: number, modificationId?: string) => {
    try {
      const newItem = await createSpecificationBudgetItem({
        event_id: eventId, budget_id: budgetId,
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
      // Optimized: add new item to local state instead of full reload
      addItemToLocalState(newItem, equipment);
      showNotification('Оборудование добавлено', 'success');
    } catch (error) {
      console.error('Error adding extra equipment:', error);
      showNotification('Ошибка при добавлении оборудования');
    }
  };

  const handleOpenModificationSelector = async (budgetItem: BudgetItem) => {
    if (!canEditMainSpecification) return;
    const equipmentId = budgetItem.equipment_id;
    if (!equipmentId) return;
    
    setLoadingModifications(true);
    
    // Check if we already have modifications loaded for this equipment
    if (!equipmentModifications[equipmentId]) {
      try {
        const mods = await getEquipmentModifications(equipmentId);
        setEquipmentModifications(prev => ({
          ...prev,
          [equipmentId]: mods
        }));
      } catch (error) {
        console.error('Error loading modifications for equipment', equipmentId, ':', error);
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
    if (!canEditMainSpecification) return;
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
    if (!canEditMainSpecification) return;
    if (!selectedBudgetItemForMod || !selectedModification) return;
    
    // Add components as expanded items
    const newItems: ExpandedItem[] = modificationComponents
      .filter(comp => componentQuantities[comp.id] > 0)
      .map(comp => ({
        budgetItemId: `${selectedBudgetItemForMod.id}-mod-${comp.id}-${Date.now()}`,
        parentBudgetItemId: selectedBudgetItemForMod.id,
        categoryId: selectedBudgetItemForMod.category_id || null,
        locationId: selectedBudgetItemForMod.location_id || null,
        locationName: selectedBudgetItemForMod.location?.name || 'Без локации',
        name: comp.component?.name || 'Unknown',
        sku: comp.component?.sku || '',
        quantity: componentQuantities[comp.id],
        unit: comp.component?.unit || 'шт.',
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
    if (!canEditMainSpecification) return;
    try {
      const newItem = await createSpecificationBudgetItem({
        event_id: eventId, budget_id: budgetId,
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
      // Optimized: add new item to local state instead of full reload
      addItemToLocalState(newItem, equipment);
      showNotification('Оборудование добавлено', 'success');
    } catch (error) {
      console.error('Error adding equipment:', error);
      showNotification('Ошибка при добавлении оборудования');
    }
  };

  const handleBatchAddEquipment = async (items: Array<{ equipment: EquipmentItem; quantity: number; modificationId?: string }>) => {
    const addHandler = activeTab === 'extra' ? handleAddExtraEquipment : handleAddEquipment;

    for (const item of items) {
      await addHandler(item.equipment, item.quantity, item.modificationId);
    }

    setShowEquipmentSelector(false);
    setAddEquipmentTarget({ categoryId: null, locationId: null });
  };

  const openEquipmentSelectorForCategory = (categoryId: string | null, locationId: string | null) => {
    if (!canEditMainSpecification) return;
    setAddEquipmentTarget({ categoryId, locationId });
    setShowEquipmentSelector(true);
  };

  const handleQuantityChange = (budgetItemId: string, newQuantity: number) => {
    if (!canEditEquipmentRow(budgetItemId)) return;
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
    if (!pendingQuantityChange || !canEditEquipmentRow(pendingQuantityChange.budgetItemId)) return;

    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === pendingQuantityChange.budgetItemId
        ? { ...item, quantity: pendingQuantityChange.toQuantity }
        : item
    ));

    // Track modified item (extract real budget item ID for composed items)
    const realId = getPersistedBudgetItemId(pendingQuantityChange.budgetItemId);
    setModifiedItems(prev => new Set(prev).add(realId));
    setPendingQuantityChange(null);
  };

  const cancelQuantityChange = () => {
    setPendingQuantityChange(null);
  };

  const handleNotesChange = (budgetItemId: string, newNotes: string) => {
    if (!canEditEquipmentRow(budgetItemId)) return;
    setExpandedItems(expandedItems.map(item =>
      item.budgetItemId === budgetItemId ? { ...item, notes: newNotes } : item
    ));
    // Track modified item (extract real budget item ID for composed items)
    const realId = getPersistedBudgetItemId(budgetItemId);
    setModifiedItems(prev => new Set(prev).add(realId));
  };

  const handleDeleteSpecificationItem = async (budgetItemId: string) => {
    if (!canEditEquipmentRow(budgetItemId) || !canAccess(user, 'specifications', 3) || eventDetails?.equipment_shipped) return;
    const row = expandedItems.find(item => item.budgetItemId === budgetItemId);
    if (!row) return;
    try {
      if (isGeneratedCompositionItemId(budgetItemId)) {
        const parentId = row.parentBudgetItemId || getPersistedBudgetItemId(budgetItemId);
        await excludeSpecificationChild(eventId, parentId, budgetItemId);
        setBudgetItems(prev => prev.map(item => item.id === parentId
          ? { ...item, excluded_child_keys: [...new Set([...(item.excluded_child_keys || []), budgetItemId])] }
          : item));
        // A generated child has no database row: never delete its parent.
        setExpandedItems(prev => prev.filter(item => item.budgetItemId !== budgetItemId));
      } else {
        await deleteSpecificationBudgetItem(budgetItemId);
        setBudgetItems(prev => prev.filter(item => item.id !== budgetItemId && item.parent_budget_item_id !== budgetItemId));
        setExpandedItems(prev => prev.filter(item => item.budgetItemId !== budgetItemId
          && item.parentBudgetItemId !== budgetItemId
          && getPersistedBudgetItemId(item.budgetItemId) !== budgetItemId));
        setModifiedItems(prev => {
          const updated = new Set(prev);
          updated.delete(budgetItemId);
          return updated;
        });
      }
      showNotification('Элемент удалён', 'success');
    } catch (error) {
      console.error('Error deleting specification item:', error);
      showNotification(getErrorMessage(error));
    }
  };

  const requestDeleteSpecificationItem = (budgetItemId: string, itemName: string) => {
    setPendingDeleteItem({ budgetItemId, itemName });
  };

  const handleSaveChanges = async () => {
    if (modifiedItems.size === 0 || [...modifiedItems].some(id => !canEditEquipmentRow(id))) return;
    
    setSavingChanges(true);
    try {
      const errors: string[] = [];
      const createdItems: { oldId: string; newId: string }[] = [];
      const modifiedBudgetItemIds = new Set(modifiedItems);

      for (const budgetItemId of modifiedBudgetItemIds) {
        // Check if this budget item has LED cases that need to be created
        const caseItems = expandedItems.filter(item => 
          item.budgetItemId.startsWith(`${budgetItemId}-case-`)
        );
        const hasStageCompositionDraft = stageCompositionDrafts.has(budgetItemId);
        
        // Delete existing LED case children from DB before creating new ones (prevent duplicates)
        // Always fetch fresh from DB to avoid stale cache issues
        if (caseItems.length > 0) {
          const freshItemsForLed = await getSpecificationBudgetItems(eventId, budgetId);
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
              event_id: eventId, budget_id: budgetId,
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
              return_picked: caseItem.return_picked,
              sort_order: 0
            });
            const newItem = await createSpecificationBudgetItem({
              event_id: eventId, budget_id: budgetId,
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
              return_picked: caseItem.return_picked,
              sort_order: 0
            });
            createdItems.push({ oldId: caseItem.budgetItemId, newId: newItem.id });
          } catch (err) {
            // Supabase/PostgREST errors carry message/details/hint alongside the error itself.
            const errorInfo = err as { message?: string; details?: string; hint?: string };
            console.error('Error creating LED case budget item:', caseItem.budgetItemId, err);
            console.error('Error message:', errorInfo.message);
            console.error('Error details:', errorInfo.details);
            console.error('Error hint:', errorInfo.hint);
          }
        }

        if (hasStageCompositionDraft) {
          try {
            const childItems = expandedItems.filter(item => item.parentBudgetItemId === budgetItemId);
            const freshItems = await getSpecificationBudgetItems(eventId, budgetId);
            const existingChildren = freshItems.filter(item => item.parent_budget_item_id === budgetItemId);
            const retainedIds = new Set<string>();
            const savedChildren: typeof createdItems = [];

            for (const child of childItems) {
              // Match by name and SKU if an earlier save created this row before failing.
              const existing = existingChildren.find(item => item.id === child.budgetItemId) ?? existingChildren.find(item =>
                !retainedIds.has(item.id) && !childItems.some(row => row.budgetItemId === item.id) &&
                item.name === child.name && (item.sku || '') === child.sku
              );
              if (existing) {
                retainedIds.add(existing.id);
                if (existing.quantity !== child.quantity || existing.notes !== child.notes) {
                  await updateSpecificationBudgetItem(existing.id, { quantity: child.quantity, notes: child.notes });
                }
                if (existing.id !== child.budgetItemId) savedChildren.push({ oldId: child.budgetItemId, newId: existing.id });
                continue;
              }

              const created = await createSpecificationBudgetItem({
                event_id: eventId, budget_id: budgetId, item_type: 'equipment', equipment_id: null,
                category_id: child.categoryId, location_id: child.locationId, parent_budget_item_id: budgetItemId,
                name: child.name, sku: child.sku, quantity: child.quantity, notes: child.notes,
                price: 0, total: 0, exchange_rate: 1, picked: child.picked, return_picked: child.return_picked, sort_order: 0,
              });
              savedChildren.push({ oldId: child.budgetItemId, newId: created.id });
            }
            for (const child of existingChildren) {
              if (!retainedIds.has(child.id)) await deleteSpecificationBudgetItem(child.id);
            }
            createdItems.push(...savedChildren);
          } catch (error) {
            console.error('Error saving stage specification child items:', budgetItemId, error);
            errors.push(expandedItems.find(item => item.budgetItemId === budgetItemId)?.name || 'Состав сцены');
          }
        }
        // Find the expanded item to get current values for quantity/notes update
        const expandedItem = expandedItems.find(item => item.budgetItemId === budgetItemId);
        
        if (!expandedItem) continue;
        
        // Check if this is the parent LED item that has cases attached
        const hasCases = caseItems.length > 0;
        if (hasCases) {
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
              event_id: eventId, budget_id: budgetId,
              item_type: 'equipment',
              equipment_id: null,
              work_item_id: null,
              category_id: expandedItem.categoryId,
              name: expandedItem.name,
              sku: expandedItem.sku,
              quantity: expandedItem.quantity,
              notes: expandedItem.notes,
              picked: expandedItem.picked,
              return_picked: expandedItem.return_picked
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
        // Отметки субэлементов, которые стали реальными записями БД после сохранения,
        // больше не нужны в локальном снимке — удаляем их, чтобы не переносить устаревшие значения
        const persistedVirtualIds = createdItems.map(c => c.oldId);
        if (persistedVirtualIds.length > 0) {
          const snapshot = readCompositionPickedSnapshot(budgetId);
          let snapshotChanged = false;
          for (const virtualId of persistedVirtualIds) {
            if (snapshot[virtualId] !== undefined) {
              delete snapshot[virtualId];
              snapshotChanged = true;
            }
          }
          if (snapshotChanged) {
            writeCompositionPickedSnapshot(budgetId, snapshot);
          }
        }

        setModifiedItems(new Set());
        setStageCompositionDrafts(new Set());

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

  const handleSetCableQuantityFromTemplate = async (cableType: string, cableLength: string, value: number, delta = false) => {
    if (!canAdjustAccessories || eventDetails?.equipment_shipped) return;
    try {
      await quantityQueue.current.change(JSON.stringify([eventId, 'cable', cableType, cableLength]), delta ? { delta: value } : { set: value }, {
        read: () => cablesRef.current.filter(row => row.cable_type === cableType && row.cable_length === cableLength).reduce((sum, row) => sum + row.quantity, 0),
        notify: () => refreshQuantityDisplay(value => value + 1),
        failed: () => showNotification('Не удалось сохранить количество. Восстановлено сохранённое значение.'),
        settled: () => collaboration.refresh(),
        save: target => writeGroupedQuantity({
        rows: cablesRef.current.filter(row => row.cable_type === cableType && row.cable_length === cableLength),
        change: { set: target },
        create: quantity => createCable({ event_id: eventId, budget_id: budgetId, cable_type: cableType, cable_length: cableLength, quantity, notes: '', picked: false, return_picked: false }),
        update: (id, quantity) => updateCable(id, { quantity }),
        commit: row => { row = overlayMarks('cables', [row], value => value.id)[0]; const next = cablesRef.current.some(item => item.id === row.id) ? cablesRef.current.map(item => item.id === row.id ? row : item) : [...cablesRef.current, row]; cablesRef.current = next; setCables(next); }
        }),
      });
    } catch (error) { showNotification(getErrorMessage(error)); }
  };

  const handleSetConnectorQuantityFromTemplate = async (category: string, itemType: string, value: number, delta = false) => {
    if (!canAdjustAccessories || eventDetails?.equipment_shipped) return;
    try {
      await quantityQueue.current.change(JSON.stringify([eventId, 'connector', category, itemType]), delta ? { delta: value } : { set: value }, {
        read: () => connectorsRef.current.filter(row => isConnectorMatch(row, category, itemType) || (!DUPLICATE_CONNECTOR_ITEMS.has(itemType) && isLegacyConnectorMatch(row, buildConnectorScopedType(category, itemType), itemType))).reduce((sum, row) => sum + row.quantity, 0),
        notify: () => refreshQuantityDisplay(value => value + 1),
        failed: () => showNotification('Не удалось сохранить количество. Восстановлено сохранённое значение.'),
        settled: () => collaboration.refresh(),
        save: target => writeGroupedQuantity({
        rows: connectorsRef.current.filter(row => isConnectorMatch(row, category, itemType)
          || (!DUPLICATE_CONNECTOR_ITEMS.has(itemType) && isLegacyConnectorMatch(row, buildConnectorScopedType(category, itemType), itemType))),
        change: { set: target },
        create: quantity => createConnector({ event_id: eventId, budget_id: budgetId, connector_type: category, connector_item: itemType, quantity, notes: '', picked: false, return_picked: false }),
        update: (id, quantity) => updateConnector(id, { quantity }),
        commit: row => { row = overlayMarks('connectors', [row], value => value.id)[0]; const next = connectorsRef.current.some(item => item.id === row.id) ? connectorsRef.current.map(item => item.id === row.id ? row : item) : [...connectorsRef.current, row]; connectorsRef.current = next; setConnectors(next); }
        }),
      });
    } catch (error) { showNotification(getErrorMessage(error)); }
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

  const handleSetOtherQuantityFromTemplate = async (category: string, itemType: string, value: number, delta = false) => {
    if (!canAdjustAccessories || eventDetails?.equipment_shipped) return;
    try {
      await quantityQueue.current.change(JSON.stringify([eventId, 'other', category, itemType]), delta ? { delta: value } : { set: value }, {
        read: () => otherItemsRef.current.filter(row => row.category === category && row.item_type === itemType).reduce((sum, row) => sum + row.quantity, 0),
        notify: () => refreshQuantityDisplay(value => value + 1),
        failed: () => showNotification('Не удалось сохранить количество. Восстановлено сохранённое значение.'),
        settled: () => collaboration.refresh(),
        save: target => writeGroupedQuantity({
        rows: otherItemsRef.current.filter(row => row.category === category && row.item_type === itemType),
        change: { set: target },
        create: quantity => createOtherItem({ event_id: eventId, budget_id: budgetId, category, item_type: itemType, quantity, notes: '', picked: false, return_picked: false }),
        update: (id, quantity) => updateOtherItem(id, { quantity }),
        commit: row => { row = overlayMarks('other', [row], value => value.id)[0]; const next = otherItemsRef.current.some(item => item.id === row.id) ? otherItemsRef.current.map(item => item.id === row.id ? row : item) : [...otherItemsRef.current, row]; otherItemsRef.current = next; setOtherItems(next); }
        }),
      });
    } catch (error) { showNotification(getErrorMessage(error)); }
  };

  const handleOtherPickedChange = (id: string, value: boolean) => changeAccessoryMark('other', id, 'picked', value);
  if (initialLoading && loading) {
    return <p role="status" className="p-4 text-sm text-gray-300">Загрузка спецификации…</p>;
  }
  if (loadError && !eventDetails) {
    return <div role="alert" className="space-y-3 p-4 text-sm text-gray-300">
      <p>Не удалось загрузить спецификацию.</p>
      <button type="button" onClick={() => void loadData()} disabled={loading} className="min-h-11 rounded-lg border border-gray-700 px-3 hover:bg-gray-800 disabled:opacity-50">Повторить</button>
    </div>;
  }

  return (
    <section aria-labelledby="specification-heading" className="flex h-full min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {showLogs && canViewSpecificationLogs(user, eventDetails?.site_manager_id) && <SpecificationLogs eventId={eventId} budgetId={budgetId} onClose={() => setShowLogs(false)} />}
        {hasBudgetDifferences && (
          <MobileHeaderContent slot="afterTitle" page>
            <button type="button" onClick={openBudgetChanges} aria-label="Расхождения со сметой" title="Расхождения со сметой"
              className="grid h-11 w-11 place-items-center rounded-lg text-yellow-400 hover:bg-gray-800">
              <AlertCircle aria-hidden="true" className="h-5 w-5" />
            </button>
          </MobileHeaderContent>
        )}
        {showBudgetChanges && canReviewSpecification && comparisonContents && !budgetSourceError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3">
            <div role="dialog" aria-modal="true" aria-label="Расхождения со сметой"
              onKeyDown={event => { if (event.key === 'Escape' && !applyingChanges) setShowBudgetChanges(false); }}
              className="max-h-full w-full max-w-xl overflow-y-auto overscroll-contain rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h3 className="font-semibold text-white">Расхождения со сметой</h3>
              <p className="my-3 text-sm text-gray-300">
                {differences.length ? `Количество расхождений: ${differences.length}.` : 'Смета и спецификация совпадают.'}
                {canApplyBudgetChanges && differences.length > 0 && ' Выберите позиции, чтобы перенести изменения из сметы. Обновление сбросит отметки сборки позиции, а удаление также удалит её дочерние строки.'}
              </p>
              <ul>
                {differences.map(change => (
                  <li key={change.sourceId} className="flex items-start gap-2 border-t border-gray-800 py-3 text-sm text-gray-200">
                    <label className="flex w-full items-start gap-2">
                      {canApplyBudgetChanges && <input type="checkbox" checked={selectedChanges.has(change.sourceId)} disabled={applyingChanges || change.requiresManual || (change.kind === 'remove' && !canAccess(user, 'specifications', 3))}
                        onChange={event => setSelectedChanges(previous => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(change.sourceId);
                          else next.delete(change.sourceId);
                          return next;
                        })} />}
                      <span className="min-w-0 break-words">
                        {change.requiresManual ? 'Проверить содержимое' : change.kind === 'add' ? 'Добавить' : change.kind === 'remove' ? 'Удалить' : 'Обновить'}: {change.name}
                        {change.source && change.saved && ` (${change.saved.quantity} → ${change.source.quantity})`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {canApplyBudgetChanges && modifiedItems.size > 0 && <p className="text-sm text-amber-400">Сначала сохраните ручные изменения спецификации.</p>}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" autoFocus disabled={applyingChanges} onClick={() => setShowBudgetChanges(false)} className="min-h-11 px-3 text-sm text-gray-300">Закрыть</button>
                {canApplyBudgetChanges && differences.length > 0 && <button type="button" disabled={applyingChanges || !selectedChanges.size || modifiedItems.size > 0} onClick={() => void applyBudgetChanges()} className="min-h-11 rounded-lg bg-accent-500 px-3 text-sm text-gray-950 disabled:opacity-40">Применить выбранное</button>}
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute top-3 right-14 z-20 rounded-md border border-accent-700/50 bg-gray-900/90 px-2 py-1 text-xs text-accent-300">
            Обновление...
          </div>
        )}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-800 px-2 py-2 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h2 id="specification-heading" className="break-words text-sm font-semibold leading-tight text-white sm:text-lg">
              {budgetName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {eventDetails && (
                <>
                  {eventDetails.event_date && (
                    <p className="text-xs text-gray-400">
                      {new Date(eventDetails.event_date).toLocaleDateString('ru-RU')}
                    </p>
                  )}
                  {eventDetails.specification_confirmed && (
                    <span className="px-1.5 py-0.5 bg-green-900/30 text-green-400 border border-green-600/30 rounded text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Подтверждено
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {canReviewSpecification && <button type="button" onClick={() => setShowLogs(true)} className="min-h-11 rounded border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800">Логи</button>}
            <button
              disabled={!confirmedProject}
              onClick={() => setShowStickyNotes(!showStickyNotes)}
              className={`flex min-h-11 min-w-11 items-center justify-center sm:min-h-0 sm:min-w-0 sm:p-1.5 hover:bg-gray-800 hover:text-yellow-400 rounded transition-colors ${stickyNotes.some(note => note.content.trim()) ? 'text-yellow-400' : 'text-gray-400'}`}
              title="Заметки"
            >
              <StickyNote className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-800 bg-gray-900/50">
          <div className="flex overflow-x-auto sm:gap-2 sm:px-4">
            {(['budget', 'cables', 'connectors', 'other'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`min-h-11 grow px-2 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors sm:grow-0 sm:px-3 ${
                  activeTab === tab
                    ? 'border-accent-500 text-accent-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'budget' ? 'Основное' : tab === 'cables' ? 'Кабеля' : tab === 'connectors' ? 'Аксессуары' : 'Прочее'}
              </button>
            ))}
            {eventDetails?.equipment_shipped && (
              <button
                onClick={() => setActiveTab('extra')}
                className={`min-h-11 grow px-2 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors sm:grow-0 sm:px-3 ${
                  activeTab === 'extra'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-orange-500/60 hover:text-orange-400'
                }`}
              >
                Добор
                {extraItems.length > 0 && (
                  <span className="ml-1 px-1 py-0.5 bg-orange-900/40 text-orange-400 rounded text-xs font-bold">
                    {extraItems.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-1 py-2 custom-scrollbar sm:p-4">
          {collaboration.error && <p role="status" className="mb-3 text-sm text-amber-400">{collaboration.error}</p>}
          {remoteStructureChanged && <p role="status" className="mb-3 text-sm text-amber-400">Состав спецификации изменился. Ваши несохранённые правки сохранены на экране. <button type="button" disabled={modifiedItems.size > 0 || savingChanges} onClick={() => { void loadData(); }} className="underline disabled:opacity-50">Обновить состав после сохранения правок</button></p>}
          {(budgetSourceError || comparisonError) && <p role="alert" className="mb-4 rounded-lg border border-amber-700 bg-amber-900/20 p-3 text-sm text-amber-300">{budgetSourceError || comparisonError}</p>}
          {!confirmedProject && <p className="mb-4 rounded-lg border border-accent-800 p-3 text-sm text-accent-300">До подтверждения мероприятия спецификация показывает актуальную смету. Ручное редактирование станет доступно после подтверждения.</p>}
          {activeTab === 'budget' && (
            <>
              <div className="mb-3 flex justify-between items-center">
                {canEditMainSpecification && !isWarehouseUser && !eventDetails?.equipment_shipped && (
                  <button
                    onClick={() => openEquipmentSelectorForCategory(null, null)}
                    className="min-h-11 px-3 py-1.5 bg-accent-500 text-gray-950 text-xs rounded hover:bg-accent-400 flex items-center gap-1.5 transition-colors"
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
                  {locationGroup.categories.map((group) => {
                    const hasChildren = indexChildRows(group.items);
                    const rowsById = new Map<string, ExpandedItem>();
                    const rowsByName = new Map<string, ExpandedItem>();
                    for (const row of group.items) {
                      if (!rowsById.has(row.budgetItemId)) rowsById.set(row.budgetItemId, row);
                      if (!rowsByName.has(row.name)) rowsByName.set(row.name, row);
                    }
                    return (
                    <div key={`${locationGroup.locationId || 'no-location'}-${group.categoryName}`} className="mb-3">
                      <div className="mb-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {group.categoryName}
                          </h4>
                          {canEditMainSpecification && !isWarehouseUser && !eventDetails?.equipment_shipped && (
                            <button
                              onClick={() => openEquipmentSelectorForCategory(group.categoryId, locationGroup.locationId)}
                              className="p-0.5 text-accent-500 hover:text-accent-300 transition-colors"
                              title="Добавить оборудование в категорию"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-800">
                        <table className="spec-equipment-grid w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800">
                          {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                            <th className="px-3 py-1.5 text-center w-12 text-xs text-green-500 uppercase tracking-wider" title="Принято">↩</th>
                          ) : (
                            <th className="px-3 py-1.5 text-center w-12 text-xs text-gray-500 uppercase tracking-wider">✓</th>
                          )}
                          <th className="px-3 py-1.5 text-left text-xs text-gray-500 uppercase tracking-wider">Наименование</th>
                          <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500 uppercase tracking-wider">Кол-во</th>
                          <th className="px-3 py-1.5 text-left w-20 text-xs text-gray-500 uppercase tracking-wider">Ед. изм.</th>
                          {!eventDetails?.equipment_shipped && (
                            <th className="px-3 py-1.5 text-left text-xs text-gray-500 uppercase tracking-wider">Примечания</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {orderItemsWithChildren(group.items).map((item, index) => {
                          const rowHasChildren = hasChildren(item);
                          const rowIsCollapsed = collapsedParentItems.has(item.budgetItemId);
                          const parent = item.parentName && (item.parentBudgetItemId
                            ? rowsById.get(item.parentBudgetItemId)
                            : rowsByName.get(item.parentName));
                          if (parent && collapsedParentItems.has(parent.budgetItemId)) return null;

                          const hasNote = !!item.notes?.trim();
                          const openItemNote = () => setOpenNote({ budgetItemId: item.budgetItemId, itemName: item.name, value: item.notes || '' });
                          const equipment = budgetItemsById.get(item.budgetItemId)?.equipment;
                          const isRailing = !item.parentBudgetItemId && (isStageRailing(item.name, item.sku) || isStageRailing(equipment?.name, equipment?.sku));
                          return (
                          <tr key={`${item.budgetItemId}-${index}`} className={`${item.isFromComposition ? 'bg-accent-900/10' : 'bg-gray-900'} hover:bg-gray-800 transition-colors`}>
                            <td className="px-3 py-1.5 text-center">
                              <label className="spec-mark-target">
                                <>
                                    {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                      <input disabled={(!canMarkMainSpecification)}
                                        type="checkbox"
                                        aria-label={`Отметка: ${item.name}`}
                                        checked={item.return_picked}
                                        onChange={(e) => handleReturnPickedChange(item.budgetItemId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600 focus:ring-offset-gray-900"
                                      />
                                    ) : (
                                      <input
                                        type="checkbox"
                                        aria-label={`Отметка: ${item.name}`}
                                        checked={item.picked}
                                        onChange={(e) => handlePickedChange(item.budgetItemId, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-accent-600 focus:ring-offset-gray-900"
                                        disabled={(!!eventDetails?.equipment_shipped) || !canMarkMainSpecification}
                                      />
                                    )}
                                  </>
                              </label>
                            </td>
                            <td className="spec-equipment-name px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="text-xs text-white font-medium flex items-center gap-1.5">
                                    {rowHasChildren && (
                                      <button
                                        onClick={() => toggleParentRow(item.budgetItemId)}
                                        className="text-gray-400 hover:text-gray-200 transition-colors"
                                        title={rowIsCollapsed ? 'Развернуть дочерние элементы' : 'Свернуть дочерние элементы'}
                                      >
                                        {rowIsCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                    <span>{item.name}</span>
                                  </div>
                                  {item.parentName && (
                                    <div className="text-xs text-accent-500 mt-0.5">
                                      ↳ {item.parentName}
                                    </div>
                                  )}
                                  {hasNote && !eventDetails?.equipment_shipped && (
                                    <span className="spec-item-note md:hidden">{item.notes}</span>
                                  )}
                                </div>
                                {canEditMainSpecification && !eventDetails?.equipment_shipped && !item.isFromComposition && hasModifications(item.budgetItemId) && (
                                  <button
                                    onClick={() => {
                                      const budgetItem = budgetItemsById.get(item.budgetItemId);
                                      if (budgetItem) {
                                        handleOpenModificationSelector(budgetItem);
                                      }
                                    }}
                                    className="p-1 text-accent-500 hover:text-accent-400 transition-colors"
                                    title="Выбрать модификацию"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEditMainSpecification && isLedScreenItem(item) && (
                                  <button
                                    onClick={() => setShowLedSpecification(item.budgetItemId === showLedSpecification ? null : item.budgetItemId)}
                                    className="p-1 text-green-500 hover:text-green-400 transition-colors"
                                    title="Спецификация модулей"
                                  >
                                    <Calculator className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEditMainSpecification && !eventDetails?.equipment_shipped && (isRailing || isPodiumItem(item)) && (
                                  <button
                                    type="button"
                                    onClick={() => setShowStageSpecification(item.budgetItemId)}
                                    className="p-1 text-accent-500 hover:text-accent-400 transition-colors"
                                    title={isRailing ? STAGE_RAILING_CALCULATOR_TITLE : 'Спецификация подиума'}
                                  >
                                    <Calculator className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {canEditMainSpecification && !eventDetails?.equipment_shipped && !item.budgetItemId.includes('-kitcase-') && (
                                <button type="button" onClick={openItemNote} aria-label={`${hasNote ? 'Изменить примечание' : 'Добавить примечание'}: ${item.name}`}
                                  className={`spec-note-icon max-md:rounded-lg hover:bg-gray-800 ${hasNote ? 'text-accent-400' : 'text-gray-400'}`}>
                                  <StickyNote aria-hidden="true" className="h-[18px] w-[18px]" />
                                </button>
                              )}
                            </td>
                            <td className="spec-equipment-quantity px-3 py-1.5 text-center">
                              {!canEditMainSpecification || eventDetails?.equipment_shipped || item.budgetItemId.includes('-kitcase-') ? (
                                <span className="text-xs font-bold text-white">{item.quantity} <span className="font-normal text-gray-400 md:hidden">{item.unit}</span></span>
                              ) : (
                                <div className="flex justify-center items-center gap-1">
                                  <button
                                    aria-label={`Уменьшить количество: ${item.name}`}
                                    onClick={() => handleQuantityChange(item.budgetItemId, item.quantity - 1)}
                                    disabled={!canEditMainSpecification || item.quantity === 0}
                                    className="p-0.5 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors max-md:enabled:text-red-400"
                                  >
                                    <Minus className="w-5 h-5" />
                                  </button>
                                  <span className="whitespace-nowrap text-center text-xs font-bold text-white md:w-6">{item.quantity} <span className="font-normal text-gray-400 md:hidden">{item.unit}</span></span>
                                  <button
                                    aria-label={`Увеличить количество: ${item.name}`}
                                    onClick={() => handleQuantityChange(item.budgetItemId, item.quantity + 1)}
                                    disabled={!canEditMainSpecification}
                                    className="p-0.5 text-accent-500/50 hover:text-accent-400 transition-colors max-md:enabled:text-accent-400"
                                  >
                                    <Plus className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => requestDeleteSpecificationItem(item.budgetItemId, item.name)}
                                    disabled={(!canEditMainSpecification) || (!confirmedProject || !canAccess(user, 'specifications', 3))}
                                    className="p-0.5 text-red-500/60 hover:text-red-400 transition-colors"
                                    title="Удалить элемент"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="hidden px-3 py-1.5 text-xs text-gray-500 md:table-cell">{item.unit}</td>
                            {!eventDetails?.equipment_shipped && (
                              <td className="hidden px-3 py-1.5 md:table-cell">
                                {!canEditMainSpecification ? <span className="hidden text-xs text-gray-400 md:inline">{item.notes || '—'}</span> : <button
                                  type="button"
                                  onClick={openItemNote}
                                  disabled={!canEditMainSpecification || item.budgetItemId.includes('-kitcase-')}
                                  className="hidden w-full min-h-[24px] truncate rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-left text-xs text-gray-300 hover:border-accent-500 focus:border-accent-500 focus:outline-none disabled:opacity-50 md:block"
                                  title={item.notes || 'Добавить примечание'}
                                >
                                  {item.notes || 'Добавить примечание'}
                                </button>}
                              </td>
                            )}
                          </tr>
                          );
                        })}
                      </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}

              {mainItems.length === 0 && (
                <div className="text-center py-12 text-gray-600 border-2 border-dashed border-gray-800 rounded-lg">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Спецификация пуста</p>
                </div>
              )}

              {canEditMainSpecification && showLedSpecification && (
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

              {canEditMainSpecification && !eventDetails?.equipment_shipped && stageBudgetItem && stageRow && (
                <StageCalculator key={stageBudgetItem.id} budgetItem={stageBudgetItem} notes={stageRow.notes}
                  initialModules={expandedItems.filter(item => item.parentBudgetItemId === stageBudgetItem.id).map(item => ({
                    id: item.budgetItemId,
                    name: item.name,
                    sku: item.sku,
                    category: item.category,
                    quantity: item.quantity / stageQuantityMultiplier,
                  }))}
                  onClose={() => setShowStageSpecification(null)}
                  onSave={modules => {
                    handleStageCompositionCalculated(stageBudgetItem.id, modules, stageQuantityMultiplier);
                    setShowStageSpecification(null);
                  }} />
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
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors min-h-11"
                    >
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{cableDisplayName(template.type)}</h3>
                      {expandedCableTypes[template.type] ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {expandedCableTypes[template.type] && (
                      <div className="p-2">
                        <table className="spec-supply-grid w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-xs text-gray-500">Длина</th>
                              <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500">Кол-во</th>
                              {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.lengths.map((length) => {
                              const lengthLabel = cableLengthDisplayName(template.type, length);
                              const cableEntries = cables.filter(c => c.cable_type === template.type && c.cable_length === length);
                              const cableObj = cableEntries[0];
                              const quantity = quantityQueue.current.value(JSON.stringify([eventId, 'cable', template.type, length]), cableEntries.reduce((sum, item) => sum + item.quantity, 0));
                              const cableId = cableObj?.id;
                              const picked = cableObj?.picked || false;
                              const returnPicked = cableObj?.return_picked || false;
                              const cableDraftKey = buildCableDraftKey(template.type, length);
                              const cableDraftValue = inputDraftValues[cableDraftKey];
                              const cableDisplayValue = cableDraftValue !== undefined ? cableDraftValue : String(quantity);

                              return (
                                <tr key={length} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    <label className="spec-mark-target">
                                      {quantity > 0 && cableId && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                        <input disabled={!canAdjustAccessories}
                                          type="checkbox"
                                          aria-label={`Отметка: ${lengthLabel}`}
                                          checked={returnPicked}
                                          onChange={(e) => handleCableReturnPickedChange(cableId, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                        />
                                      ) : quantity > 0 && cableId ? (
                                        <input
                                          type="checkbox"
                                          aria-label={`Отметка: ${lengthLabel}`}
                                          checked={picked}
                                          onChange={(e) => handleCablePickedChange(cableId, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-accent-600"
                                          disabled={(!!eventDetails?.equipment_shipped) || !canAdjustAccessories}
                                        />
                                      ) : null}
                                    </label>
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{lengthLabel}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {(isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                      <div className="text-xs text-white font-bold">{quantity}</div>
                                    ) : (
                                      <input disabled={!canAdjustAccessories}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={cableDisplayValue}
                                        onChange={(e) => setInputDraftValues(prev => ({ ...prev, [cableDraftKey]: e.target.value }))}
                                        onBlur={(e) => {
                                          if (inputDraftValues[cableDraftKey] === undefined) return;
                                          const val = parseInt(e.target.value, 10);
                                          handleSetCableQuantityFromTemplate(template.type, length, Number.isNaN(val) ? 0 : val);
                                          setInputDraftValues(prev => {
                                            const n = { ...prev };
                                            delete n[cableDraftKey];
                                            return n;
                                          });
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                      />
                                    )}
                                  </td>
                                  {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => handleSetCableQuantityFromTemplate(template.type, length, -1, true)}
                                          disabled={(quantity === 0) || !canAdjustAccessories}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button disabled={!canAdjustAccessories}
                                          onClick={() => handleSetCableQuantityFromTemplate(template.type, length, 1, true)}
                                          className="p-1 text-accent-500/50 hover:text-accent-400 transition-colors"
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
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors min-h-11"
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
                        <table className="spec-supply-grid w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-xs text-gray-500">Тип</th>
                              <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500">Кол-во</th>
                              {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const itemLabel = connectorDisplayName(itemType);
                              const connectorTypeKey = buildConnectorScopedType(template.category, itemType);
                              const connectorEntries = connectors.filter(c => {
                                if (isConnectorMatch(c, template.category, itemType)) return true;
                                if (DUPLICATE_CONNECTOR_ITEMS.has(itemType)) return false;
                                return isLegacyConnectorMatch(c, connectorTypeKey, itemType);
                              });
                              const connector = connectorEntries[0];
                              const quantity = quantityQueue.current.value(JSON.stringify([eventId, 'connector', template.category, itemType]), connectorEntries.reduce((sum, c) => sum + c.quantity, 0));
                              const picked = connectorEntries.length > 0 && connectorEntries.every(c => c.picked);
                              const returnPicked = connectorEntries.length > 0 && connectorEntries.every(c => c.return_picked);
                              const connectorDraftKey = buildConnectorDraftKey(connectorTypeKey);
                              const connectorDraftValue = inputDraftValues[connectorDraftKey];
                              const connectorDisplayValue = connectorDraftValue !== undefined ? connectorDraftValue : String(quantity);

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    <label className="spec-mark-target">
                                      {quantity > 0 && connector && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                          <input disabled={!canAdjustAccessories}
                                            type="checkbox"
                                            aria-label={`Отметка: ${itemLabel}`}
                                            checked={returnPicked}
                                          onChange={(e) => handleConnectorGroupReturnPickedChange(template.category, itemType, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                        />
                                      ) : quantity > 0 && connector ? (
                                        <input
                                          type="checkbox"
                                          aria-label={`Отметка: ${itemLabel}`}
                                          checked={picked}
                                          onChange={(e) => handleConnectorGroupPickedChange(template.category, itemType, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-accent-600"
                                          disabled={(!!eventDetails?.equipment_shipped) || !canAdjustAccessories}
                                        />
                                      ) : null}
                                    </label>
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemLabel}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {(isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                      <div className="text-xs text-white font-bold">{quantity}</div>
                                    ) : (
                                      <input disabled={!canAdjustAccessories}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={connectorDisplayValue}
                                        onChange={(e) => setInputDraftValues(prev => ({ ...prev, [connectorDraftKey]: e.target.value }))}
                                        onBlur={(e) => {
                                          if (inputDraftValues[connectorDraftKey] === undefined) return;
                                          const val = parseInt(e.target.value, 10);
                                          handleSetConnectorQuantityFromTemplate(template.category, itemType, Number.isNaN(val) ? 0 : val);
                                          setInputDraftValues(prev => {
                                            const n = { ...prev };
                                            delete n[connectorDraftKey];
                                            return n;
                                          });
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                      />
                                    )}
                                  </td>
                                  {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => handleSetConnectorQuantityFromTemplate(template.category, itemType, -1, true)}
                                          disabled={(quantity === 0) || !canAdjustAccessories}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button disabled={!canAdjustAccessories}
                                          onClick={() => handleSetConnectorQuantityFromTemplate(template.category, itemType, 1, true)}
                                          className="p-1 text-accent-500/50 hover:text-accent-400 transition-colors"
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
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors min-h-11"
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
                        <table className="spec-supply-grid w-full border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800">
                              {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-green-500" title="Принято">↩</th>
                              ) : (
                                <th className="px-3 py-1.5 text-center w-12 text-xs text-gray-500">✓</th>
                              )}
                              <th className="px-3 py-1.5 text-left text-xs text-gray-500">Предмет</th>
                              <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500">Кол-во</th>
                              {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500"></th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800">
                            {template.items.map((itemType) => {
                              const otherEntries = otherItems.filter(i => i.category === template.category && i.item_type === itemType);
                              const otherObj = otherEntries[0];
                              const otherId = otherObj?.id;
                              const quantity = quantityQueue.current.value(JSON.stringify([eventId, 'other', template.category, itemType]), otherEntries.reduce((sum, item) => sum + item.quantity, 0));
                              const picked = otherObj?.picked || false;
                              const returnPicked = otherObj?.return_picked || false;
                              const otherDraftKey = buildOtherDraftKey(template.category, itemType);
                              const otherDraftValue = inputDraftValues[otherDraftKey];
                              const otherDisplayValue = otherDraftValue !== undefined ? otherDraftValue : String(quantity);

                              return (
                                <tr key={itemType} className="hover:bg-gray-800 transition-colors">
                                  <td className="px-3 py-1.5 text-center">
                                    <label className="spec-mark-target">
                                      {quantity > 0 && otherId && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                        <input disabled={!canAdjustAccessories}
                                          type="checkbox"
                                          aria-label={`Отметка: ${itemType}`}
                                          checked={returnPicked}
                                          onChange={(e) => handleOtherReturnPickedChange(otherId, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                        />
                                      ) : quantity > 0 && otherId ? (
                                        <input
                                          type="checkbox"
                                          aria-label={`Отметка: ${itemType}`}
                                          checked={picked}
                                          onChange={(e) => handleOtherPickedChange(otherId, e.target.checked)}
                                          className="w-4 h-4 cursor-pointer rounded border-gray-700 bg-gray-800 text-accent-600"
                                          disabled={(!!eventDetails?.equipment_shipped) || !canAdjustAccessories}
                                        />
                                      ) : null}
                                    </label>
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-white">{itemType}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    {(isWarehouseUser || eventDetails?.equipment_shipped) ? (
                                      <div className="text-xs text-white font-bold">{quantity}</div>
                                    ) : (
                                      <input disabled={!canAdjustAccessories}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={otherDisplayValue}
                                        onChange={(e) => setInputDraftValues(prev => ({ ...prev, [otherDraftKey]: e.target.value }))}
                                        onBlur={(e) => {
                                          if (inputDraftValues[otherDraftKey] === undefined) return;
                                          const val = parseInt(e.target.value, 10);
                                          handleSetOtherQuantityFromTemplate(template.category, itemType, Number.isNaN(val) ? 0 : val);
                                          setInputDraftValues(prev => {
                                            const n = { ...prev };
                                            delete n[otherDraftKey];
                                            return n;
                                          });
                                        }}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-center text-xs text-white"
                                      />
                                    )}
                                  </td>
                                  {canAdjustAccessories && !eventDetails?.equipment_shipped && (
                                    <td className="px-3 py-1.5 text-center">
                                      <div className="flex justify-center gap-1.5">
                                        <button
                                          onClick={() => handleSetOtherQuantityFromTemplate(template.category, itemType, -1, true)}
                                          disabled={(quantity === 0) || !canAdjustAccessories}
                                          className="p-1 text-red-500/50 hover:text-red-400 disabled:text-gray-700 transition-colors"
                                        >
                                          <Minus className="w-5 h-5" />
                                        </button>
                                        <button disabled={!canAdjustAccessories}
                                          onClick={() => handleSetOtherQuantityFromTemplate(template.category, itemType, 1, true)}
                                          className="p-1 text-accent-500/50 hover:text-accent-400 transition-colors"
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
                  {canEditSpecification && <button
                    onClick={() => setShowEquipmentSelector(true)}
                    className="px-3 py-1.5 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Добавить в добор
                  </button>}
                  <span className="text-xs text-gray-500">Оборудование, забытое при первоначальной загрузке</span>
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
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">{group.categoryName}</h4>
                      <div className="overflow-x-auto rounded border border-orange-900/40">
                    <table className="spec-equipment-grid w-full border-collapse">
                      <thead>
                        <tr className="bg-orange-900/10 border-b border-orange-900/30">
                          {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                            <th className="px-3 py-1.5 text-center w-12 text-xs text-green-500" title="Принято">↩</th>
                          ) : (
                            <th className="px-3 py-1.5 text-center w-12 text-xs text-orange-500">✓</th>
                          )}
                          <th className="px-3 py-1.5 text-left text-xs text-gray-500 uppercase">Наименование</th>
                          <th className="px-3 py-1.5 text-center w-20 text-xs text-gray-500 uppercase">Кол-во</th>
                          <th className="px-3 py-1.5 text-left w-20 text-xs text-gray-500 uppercase">Ед. изм.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-900/20">
                        {group.items.map((item, index) => (
                          <tr key={`${item.budgetItemId}-${index}`} className="bg-orange-900/5 hover:bg-orange-900/15 transition-colors">
                            <td className="px-3 py-1.5 text-center">
                              <label className="spec-mark-target">
                                {eventDetails?.equipment_shipped && !eventDetails?.equipment_returned ? (
                                  <input disabled={(!confirmedProject || !canAccess(user, 'specifications', 2))}
                                    type="checkbox"
                                    aria-label={`Отметка: ${item.name}`}
                                    checked={item.return_picked}
                                    onChange={(e) => handleReturnPickedChange(item.budgetItemId, e.target.checked)}
                                    className="w-4 h-4 cursor-pointer rounded border-green-700 bg-gray-800 text-green-600"
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    aria-label={`Отметка: ${item.name}`}
                                    checked={item.picked}
                                    onChange={(e) => handlePickedChange(item.budgetItemId, e.target.checked)}
                                    className="w-4 h-4 cursor-pointer rounded border-orange-700 bg-gray-800 text-orange-600"
                                    disabled={(!!eventDetails?.equipment_shipped) || (!confirmedProject || !canAccess(user, 'specifications', 2))}
                                  />
                                )}
                              </label>
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="text-xs text-white font-medium">{item.name}</div>
                              {item.parentName && (
                                <div className="text-xs text-orange-400 mt-0.5">↳ {item.parentName}</div>
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

        <div className="relative flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-800 bg-gray-900/80 px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] empty:hidden sm:p-3">
            {modifiedItems.size > 0 && !eventDetails?.equipment_shipped && (
              <button
                onClick={handleSaveChanges}
                disabled={(savingChanges) || (!confirmedProject || !canAccess(user, 'specifications', 2))}
                className="min-h-11 px-3 py-1.5 bg-accent-500 text-gray-950 text-xs rounded hover:bg-accent-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
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
            {canEditMainSpecification && !eventDetails?.equipment_shipped && (
              <>
                <button type="button" aria-expanded={showResetActions} aria-controls="spec-reset-actions" onClick={() => setShowResetActions(open => !open)}
                  className="flex min-h-11 items-center gap-1 rounded-lg border border-gray-700 px-2.5 text-xs text-gray-200 sm:hidden">
                  <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                  {resettingSelections ? 'Сброс…' : 'Ещё'}
                </button>
                {showResetActions && <button type="button" onClick={() => setShowResetActions(false)}
                  className="fixed inset-0 z-20 bg-black/40 sm:hidden" aria-label="Закрыть действия" />}
                <div id="spec-reset-actions" onKeyDown={event => { if (event.key === 'Escape') setShowResetActions(false); }}
                  className={`${showResetActions ? 'flex' : 'hidden'} absolute bottom-full right-0 z-30 w-max max-w-full flex-col gap-1 rounded-lg border border-gray-700 bg-gray-900 p-1 shadow-lg sm:static sm:flex sm:flex-row sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}>
                  <button
                    onClick={() => { setShowResetActions(false); setResetDialog('selections'); }}
                    disabled={resetInProgress || loading}
                    aria-busy={resettingSelections}
                    className="min-h-11 px-3 py-1.5 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {resettingSelections ? 'Сброс выделений…' : 'Сбросить все выделения'}
                  </button>
                  <button
                    onClick={() => { setShowResetActions(false); setResetDialog('specification'); }}
                    disabled={resettingSelections}
                    className="min-h-11 px-3 py-1.5 bg-amber-700 text-white text-xs rounded hover:bg-amber-600 flex items-center gap-1.5 transition-colors"
                  >
                    Сбросить спецификацию
                  </button>
                </div>
              </>
            )}
            {canEditSpecification && !eventDetails?.equipment_shipped && !eventDetails?.equipment_returned && (
              <button
                onClick={handleConfirmShipment}
                disabled={(confirmingShipment) || (optimisticMarks.current.hasPending() || quantityQueue.current.hasPending()) || (!confirmedProject || !canAccess(user, 'specifications', 2))}
                title={!allPickedForShipment ? 'Проставьте все галочки перед отгрузкой' : undefined}
                className="min-h-11 px-2 sm:px-3 py-1.5 bg-red-700 text-white text-xs rounded hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {confirmingShipment ? <>...</> : (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    Подтвердить отгрузку
                  </>
                )}
              </button>
            )}
            {canEditSpecification && eventDetails?.equipment_shipped && !eventDetails?.equipment_returned && (
              <button
                onClick={handleConfirmReturn}
                disabled={(confirmingReturn) || (optimisticMarks.current.hasPending() || quantityQueue.current.hasPending()) || (!confirmedProject || !canAccess(user, 'specifications', 2))}
                title={!allPickedForReturn ? 'Проставьте все галочки перед приёмкой' : undefined}
                className="min-h-11 px-2 sm:px-3 py-1.5 bg-green-700 text-white text-xs rounded hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
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

      {showModificationSelector && selectedBudgetItemForMod && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
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
                          className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded transition-colors min-h-11"
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

      {componentDecisionQueue.length > 0 && componentDecisionQueue[activeComponentDecisionIndex] && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Комплектующие: выбор кейса ({activeComponentDecisionIndex + 1}/{componentDecisionQueue.length})
              </h3>
              <button
                onClick={() => { if (!savingComponentChoice) setComponentDecisionQueue([]); }}
                disabled={savingComponentChoice}
                className="p-1 hover:bg-gray-800 text-gray-400 rounded"
                title="Пропустить"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-300">
                Для выбранных комплектующих можно взять их отдельно или заменить на целый кейс.
              </p>

              <div className="bg-gray-950/50 border border-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Комплектующие</div>
                <ul className="space-y-2">
                  {componentDecisionQueue[activeComponentDecisionIndex].items.map(item => (
                    <li key={item.budgetItemId} className="text-sm text-white flex justify-between gap-3">
                      <span>{item.name} <span className="text-gray-500">{item.sku ? `(${item.sku})` : ''}</span></span>
                      <span className="text-accent-400 font-medium">{item.quantity} шт.</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                {componentDecisionQueue[activeComponentDecisionIndex].caseOptions.map(option => (
                  <button
                    key={option.caseId}
                    disabled={savingComponentChoice || loading}
                    onClick={() => handleComponentDecisionUseCase(option)}
                    className="w-full text-left px-3 py-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 transition-colors min-h-11"
                  >
                    <div className="text-sm text-white font-medium">{option.caseName}</div>
                    <div className="text-xs text-gray-400">
                      {option.caseSku ? `${option.caseSku} • ` : ''}В кейсе: {option.componentQuantityInCase} шт. комплектующего
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-end gap-3">
              {savingComponentChoice && <span role="status" className="text-xs text-gray-400">{loading ? 'Обновление позиций…' : 'Сохранение выбора…'}</span>}
              <button
                onClick={handleComponentDecisionSeparate}
                disabled={savingComponentChoice || loading}
                className="px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded hover:bg-gray-800 transition-colors"
              >
                Взять отдельно
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
                      <span className="text-gray-500"> ({item.group === 'equipment' ? 'Оборудование' : item.group === 'extra' ? 'Добор' : item.group === 'cables' ? 'Кабели' : item.group === 'connectors' ? 'Аксессуары' : 'Прочее'})</span>
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
                    <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase tracking-wider">Наименование</th>
                    <th className="px-3 py-2 text-center w-24 text-xs text-gray-500 uppercase tracking-wider">Количество</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {modificationComponents.map((comp) => (
                    <tr key={comp.id} className="hover:bg-gray-800 transition-colors">
                      <td className="px-3 py-2">
                        <div className="text-xs text-white font-medium">{comp.component?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input disabled={(!confirmedProject || !canAccess(user, 'specifications', 2))}
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
              <button disabled={(!confirmedProject || !canAccess(user, 'specifications', 2))}
                onClick={handleSaveComponents}
                className="min-h-11 flex-1 px-4 py-2 bg-accent-500 text-gray-950 text-xs rounded hover:bg-accent-400 transition-colors"
              >
                Добавить компоненты
              </button>
            </div>
          </div>
        </div>
      )}

      {showEquipmentSelector && (
        <EquipmentSelector
          onSelect={activeTab === 'extra' ? handleAddExtraEquipment : handleAddEquipment}
          onBatchSelect={handleBatchAddEquipment}
          onClose={() => {
            setShowEquipmentSelector(false);
            setAddEquipmentTarget({ categoryId: null, locationId: null });
          }}
        />
      )}

      {resetDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="spec-reset-title" aria-describedby="spec-reset-message"
            onKeyDown={event => { if (event.key === 'Escape' && !resetInProgress) setResetDialog(null); }}
            className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md p-4">
            <h3 id="spec-reset-title" className="mb-3 text-base font-semibold text-white">
              {resetDialog === 'selections' ? 'Сбросить все выделения?' : 'Сбросить спецификацию?'}
            </h3>
            <p id="spec-reset-message" className="mb-5 text-sm text-gray-300">
              {resetDialog === 'selections'
                ? 'Все отметки о сборке и возврате в выбранной спецификации будут сняты.'
                : 'Позиции спецификации будут пересозданы из текущей сметы. Правки, внесённые в эти позиции, будут удалены.'}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus onClick={() => setResetDialog(null)} disabled={resetInProgress}
                className="min-h-11 rounded border border-gray-700 px-3 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50">
                Отмена
              </button>
              <button type="button" onClick={resetDialog === 'selections' ? handleResetAllSelections : handleResetSpecification}
                disabled={resetInProgress || loading || !canEditMainSpecification || !!eventDetails?.equipment_shipped ||
                  (resetDialog === 'specification' && !canAccess(user, 'specifications', 3))}
                className="min-h-11 rounded bg-amber-700 px-3 text-sm text-white hover:bg-amber-600 disabled:opacity-50">
                {resetInProgress ? 'Сброс…' : 'Да, сбросить'}
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
              <button disabled={(!confirmedProject || !canAccess(user, 'specifications', 2))}
                onClick={applyQuantityChange}
                className="min-h-11 flex-1 px-4 py-2 bg-accent-500 text-gray-950 text-xs rounded hover:bg-accent-400 transition-colors"
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
            {(isGeneratedCompositionItemId(pendingDeleteItem.budgetItemId) || expandedItems.find(item => item.budgetItemId === pendingDeleteItem.budgetItemId)?.parentBudgetItemId) && <p className="mt-2 text-xs text-gray-400">Родительский элемент и остальные дочерние элементы останутся в спецификации.</p>}
            <div className="mt-4 flex gap-2">
              <button disabled={(!confirmedProject || !canAccess(user, 'specifications', 3))}
                onClick={() => setPendingDeleteItem(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button disabled={(!confirmedProject || !canAccess(user, 'specifications', 3))}
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

      {openNote && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">Примечание</h3>
                <p className="mt-1 text-xs text-gray-400">{openNote.itemName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenNote(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea disabled={(!confirmedProject || !canAccess(user, 'specifications', 2))}
              autoFocus
              value={openNote.value}
              onChange={(e) => setOpenNote((note) => note ? { ...note, value: e.target.value } : note)}
              readOnly={!canEditNotes}
              rows={8}
              className="w-full resize-y rounded border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200 focus:border-accent-500 focus:outline-none read-only:cursor-default read-only:opacity-80 min-h-11"
              placeholder="Введите полное примечание..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenNote(null)}
                className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                Отмена
              </button>
              {canEditNotes && (
                <button
                  type="button"
                  onClick={() => {
                    handleNotesChange(openNote.budgetItemId, openNote.value);
                    setOpenNote(null);
                  }}
                  className="min-h-11 rounded bg-accent-500 px-4 py-2 text-sm text-gray-950 hover:bg-accent-400"
                >
                  Сохранить
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {notesError && <div role="alert" className="fixed bottom-4 left-4 z-[70] rounded bg-red-900 p-3 text-sm text-white">{notesError}</div>}
      <StickyNotePanel
        notes={stickyNotes}
        onNotesChange={changeNotes}
        readOnly={!canEditNotes || !notesReady}
        persistLocally={false}
        onClose={() => setShowStickyNotes(false)}
        isOpen={showStickyNotes}
        storageKey={`spec_sticky_notes_${budgetId}`}
      />
    </section>
  );
}
