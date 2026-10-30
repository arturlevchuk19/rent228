import { useBudgetTouchDrag } from '../lib/useBudgetTouchDrag';
import { flushSync } from 'react-dom';
import { useBudgetAutosave } from '../lib/useBudgetAutosave';
import { MobileBudgetNavigation, MobileBudgetSettings, type MobileBudgetTab } from './MobileBudgetNavigation';
import { BudgetScope } from './BudgetScope';
import { getBudgetEvent, updateBudgetEvent } from '../lib/eventBudgets';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { InlineQuantityAdd } from './InlineQuantityAdd';
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Package, Download, Settings, ChevronDown, ChevronRight, MapPin, Pencil, Trash2, GripVertical, StickyNote } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { type Event, type BudgetItem, type Client, getBudgetItems, createBudgetItem, updateBudgetItem, deleteBudgetItem, getClients } from '../lib/events';
import { EquipmentItem, getEquipmentItems } from '../lib/equipment';
import { WorkItem, getWorkItems } from '../lib/personnel';
import { Category, createCategory, getCategories, getCategoriesForEvent, updateCategory } from '../lib/categories';
import { Location, createLocation, getLocationsForEvent, updateLocation, deleteLocation } from '../lib/locations';
import { CategoryBlock, type BudgetDragTarget } from './CategoryBlock';
import { WorkPersonnelManager } from './WorkPersonnelManager';
import { TemplatesInBudget } from './TemplatesInBudget';
import { WarehouseSpecification } from './WarehouseSpecification';
import { generateBudgetPDF } from '../lib/pdfGenerator';
import { generateContractDocx } from '../lib/contractGenerator';
import { calcCombinedTotal, calcDay1Total, calcGrandTotals } from '../lib/budgetPricing';
import {
  UShapeUnifiedDialog,
  LedSizeDialog,
  PodiumDialog,
  PodiumStairDialog,
  TotemDialog,
  AddLocationDialog,
  ContractDialog
} from './dialogs';
import { StickyNotePanel } from './StickyNotePanel';

interface BudgetEditorProps {
  budgetId?: string;
  eventId: string;
  eventName: string;
  onClose: () => void;
}

type BudgetAutoSettings = Required<Pick<Event, 'discount_enabled' | 'discount_percent' | 'discount2_enabled' | 'discount2_percent' | 'budget_days' | 'budget_totals_mode' | 'budget_note' | 'budget_version' | 'budget_payment_mode' | 'budget_exchange_rate' | 'sticky_notes'>>;

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

export function BudgetEditor(props: BudgetEditorProps) {
  return <BudgetScope eventId={props.eventId} budgetId={props.budgetId} onClose={props.onClose}>{(id, name) => <ScopedBudgetEditor key={id} {...props} eventName={`${props.eventName} · ${name}`} budgetName={name} budgetId={id} />}</BudgetScope>;
}
function ScopedBudgetEditor({ eventId, eventName, budgetName, onClose, budgetId }: BudgetEditorProps & { budgetId: string; budgetName: string }) {
  const getEvent = (id: string) => getBudgetEvent(id, budgetId);
  const { user } = useAuth();
  const [quantityTarget, setQuantityTarget] = useState<string | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [globalCategories, setGlobalCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<string>('Оборудование');
  const [mobileTab, setMobileTab] = useState<MobileBudgetTab>('estimate');
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [mobileCatalogExpanded, setMobileCatalogExpanded] = useState(true);
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  const changeMobileTab = (tab: MobileBudgetTab) => {
    setMobileTab(tab);
    setQuantityTarget(null);
    setMobileCatalogExpanded(true);
    if (tab === 'equipment' || tab === 'personnel') setSelectedItemType(tab === 'equipment' ? 'Оборудование' : 'Работа');
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState<string>('Все');
  const [exchangeRate, setExchangeRate] = useState(3.0);
  const [exchangeRateInput, setExchangeRateInput] = useState('3');
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
  const [showPodiumStairDialog, setShowPodiumStairDialog] = useState(false);
  const [selectedPodiumStairEquipment, setSelectedPodiumStairEquipment] = useState<EquipmentItem | null>(null);


  const [showTotemDialog, setShowTotemDialog] = useState(false);
  const [selectedTotemEquipment, setSelectedTotemEquipment] = useState<EquipmentItem | null>(null);
  const [isMonototem, setIsMonototem] = useState(false);

  const [showUShapeUnifiedDialog, setShowUShapeUnifiedDialog] = useState(false);
  const [selectedUShapeEquipment, setSelectedUShapeEquipment] = useState<EquipmentItem | null>(null);
  const [uShapeMode, setUShapeMode] = useState<'standard' | 'lifting'>('standard');

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [discountPercentInput, setDiscountPercentInput] = useState('10');
  const [discountedTotalInput, setDiscountedTotalInput] = useState('');
  const [discount2Enabled, setDiscount2Enabled] = useState(false);
  const [discount2Percent, setDiscount2Percent] = useState(0);
  const [discount2PercentInput, setDiscount2PercentInput] = useState('');
  // Зависимость скидки организатора от скидки клиента (режимы выбора убраны):
  // 1) если скидка клиенту НЕ активна — скидка организатору считается от сметы
  //    (базы оборудования): итог = база x (1 - d2);
  // 2) если скидка клиенту активна — скидка организатору считается от скидки клиента,
  //    т.е. скидки применяются последовательно: итог = база x (1 - d1) x (1 - d2).
  // Скидка организатора доступна всегда, независимо от активности скидки клиенту.
  const hasClientDiscount = discountEnabled && discountPercent > 0;
  const hasOrganizerDiscount = discount2Enabled && discount2Percent > 0;
  // Итоговая скидка активна, если включён хотя бы один из уровней.
  const hasAnyDiscount = hasClientDiscount || hasOrganizerDiscount;
  const [showBudgetNoteDialog, setShowBudgetNoteDialog] = useState(false);
  const [budgetNote, setBudgetNote] = useState('');
  const [budgetVersion, setBudgetVersion] = useState('1.0');
  const [budgetDays, setBudgetDays] = useState(1);
  const [budgetDaysInput, setBudgetDaysInput] = useState('1');
  const [budgetTotalsMode, setBudgetTotalsMode] = useState<'combined_only' | 'day1_plus_combined'>('combined_only');
  const [draggedLocationId, setDraggedLocationId] = useState<string | null>(null);
  const [locationDragOverId, setLocationDragOverId] = useState<string | null>(null);
  const [, setIsBudgetConfirmed] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractOrganizationId, setContractOrganizationId] = useState('');
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [showStickyNotes, setShowStickyNotes] = useState(false);
  const [stickyNotes, setStickyNotes] = useState<{ id: string; content: string }[]>([
    { id: `budget_note_1`, content: '' }
  ]);
  const [showExtraTotal, setShowExtraTotal] = useState(false);
  const [initialSettings, setInitialSettings] = useState<BudgetAutoSettings | null>(null);
  const settingsLoaded = useRef(false);
  const closing = useRef(false);
  const pendingItemWrites = useRef(new Set<Promise<void>>());
  const settingsSnapshot: BudgetAutoSettings = {
    discount_enabled: discountEnabled, discount_percent: discountPercent,
    discount2_enabled: discount2Enabled, discount2_percent: discount2Percent,
    budget_days: budgetDays, budget_totals_mode: budgetTotalsMode, budget_note: budgetNote,
    budget_version: budgetVersion, budget_payment_mode: paymentMode, budget_exchange_rate: exchangeRate,
    sticky_notes: JSON.stringify(stickyNotes),
  };
  const autosave = useBudgetAutosave(`budget_autosave_${budgetId}`, settingsSnapshot, initialSettings,
    !loading && canAccess(user, 'budgets', 2), async patch => {
      await updateBudgetEvent(eventId, budgetId, patch);
      if (patch.budget_exchange_rate !== undefined) {
        const rate = patch.budget_exchange_rate;
        setBudgetItems(current => current.map(item => ({ ...item, exchange_rate: rate })));
      }
    });

  const budgetListRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAddedItemRef = useRef<string | null>(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const clients = await getClients();
        setClientsList(clients.filter((client) => Boolean(client.organization)));
      } catch (error) {
        console.error('Error loading clients for contract dialog:', error);
        setClientsList([]);
      }
    };

    loadClients();
  }, []);

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

  const handleStickyNotesChange = (newNotes: { id: string; content: string }[]) => setStickyNotes(newNotes);

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetData, globalCategoriesData, eventCategoriesData, locationsData, equipmentData, workItemsData, eventData] = await Promise.all([
        getBudgetItems(eventId, budgetId),
        getCategories(),
        getCategoriesForEvent(eventId, budgetId),
        getLocationsForEvent(eventId, budgetId),
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

      if (!settingsLoaded.current) {
        const cached = (prefix: string) => {
          try { return localStorage.getItem(`${prefix}_${budgetId}`); } catch { return null; }
        };
        const localMode = cached('budget_payment_mode');
        let loadedNotes = [{ id: 'budget_note_1', content: '' }];
        try {
          const notes = JSON.parse(eventData.sticky_notes || cached('budget_sticky_notes') || 'null');
          if (Array.isArray(notes) && notes.length && notes.every(note => typeof note.id === 'string' && typeof note.content === 'string')) loadedNotes = notes;
        } catch { /* Start with an empty note if legacy storage is invalid. */ }
        const loaded: BudgetAutoSettings = {
          discount_enabled: Boolean(eventData.discount_enabled),
          discount_percent: eventData.discount_percent ?? 0,
          discount2_enabled: Boolean(eventData.discount2_enabled),
          discount2_percent: eventData.discount2_percent ?? 0,
          budget_days: Math.max(1, eventData.budget_days || 1),
          budget_totals_mode: eventData.budget_totals_mode || 'combined_only',
          budget_note: eventData.budget_note || '',
          budget_version: eventData.budget_version ?? cached('budget_version') ?? '1.0',
          budget_payment_mode: eventData.budget_payment_mode ?? (localMode === 'byn_cash' || localMode === 'byn_noncash' ? localMode : 'usd'),
          budget_exchange_rate: eventData.budget_exchange_rate || budgetData[0]?.exchange_rate || 3,
          sticky_notes: JSON.stringify(loadedNotes),
        };
        let restored = loaded;
        if (canAccess(user, 'budgets', 2)) {
          try {
            const pending = JSON.parse(cached('budget_autosave') || 'null');
            if (pending && !Array.isArray(pending) && Object.entries(pending).every(([key, value]) =>
                key in loaded && typeof value === typeof loaded[key as keyof BudgetAutoSettings])) {
              const recovered = { ...loaded, ...pending };
              if (recovered.budget_days >= 1 && recovered.budget_exchange_rate > 0 &&
                  ['usd', 'byn_cash', 'byn_noncash'].includes(recovered.budget_payment_mode) &&
                  ['combined_only', 'day1_plus_combined'].includes(recovered.budget_totals_mode)) restored = recovered;
            }
          } catch { /* No pending edits to recover. */ }
        }
        setDiscountEnabled(restored.discount_enabled);
        setDiscountPercent(restored.discount_percent); setDiscountPercentInput(String(restored.discount_percent));
        setDiscount2Enabled(restored.discount2_enabled);
        setDiscount2Percent(restored.discount2_percent); setDiscount2PercentInput(String(restored.discount2_percent));
        setBudgetDays(restored.budget_days); setBudgetTotalsMode(restored.budget_totals_mode);
        setBudgetNote(restored.budget_note); setBudgetVersion(restored.budget_version);
        setPaymentMode(restored.budget_payment_mode); setExchangeRate(restored.budget_exchange_rate);
        setExchangeRateInput(String(restored.budget_exchange_rate));
        try {
          const recoveredNotes = JSON.parse(restored.sticky_notes);
          setStickyNotes(Array.isArray(recoveredNotes) && recoveredNotes.length && recoveredNotes.every(note => note && typeof note.id === 'string' && typeof note.content === 'string') ? recoveredNotes : loadedNotes);
        } catch { setStickyNotes(loadedNotes); }
        setInitialSettings(loaded);
        settingsLoaded.current = true;
      }
      setIsBudgetConfirmed(Boolean(eventData.progress_equipment_reserved));
      setContractOrganizationId(current => current || eventData.client_id || '');

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
        eventId, budgetId
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
      const category = await createCategory(nextName, EXTRA_SERVICE_DESCRIPTION_FLAG, false, eventId, budgetId);
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
      const newLocation = await createLocation(eventId, name, color, budgetId);
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
    } catch (error) {
      console.error('Error updating location:', error);
      alert(`Ошибка обновления локации: ${getErrorMessage(error)}`);
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
    } catch (error) {
      console.error('Error deleting location:', error);
      alert(`Ошибка удаления локации: ${getErrorMessage(error)}`);
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

  const isPodiumStair = (equipmentItem: EquipmentItem) => {
    const name = (equipmentItem.name || '').toLowerCase();
    return name.includes('лестница') && name.includes('подиум');
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
    return name.toLowerCase().includes('п-образная фермовая конструкция') && !name.toLowerCase().includes('с системой подъема');
  };

  const isUShapeLiftingConstruction = (equipmentItem: EquipmentItem) => {
    const name = equipmentItem.name || '';
    return name.toLowerCase().includes('п-образная фермовая конструкция с системой подъема');
  };

  const handleEquipmentClick = async (equipmentItem: EquipmentItem) => {
    if (isLedScreen(equipmentItem)) {
      setSelectedLedEquipment(equipmentItem);
      setShowLedSizeDialog(true);
      return;
    }
    if (isPodiumStair(equipmentItem)) {
      setSelectedPodiumStairEquipment(equipmentItem);
      setShowPodiumStairDialog(true);
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

  const handlePodiumStairConfirm = (result: { quantity: number; customName: string; customPrice: number }) => {
    if (!selectedPodiumStairEquipment) return;
    handleAddItem(
      selectedPodiumStairEquipment,
      result.quantity,
      undefined,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).categoryId : null) || undefined,
      result.customName,
      result.customPrice,
      (selectedCategoryId ? parseGroupId(selectedCategoryId).locationId : null) || undefined
    );
    setShowPodiumStairDialog(false);
    setSelectedPodiumStairEquipment(null);
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

      const targetGroupItems = budgetItems.filter(item =>
        (item.category_id || undefined) === targetCategoryId &&
        (item.location_id || undefined) === targetLocationId
      );
      const maxSortOrder = targetGroupItems.length > 0
        ? Math.max(...targetGroupItems.map(i => i.sort_order || 0))
        : -1;

      const newItem = await createBudgetItem({
        event_id: eventId,
        budget_id: budgetId,
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
        is_extra: isExtra,
        sort_order: maxSortOrder + 1
      });
      setBudgetItems(prev => [...prev, newItem]);
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
      return true;
    } catch (error) {
      console.error('Error adding item:', error);
      alert(`Ошибка добавления: ${getErrorMessage(error)}`);
      return false;
    }
  };











  const handleAddWorkItem = async (workItem: WorkItem, categoryId?: string, quantity: number = 1) => {
    try {
      const selectedPlacement = selectedCategoryId ? parseGroupId(selectedCategoryId) : { categoryId: null, locationId: null };
      const targetCategoryId = categoryId || selectedPlacement.categoryId || undefined;
      const targetLocationId = selectedPlacement.locationId || undefined;
      const isExtra = isExtraServiceCategory(targetCategoryId);

      const targetGroupItems = budgetItems.filter(item =>
        (item.category_id || undefined) === targetCategoryId &&
        (item.location_id || undefined) === targetLocationId
      );
      const maxSortOrder = targetGroupItems.length > 0
        ? Math.max(...targetGroupItems.map(i => i.sort_order || 0))
        : -1;

      const newItem = await createBudgetItem({
        event_id: eventId,
        budget_id: budgetId,
        work_item_id: workItem.id,
        item_type: 'work',
        quantity,
        price: 0,
        multi_day_rate_override: 0,
        exchange_rate: exchangeRate,
        category_id: targetCategoryId,
        location_id: targetLocationId,
        notes: '',
        is_extra: isExtra,
        sort_order: maxSortOrder + 1
      });
      setBudgetItems(prev => [...prev, newItem]);
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
      return true;
    } catch (error) {
      console.error('Error adding work item:', error);
      alert(`Ошибка добавления: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const handleUpdateItem = (itemId: string, updates: Partial<BudgetItem>) => {
    const operation = (async () => {
      try {
        const updatedItem = await updateBudgetItem(itemId, updates);
        setBudgetItems(current => current.map(item => item.id === itemId ? { ...item, ...updatedItem } : item));
      } catch (error) {
        console.error('Error updating item:', error);
        alert(`Ошибка обновления: ${getErrorMessage(error)}`);
      }
    })();
    pendingItemWrites.current.add(operation);
    void operation.finally(() => pendingItemWrites.current.delete(operation));
    return operation;
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
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(`Ошибка удаления: ${getErrorMessage(error)}`);
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
    } catch (error) {
      console.error('Error deleting category:', error);
      alert(`Ошибка удаления категории: ${getErrorMessage(error)}`);
    }
  };

  const handleDuplicateCategory = async (categoryId: string) => {
    try {
      const sourceCategory = categories.find(cat => cat.id === categoryId);
      if (!sourceCategory) return;

      // Create a copy of the category right after the original one
      const newCategory = await createCategory(
        `${sourceCategory.name} (копия)`,
        sourceCategory.description,
        false,
        eventId, budgetId
      );

      const insertIndex = categories.findIndex(cat => cat.id === categoryId);
      const nextCategories = [...categories];
      nextCategories.splice(insertIndex + 1, 0, newCategory);

      let sortBase = 0;
      for (let i = 0; i < nextCategories.length; i++) {
        if (nextCategories[i].sort_order >= sortBase) {
          sortBase = nextCategories[i].sort_order + 1;
        }
      }

      const updatedCategories = nextCategories.map((cat, index) => ({
        ...cat,
        sort_order: sortBase + index
      }));

      for (const cat of updatedCategories) {
        await updateCategory(cat.id, { sort_order: cat.sort_order });
      }

      setCategories(updatedCategories);

      // Copy all items of the source category into the duplicate
      const sourceItems = [...budgetItems]
        .filter(item => item.category_id === categoryId)
        .sort((a, b) =>
          (a.sort_order || 0) - (b.sort_order || 0) ||
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );

      const copiedItems: BudgetItem[] = [];
      for (const item of sourceItems) {
        const payload: Partial<BudgetItem> = {
          event_id: item.event_id,
          budget_id: budgetId,
          equipment_id: item.equipment_id ?? null,
          work_item_id: item.work_item_id ?? null,
          modification_id: item.modification_id ?? null,
          parent_budget_item_id: null,
          item_type: item.item_type,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          notes: item.notes,
          exchange_rate: item.exchange_rate,
          multi_day_rate_override: item.multi_day_rate_override ?? null,
          category_id: newCategory.id,
          location_id: item.location_id ?? null,
          picked: false,
          is_extra: item.is_extra,
          unit: item.unit ?? null,
          marker_color: item.marker_color ?? null,
          name: item.name ?? undefined,
          sku: item.sku ?? undefined,
          sort_order: item.sort_order
        };
        const created = await createBudgetItem(payload);
        copiedItems.push(created);
      }

      if (copiedItems.length > 0) {
        setBudgetItems(prev => [...prev, ...copiedItems]);
      }

      // Activate/expand the duplicate in every group where the original is visible
      const sourceGroupIds = Array.from(activeCategoryIds).filter(id => {
        const parsed = parseGroupId(id);
        return parsed.categoryId === categoryId;
      });
      const newGroupIds = sourceGroupIds.map(id =>
        buildCategoryGroupId(newCategory.id, parseGroupId(id).locationId)
      );
      if (newGroupIds.length === 0) {
        newGroupIds.push(buildCategoryGroupId(newCategory.id, null));
      }
      setActiveCategoryIds(prev => {
        const next = new Set(prev);
        newGroupIds.forEach(id => next.add(id));
        return next;
      });
      setExpandedCategories(prev => {
        const next = { ...prev };
        newGroupIds.forEach(id => { next[id] = true; });
        return next;
      });
      setSelectedCategoryId(newGroupIds[0]);
    } catch (error) {
      console.error('Error duplicating category:', error);
      alert(`Ошибка дублирования категории: ${getErrorMessage(error)}`);
    }
  };

  const handleUpdateCategoryName = async (categoryId: string, newName: string) => {
    try {
      await updateCategory(categoryId, { name: newName });
      setCategories(categories.map(cat =>
        cat.id === categoryId ? { ...cat, name: newName } : cat
      ));
    } catch (error) {
      console.error('Error updating category:', error);
      alert(`Ошибка обновления категории: ${getErrorMessage(error)}`);
    }
  };

  const handleClose = async () => {
    if (closing.current) return;
    closing.current = true;
    try {
      // Commit a focused price/days field before flushing its latest React state.
      flushSync(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
      await Promise.all([autosave.flush(), ...pendingItemWrites.current]);
      onClose();
    } catch { /* The persistent autosave error explains why the editor stays open. */ }
    finally { closing.current = false; }
  };

  const handleExportPDF = async (options?: { createdDate?: string; contractEquipmentTypeRP?: string }) => {
    try {
      setGeneratingPDF(true);
      const event = await getEvent(eventId);

      const parsedDiscountedTotalInput = parseFloat(discountedTotalInput.replace(',', '.'));
      const hasManualDiscountedTotal = hasAnyDiscount
        && discountedTotalInput.trim() !== '' && !isNaN(parsedDiscountedTotalInput);
      // Итоговая сумма со скидками для экспорта: ручное значение или расчёт.
      const exportFinalDiscountedTotal = hasManualDiscountedTotal
        ? normalizeGrandTotalForPaymentMode(parsedDiscountedTotalInput)
        : getDiscountedTotal();
      // Скидка организатора передаётся в PDF независимо от скидки клиенту.
      const exportDiscount2Enabled = discount2Enabled;
      const exportDiscount2Percent = exportDiscount2Enabled ? Math.round(discount2Percent) : 0;
      // Промежуточный итог со скидкой клиента (без скидки организатора) — для первой строки в PDF.
      const exportLevel1DiscountedTotal = getDiscountedTotalLevel1();
      // Если итог введён вручную — пересчитываем процент скидки из него (скидку
      // организатора фиксируем), иначе берём текущий процент из полей редактора.
      // Ручной пересчёт процентов имеет смысл только при активной скидке клиенту
      // (строка «Итого со скидкой d1%» в PDF есть только в этом случае).
      const exportDiscountPercent = hasManualDiscountedTotal && hasClientDiscount
        ? calculateDiscountPercentFromTotal(
            exportFinalDiscountedTotal ?? parsedDiscountedTotalInput,
            exportDiscount2Enabled ? exportDiscount2Percent : 0
          )
        : discountPercent;

      const exportBudgetNote = options?.contractEquipmentTypeRP
        ? `${budgetNote ? `${budgetNote}\n` : ''}Вид оборудования (в Р.П): ${options.contractEquipmentTypeRP}`
        : budgetNote;

      await generateBudgetPDF({
        eventName: event.name || event.event_type,
        eventDate: event.event_date,
        eventEndDate: event.event_end_date,
        createdDate: options?.createdDate || new Date().toISOString(),
        venueName: event.venues?.name,
        clientName: clientsList.find((client) => client.id === contractOrganizationId)?.organization || event.clients?.organization,
        version: budgetVersion,
        budgetItems,
        categories: categories,
        locations,
        exchangeRate: exchangeRate,
        paymentMode: paymentMode,
        discountEnabled: discountEnabled,
        discountPercent: exportDiscountPercent,
        discount2Enabled: exportDiscount2Enabled,
        discount2Percent: exportDiscount2Percent,
        budgetNote: exportBudgetNote,
        budgetDays,
        budgetTotalsMode,
        totalDay1FromEditor: getDay1TotalForPaymentMode(),
        totalCombinedFromEditor: getCombinedTotalForPaymentMode(),
        discountedTotalFromEditor: exportFinalDiscountedTotal ?? undefined,
        discountedTotalLevel1FromEditor: exportLevel1DiscountedTotal ?? undefined,
        totalWithExtraFromEditor: showExtraTotal ? getTotalWithExtraForPaymentMode() : undefined
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Ошибка при создании PDF: ${getErrorMessage(error)}`);
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleContractConfirm = async (payload: { date: string; equipmentTypeRP: string; organizationId: string }) => {
    setContractOrganizationId(payload.organizationId);
    setShowContractDialog(false);

    const event = await getEvent(eventId);
    const client = clientsList.find((item) => item.id === payload.organizationId);
    if (!client) {
      alert('Выбранная организация не найдена');
      return;
    }

    const parsedDiscountedTotalInput = parseFloat(discountedTotalInput.replace(',', '.'));
    const hasManualDiscountedTotal = hasAnyDiscount
      && discountedTotalInput.trim() !== '' && !isNaN(parsedDiscountedTotalInput);
    const contractAmount = hasManualDiscountedTotal
      ? normalizeGrandTotalForPaymentMode(parsedDiscountedTotalInput)
      : getDiscountedTotal() ?? getPrimaryTotalForMode();

    await generateContractDocx({
      event,
      client,
      equipmentTypeRP: payload.equipmentTypeRP,
      contractDate: payload.date,
      amount: contractAmount,
      budgetItems: getBudgetItemsInDisplayOrder(),
      locations,
      categories
    });
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
        });
      const nextSortOrder = targetGroupItems.length > 0
        ? Math.max(...targetGroupItems.map((item) => item.sort_order || 0)) + 1
        : 0;

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
      // Handle location change if source and destination locations differ
      const sourceCategoryId = sourceGroup.categoryId;
      const sourceLocId = sourceGroup.locationId || null;
      const destLocId = destinationGroup.locationId || null;

      if (sourceLocId !== destLocId) {
        const itemsToMove = budgetItems.filter((item) =>
          item.category_id === sourceGroup.categoryId &&
          (item.location_id || null) === sourceLocId
        );

        for (const item of itemsToMove) {
          await updateBudgetItem(item.id, {
            location_id: destLocId,
            category_id: sourceGroup.categoryId,
            is_extra: isExtraServiceCategory(sourceGroup.categoryId)
          });
        }

        setBudgetItems((prev) => prev.map((item) => {
          if (
            item.category_id === sourceGroup.categoryId &&
            (item.location_id || null) === sourceLocId
          ) {
            return { ...item, location_id: destLocId };
          }
          return item;
        }));

        setActiveCategoryIds((prev) => {
          const next = new Set(prev);
          next.delete(buildCategoryGroupId(sourceCategoryId, sourceLocId));
          next.add(buildCategoryGroupId(sourceCategoryId, destLocId));
          return next;
        });
      }

      // Handle category reordering if dropping on another category
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
      });

    const sourceIndex = categoryItems.findIndex(item => item.id === sourceItemId);
    const targetIndex = categoryItems.findIndex(item => item.id === targetItemId);

    if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
      const newOrder = [...categoryItems];
      const [movedItem] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);

      const updatedCategoryItems = newOrder.map((item, index) => ({
        ...item,
        sort_order: index
      }));

      for (const item of updatedCategoryItems) {
        await updateBudgetItem(item.id, { sort_order: item.sort_order });
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
      const reorderedItems = [...otherCategoryItems, ...updatedCategoryItems];
      setBudgetItems(reorderedItems);
    }

    setDraggedItem(null);
  };

  const handleTouchItemDrop = async (targetItemId: string | null, targetGroup: BudgetDragTarget | null) => {
    if (!draggedItem) return;
    if (draggedItem.type === 'item' && targetItemId === draggedItem.id) return;
    if (draggedItem.type === 'item' && targetItemId && targetItemId !== draggedItem.id) {
      await handleDropOnItem({ preventDefault: () => {}, stopPropagation: () => {} } as React.DragEvent, targetItemId);
      return;
    }
    if (targetGroup) {
      await handleDrop({ preventDefault: () => {}, stopPropagation: () => {} } as React.DragEvent, targetGroup);
      return;
    }
    setDraggedItem(null);
    setDragOverItemId(null);
    setDragOverTarget(null);
  };

  const cancelBudgetDrag = () => {
    setDraggedItem(null);
    setDragOverItemId(null);
    setDragOverTarget(null);
  };
  useBudgetTouchDrag(budgetListRef, {
    enabled: !loading && canAccess(user, 'budgets', 2),
    onStart: setDraggedItem,
    onDrop: handleTouchItemDrop,
    onCancel: cancelBudgetDrag,
    onError: error => alert(`Ошибка перемещения: ${getErrorMessage(error)}`),
  });

  const isDeliveryWork = (item: BudgetItem): boolean => {
    if (item.item_type !== 'work') return false;
    const workName = item.work_item?.name?.toLowerCase() || '';
    return workName.includes('доставка оборудования') || workName.includes('доставка персонала');
  };

  const calculateBYNCash = (amountUSD: number): number => {
    const baseAmount = amountUSD * exchangeRate;
    return Math.ceil(baseAmount);
  };

  const calculateBYNNonCash = (amountUSD: number, item?: BudgetItem): number => {
    const baseAmount = amountUSD * exchangeRate;
    let withBankRate: number;
    if (item && item.item_type === 'work' && !isDeliveryWork(item)) {
      withBankRate = baseAmount * 1.67;
    } else {
      withBankRate = baseAmount / 0.8;
    }
    return Math.ceil(withBankRate);
  };

  const equipmentCategories = ['Все', ...Array.from(new Set(equipment.map(item => item.category)))];
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredEquipment = equipment.filter(item => {
    const hasPrice = item.rental_price > 0;
    const matchesSearch = !normalizedSearchTerm ||
      item.name.toLowerCase().includes(normalizedSearchTerm) ||
      item.category.toLowerCase().includes(normalizedSearchTerm);
    const matchesCategory = selectedEquipmentCategory === 'Все' || item.category === selectedEquipmentCategory;
    return hasPrice && matchesSearch && matchesCategory;
  });

  const filteredWorkItems = workItems.filter(item =>
    !normalizedSearchTerm ||
    item.name.toLowerCase().includes(normalizedSearchTerm) ||
    item.unit.toLowerCase().includes(normalizedSearchTerm)
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

  const sortBudgetGroupItems = (items: BudgetItem[]) => [...items].sort((a, b) =>
    (a.sort_order || 0) - (b.sort_order || 0) ||
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  const getBudgetItemsInDisplayOrder = () => {
    const orderedItems: BudgetItem[] = [];
    const addGroupItems = (groupId: string) => {
      orderedItems.push(...sortBudgetGroupItems(groupedItems[groupId] || []));
    };
    const visibleCategories = categories.filter(category => category.is_template !== true);

    locations.forEach((location) => {
      visibleCategories.forEach((category) => addGroupItems(buildCategoryGroupId(category.id, location.id)));
      addGroupItems(buildLocationUncategorizedGroupId(location.id));
    });

    visibleCategories.forEach((category) => addGroupItems(buildCategoryGroupId(category.id, null)));
    addGroupItems(NO_LOCATION_GROUP_ID);

    const orderedIds = new Set(orderedItems.map((item) => item.id));
    const missingItems = budgetItems.filter((item) => !orderedIds.has(item.id));

    return [...orderedItems, ...sortBudgetGroupItems(missingItems)];
  };

  // Discount/total math must operate on NON-extra items only. Extra services are
  // added back separately via getTotalWithExtraForPaymentMode and are never discounted.
  const mainBudgetItems = budgetItems.filter((item) => !isExtraServiceCategory(item.category_id));
  const nonWorkItems = mainBudgetItems.filter(item => item.item_type !== 'work');
  const workItems2 = mainBudgetItems.filter(item => item.item_type === 'work');
  const isConsumablesEquipmentItem = (item: BudgetItem) =>
    item.item_type === 'equipment' && item.equipment?.category?.trim().toLowerCase() === 'расходные материалы';
  const discountEligibleNonWorkItems = nonWorkItems.filter(item => !isConsumablesEquipmentItem(item));
  const mainTotalsUSD = calcGrandTotals(mainBudgetItems, budgetDays, budgetTotalsMode);
  const nonWorkTotalsUSD = calcGrandTotals(nonWorkItems, budgetDays, budgetTotalsMode);
  const workTotalsUSD = calcGrandTotals(workItems2, budgetDays, budgetTotalsMode);

  const totalDay1BYNCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNCash(item.price) * item.quantity, 0);
  const totalCombinedBYNCash = mainBudgetItems.reduce((sum, item) => {
    const priceNDays = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNCash(priceNDays) * item.quantity;
  }, 0);
  const totalDay1BYNNonCash = mainBudgetItems.reduce((sum, item) => sum + calculateBYNNonCash(item.price, item) * item.quantity, 0);
  const totalCombinedBYNNonCash = mainBudgetItems.reduce((sum, item) => {
    const priceNDays = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNNonCash(priceNDays, item) * item.quantity;
  }, 0);

  const nonWorkTotalBYNCashForMode = nonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = budgetTotalsMode === 'combined_only' ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays) : item.price;
    return sum + calculateBYNCash(usdUnitPrice) * item.quantity;
  }, 0);
  const nonWorkTotalBYNNonCashForMode = nonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = budgetTotalsMode === 'combined_only' ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays) : item.price;
    return sum + calculateBYNNonCash(usdUnitPrice, item) * item.quantity;
  }, 0);
  const workTotalBYNCashForMode = workItems2.reduce((sum, item) => {
    const usdUnitPrice = budgetTotalsMode === 'combined_only' ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays) : item.price;
    return sum + calculateBYNCash(usdUnitPrice) * item.quantity;
  }, 0);
  const workTotalBYNNonCashForMode = workItems2.reduce((sum, item) => {
    const usdUnitPrice = budgetTotalsMode === 'combined_only' ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays) : item.price;
    return sum + calculateBYNNonCash(usdUnitPrice, item) * item.quantity;
  }, 0);
  const nonWorkTotalBYNCashCombined = nonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNCash(usdUnitPrice) * item.quantity;
  }, 0);
  const nonWorkTotalBYNNonCashCombined = nonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNNonCash(usdUnitPrice, item) * item.quantity;
  }, 0);
  const workTotalBYNCashCombined = workItems2.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNCash(usdUnitPrice) * item.quantity;
  }, 0);
  const workTotalBYNNonCashCombined = workItems2.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNNonCash(usdUnitPrice, item) * item.quantity;
  }, 0);

  const discountEligibleTotalsUSD = calcGrandTotals(discountEligibleNonWorkItems, budgetDays, budgetTotalsMode);
  const discountEligibleTotalBYNCashCombined = discountEligibleNonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNCash(usdUnitPrice) * item.quantity;
  }, 0);
  const discountEligibleTotalBYNNonCashCombined = discountEligibleNonWorkItems.reduce((sum, item) => {
    const usdUnitPrice = calcCombinedTotal({ ...item, quantity: 1 }, budgetDays);
    return sum + calculateBYNNonCash(usdUnitPrice, item) * item.quantity;
  }, 0);
  const discountEligibleTotalBYNCashDay1 = discountEligibleNonWorkItems.reduce(
    (sum, item) => sum + calculateBYNCash(item.price) * item.quantity, 0);
  const discountEligibleTotalBYNNonCashDay1 = discountEligibleNonWorkItems.reduce(
    (sum, item) => sum + calculateBYNNonCash(item.price, item) * item.quantity, 0);

  // Суммы по текущему режиму итогов (combined_only / day1_plus_combined).
  // ВАЖНО: в режиме «Итого за 1дн и Nдн» при нескольких днях базой скидки является
  // сумма оборудования на N день (combined), а не за первый день — обе скидки и
  // промежуточный итог считаются от неё.
  const isCombinedOnlyTotals = budgetTotalsMode === 'combined_only';
  const isMultiDayTotals = budgetDays > 1;
  const discountBasesFollowCombined = isCombinedOnlyTotals || isMultiDayTotals;
  const nonWorkTotalForModeCash = isCombinedOnlyTotals ? nonWorkTotalBYNCashCombined : nonWorkTotalBYNCashForMode;
  const nonWorkTotalForModeNonCash = isCombinedOnlyTotals ? nonWorkTotalBYNNonCashCombined : nonWorkTotalBYNNonCashForMode;
  const workTotalForModeCash = isCombinedOnlyTotals ? workTotalBYNCashCombined : workTotalBYNCashForMode;
  const workTotalForModeNonCash = isCombinedOnlyTotals ? workTotalBYNNonCashCombined : workTotalBYNNonCashForMode;
  const discountEligibleTotalForModeCash = isCombinedOnlyTotals ? discountEligibleTotalBYNCashCombined : discountEligibleTotalBYNCashDay1;
  const discountEligibleTotalForModeNonCash = isCombinedOnlyTotals ? discountEligibleTotalBYNNonCashCombined : discountEligibleTotalBYNNonCashDay1;
  const discountEligibleTotalsForModeUSD = isCombinedOnlyTotals
    ? discountEligibleTotalsUSD.combinedTotal
    : discountEligibleTotalsUSD.day1Total;
  const nonWorkTotalsForModeUSD = isCombinedOnlyTotals
    ? nonWorkTotalsUSD.combinedTotal
    : nonWorkTotalsUSD.day1Total;
  const workTotalsForModeUSD = isCombinedOnlyTotals
    ? workTotalsUSD.combinedTotal
    : workTotalsUSD.day1Total;

  type DiscountTotalsMode = 'day1' | 'combined';

  // Расчёт «базы скидки» (сумма оборудования) и несбрасываемой части (расходники + работа)
  // отдельно для суммы за 1 день и за N дней. В режиме «Итого за 1дн и Nдн» скидка для
  // каждой выводимой суммы считается от суммы оборудования соответствующего дня
  // (для N-го итога — от суммы на N день, а не на первый).
  const getDiscountBasesForTotalsMode = (totalsMode: DiscountTotalsMode) => {
    switch (paymentMode) {
      case 'byn_cash':
        return totalsMode === 'combined'
          ? { discountable: discountEligibleTotalBYNCashCombined, fixed: (nonWorkTotalBYNCashCombined - discountEligibleTotalBYNCashCombined) + workTotalBYNCashCombined }
          : { discountable: discountEligibleTotalBYNCashDay1, fixed: (nonWorkTotalBYNCashForMode - discountEligibleTotalBYNCashDay1) + workTotalBYNCashForMode };
      case 'byn_noncash':
        return totalsMode === 'combined'
          ? { discountable: discountEligibleTotalBYNNonCashCombined, fixed: (nonWorkTotalBYNNonCashCombined - discountEligibleTotalBYNNonCashCombined) + workTotalBYNNonCashCombined }
          : { discountable: discountEligibleTotalBYNNonCashDay1, fixed: (nonWorkTotalBYNNonCashForMode - discountEligibleTotalBYNNonCashDay1) + workTotalBYNNonCashForMode };
      default:
        return totalsMode === 'combined'
          ? { discountable: discountEligibleTotalsUSD.combinedTotal, fixed: (nonWorkTotalsUSD.combinedTotal - discountEligibleTotalsUSD.combinedTotal) + workTotalsUSD.combinedTotal }
          : { discountable: discountEligibleTotalsUSD.day1Total, fixed: (nonWorkTotalsUSD.day1Total - discountEligibleTotalsUSD.day1Total) + workTotalsUSD.day1Total };
    }
  };

  const computeDiscountedTotalFromBases = (
    totalsMode: DiscountTotalsMode,
    multiplier: number
  ) => {
    const { discountable, fixed } = getDiscountBasesForTotalsMode(totalsMode);
    return normalizeGrandTotalForPaymentMode(discountable * multiplier + fixed);
  };

  // Промежуточный итог со скидкой клиента (без скидки организатора) — для первой строки в PDF.
  // totalsMode задает базу скидки ('day1' | 'combined'); по умолчанию — по текущему режиму итогов.
  const getDiscountedTotalLevel1 = (totalsMode?: DiscountTotalsMode) => {
    if (!hasClientDiscount) return null;
    const mode = totalsMode ?? (discountBasesFollowCombined ? 'combined' : 'day1');
    return computeDiscountedTotalFromBases(mode, 1 - discountPercent / 100);
  };

  const getDiscountedTotal = (totalsMode?: DiscountTotalsMode) => {
    // Итог со скидками считается, если активен хотя бы один уровень скидок.
    if (!hasAnyDiscount) return null;
    const mode = totalsMode ?? (discountBasesFollowCombined ? 'combined' : 'day1');
    // Зависимость (режимов выбора нет):
    // - скидка клиенту НЕ активна -> скидка организатору применяется к базе сметы
    //   (стоимости оборудования): база x (1 - d2/100);
    // - скидка клиенту активна -> скидка организатору считается от скидки клиента,
    //   скидки применяются последовательно: база x (1 - d1/100) x (1 - d2/100).
    const d1Multiplier = hasClientDiscount ? 1 - discountPercent / 100 : 1;
    const d2Multiplier = hasOrganizerDiscount ? 1 - discount2Percent / 100 : 1;
    const multiplier = d1Multiplier * d2Multiplier;
    return computeDiscountedTotalFromBases(mode, multiplier);
  };

  // Активный процент для надписей «Итого со скидкой …%» (комбинация уровней скидок).
  const activeDiscountPercentLabel = (() => {
    const parts: string[] = [];
    if (hasClientDiscount) parts.push(`${discountPercent}%`);
    if (hasOrganizerDiscount) parts.push(`${discount2Percent}%`);
    return parts.join(' + ');
  })();
  // Подпись строки «Итого со скидкой» в подвале редактора (без значков-сносок).
  const footerDiscountLabel = `Итого со скидкой ${activeDiscountPercentLabel}`;

  const getDiscountTotalsBaseForPaymentMode = () => {
    switch (paymentMode) {
      case 'byn_cash':
        return discountBasesFollowCombined
          ? {
              discountable: discountEligibleTotalBYNCashCombined,
              fixed: (nonWorkTotalBYNCashCombined - discountEligibleTotalBYNCashCombined) + workTotalBYNCashCombined
            }
          : {
          discountable: discountEligibleTotalForModeCash,
          fixed: (nonWorkTotalForModeCash - discountEligibleTotalForModeCash) + workTotalForModeCash
        };
      case 'byn_noncash':
        return discountBasesFollowCombined
          ? {
              discountable: discountEligibleTotalBYNNonCashCombined,
              fixed: (nonWorkTotalBYNNonCashCombined - discountEligibleTotalBYNNonCashCombined) + workTotalBYNNonCashCombined
            }
          : {
          discountable: discountEligibleTotalForModeNonCash,
          fixed: (nonWorkTotalForModeNonCash - discountEligibleTotalForModeNonCash) + workTotalForModeNonCash
        };
      default:
        return discountBasesFollowCombined
          ? {
              discountable: discountEligibleTotalsUSD.combinedTotal,
              fixed: (nonWorkTotalsUSD.combinedTotal - discountEligibleTotalsUSD.combinedTotal) + workTotalsUSD.combinedTotal
            }
          : {
          discountable: discountEligibleTotalsForModeUSD,
          fixed: (nonWorkTotalsForModeUSD - discountEligibleTotalsForModeUSD) + workTotalsForModeUSD
        };
    }
  };


  const calculateDiscountPercentFromTotal = (targetTotal: number, secondDiscountPercent = hasOrganizerDiscount ? discount2Percent : 0) => {
    const { discountable, fixed } = getDiscountTotalsBaseForPaymentMode();
    if (discountable <= 0) {
      return 0;
    }
    // Скидка организатора фиксируется при обратном расчёте процента скидки клиента.
    // Зависимость: если скидка клиенту активна — скидка организатора «от скидки клиента»
    // (база x (1 - d1) уже учтена множителем (1 - d2)); если скидка клиенту неактивна —
    // скидка организатора идёт от сметы (множитель (1 - d2) к базе сметы).
    const hasSecondDiscount = secondDiscountPercent > 0;
    const effectiveDiscountable = hasSecondDiscount ? discountable * (1 - secondDiscountPercent / 100) : discountable;
    if (effectiveDiscountable <= 0) {
      return 0;
    }
    const nextPercent = (1 - (targetTotal - fixed) / effectiveDiscountable) * 100;
    return Math.min(100, Math.max(0, nextPercent));
  };

  useEffect(() => {
    const discountedTotal = getDiscountedTotal();
    if (discountedTotal === null) {
      setDiscountedTotalInput('');
      return;
    }
    setDiscountedTotalInput(String(discountedTotal));
  }, [discountEnabled, discountPercent, discount2Enabled, discount2Percent, paymentMode, budgetTotalsMode, budgetDays, budgetItems, exchangeRate]);

  const applyDiscountedTotalInput = () => {
    const parsedValue = parseFloat(discountedTotalInput.replace(',', '.'));
    if (isNaN(parsedValue) || discountedTotalInput.trim() === '') {
      const recalculatedTotal = getDiscountedTotal();
      setDiscountedTotalInput(recalculatedTotal !== null ? String(recalculatedTotal) : '');
      return;
    }

    // Обратный пересчёт процентов из введённой суммы имеет смысл только при активной
    // скидке клиенту (скидка организатора — второй уровень, её процент фиксируем).
    // Если скидка клиенту неактивна, а активна только скидка организатора — итог
    // считается от сметы, и ручная сумма остаётся как есть (проценты не меняются).
    if (!hasClientDiscount) {
      if (hasOrganizerDiscount) return;
      // Ни одна скидка не активна — включаем «Скидку клиенту» и подбираем её процент,
      // чтобы итог совпал с введённой суммой.
      setDiscountEnabled(true);
      const percent1 = calculateDiscountPercentFromTotal(parsedValue, 0);
      setDiscountPercent(percent1);
      setDiscountPercentInput(String(percent1));
      return;
    }

    const effectiveD2Percent = Math.round(hasOrganizerDiscount ? discount2Percent : 0);

    let percent1 = calculateDiscountPercentFromTotal(parsedValue, effectiveD2Percent);

    if (hasOrganizerDiscount && effectiveD2Percent > 0) {
      // Первая скидка отображается в процентах — округляем её до целого и
      // корректируем вторую скидку так, чтобы итоговая сумма осталась равной введённой.
      const roundedPercent1 = Math.max(1, Math.min(99, Math.round(percent1)));
      const { discountable, fixed } = getDiscountTotalsBaseForPaymentMode();
      const afterFirst = discountable * (1 - roundedPercent1 / 100);
      if (afterFirst > 0) {
        const d2 = (1 - (parsedValue - fixed) / afterFirst) * 100;
        const clampedD2 = Math.min(100, Math.max(0, d2));
        setDiscount2Percent(clampedD2);
        setDiscount2PercentInput(String(clampedD2));
      }
      percent1 = roundedPercent1;
    }

    setDiscountPercent(percent1);
    setDiscountPercentInput(String(percent1));
  };

  const normalizeGrandTotalForPaymentMode = (value: number) => {
    if (paymentMode === 'usd') {
      return Math.round(value * 100) / 100;
    }
    return Math.floor(value);
  };

  const roundDownToNearestFive = (value: number): number => {
    return Math.floor(value / 5) * 5;
  };

  const calculateCategoryTotalForPaymentMode = (items: BudgetItem[], mode: 'day1' | 'combined') => {
    switch (paymentMode) {
      case 'byn_cash':
        return items.reduce((sum, item) => {
          const unitPriceUSD = mode === 'combined'
            ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays)
            : item.price;
          return sum + calculateBYNCash(unitPriceUSD) * item.quantity;
        }, 0);
      case 'byn_noncash':
        return items.reduce((sum, item) => {
          const unitPriceUSD = mode === 'combined'
            ? calcCombinedTotal({ ...item, quantity: 1 }, budgetDays)
            : item.price;
          return sum + calculateBYNNonCash(unitPriceUSD, item) * item.quantity;
        }, 0);
      default:
        return items.reduce(
          (sum, item) => sum + (mode === 'combined' ? calcCombinedTotal(item, budgetDays) : calcDay1Total(item)),
          0
        );
    }
  };

  const getCategoriesSumForPaymentMode = (mode: 'day1' | 'combined') => {
    const mainBudgetItemsOnly = budgetItems.filter((item) => !isExtraServiceCategory(item.category_id));

    const groupedMainItems = mainBudgetItemsOnly.reduce((acc, item) => {
      const groupId = item.category_id
        ? buildCategoryGroupId(item.category_id, item.location_id)
        : item.location_id
          ? buildLocationUncategorizedGroupId(item.location_id)
          : NO_LOCATION_GROUP_ID;

      if (!acc[groupId]) acc[groupId] = [];
      acc[groupId].push(item);
      return acc;
    }, {} as GroupedItemsByLocation);

    return Object.values(groupedMainItems).reduce((sum, items) => {
      const categoryTotal = calculateCategoryTotalForPaymentMode(items, mode);
      return sum + categoryTotal;
    }, 0);
  };

  const getDay1TotalForPaymentMode = () => {
    if (budgetItems.length > 0) {
      return getCategoriesSumForPaymentMode('day1');
    }

    switch (paymentMode) {
      case 'byn_cash': return totalDay1BYNCash;
      case 'byn_noncash': return totalDay1BYNNonCash;
      default: return mainTotalsUSD.day1Total;
    }
  };

  const getCombinedTotalForPaymentMode = () => {
    if (budgetItems.length > 0) {
      return getCategoriesSumForPaymentMode('combined');
    }

    switch (paymentMode) {
      case 'byn_cash': return totalCombinedBYNCash;
      case 'byn_noncash': return totalCombinedBYNNonCash;
      default: return mainTotalsUSD.combinedTotal;
    }
  };

  const getPrimaryTotalForMode = () => {
    const rawTotal = budgetTotalsMode === 'combined_only'
      ? getCombinedTotalForPaymentMode()
      : getDay1TotalForPaymentMode();

    return normalizeGrandTotalForPaymentMode(rawTotal);
  };

  const getExtraServiceItems = () => {
    return budgetItems.filter((item) => isExtraServiceCategory(item.category_id));
  };

  const getTotalWithExtraForPaymentMode = () => {
    const extraItems = getExtraServiceItems();

    // Calculate totals for both day1 and combined modes
    const extraTotalDay1 = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'day1')
      : 0;
    
    const extraTotalCombined = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'combined')
      : 0;

    // Base total excludes extra services (they are never discounted). With a discount
    // applied, the base is the discounted non-extra total computed from the equipment
    // sum of the corresponding day (1 день / N дней); otherwise the plain primary total.
    const baseTotalDay1 = getDiscountedTotal('day1') !== null
      ? getDiscountedTotal('day1')!
      : getDay1TotalForPaymentMode();
    
    const baseTotalCombined = getDiscountedTotal('combined') !== null
      ? getDiscountedTotal('combined')!
      : getCombinedTotalForPaymentMode();

    // Apply round down to nearest 5 for consistency with main totals
    const grandTotalWithExtrasDay1 = roundDownToNearestFive(baseTotalDay1 + extraTotalDay1);
    const grandTotalWithExtrasCombined = roundDownToNearestFive(baseTotalCombined + extraTotalCombined);

    // Return based on current mode
    if (budgetTotalsMode === 'combined_only') {
      return grandTotalWithExtrasCombined;
    } else {
      // In day1_plus_combined mode, return day1 total (UI will show both separately if needed)
      return grandTotalWithExtrasDay1;
    }
  };

  const getTotalWithExtraDay1 = () => {
    const extraItems = getExtraServiceItems();
    const extraTotal = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'day1')
      : 0;
    // Скидка считается от суммы оборудования за 1 день.
    const baseTotal = getDiscountedTotal('day1') !== null
      ? getDiscountedTotal('day1')!
      : getDay1TotalForPaymentMode();
    return roundDownToNearestFive(baseTotal + extraTotal);
  };

  const getTotalWithExtraCombined = () => {
    const extraItems = getExtraServiceItems();
    const extraTotal = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'combined')
      : 0;
    // Скидка считается от суммы оборудования на N день (а не на первый).
    const baseTotal = getDiscountedTotal('combined') !== null
      ? getDiscountedTotal('combined')!
      : getCombinedTotalForPaymentMode();
    return roundDownToNearestFive(baseTotal + extraTotal);
  };

  const getDiscountedTotalWithExtraDay1 = () => {
    if (getDiscountedTotal('day1') === null) return null;
    const extraItems = getExtraServiceItems();
    const extraTotal = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'day1')
      : 0;
    const baseTotal = getDiscountedTotal('day1')!;
    return roundDownToNearestFive(baseTotal + extraTotal);
  };

  const getDiscountedTotalWithExtraCombined = () => {
    if (getDiscountedTotal('combined') === null) return null;
    const extraItems = getExtraServiceItems();
    const extraTotal = extraItems.length > 0
      ? calculateCategoryTotalForPaymentMode(extraItems, 'combined')
      : 0;
    const baseTotal = getDiscountedTotal('combined')!;
    return roundDownToNearestFive(baseTotal + extraTotal);
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





  if (!loading && !canAccess(user, 'budgets', 2)) {
    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950 md:bg-black/70 md:p-3">
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-gray-900 md:h-auto md:max-h-[90dvh] md:max-w-4xl md:rounded-xl md:border md:border-gray-700">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 p-4"><h2 className="font-semibold text-white">Смета: {budgetName}</h2><button type="button" onClick={onClose} aria-label="Закрыть" className="rounded p-2 text-gray-300"><X className="h-5 w-5" /></button></header>
        <div className="min-h-0 overflow-y-auto p-4">{canAccess(user, 'budgets') ? <><p className="mb-3 text-xs text-gray-400">Режим просмотра</p>{budgetItems.map(item => <div key={item.id} className="flex justify-between gap-3 border-b border-gray-800 py-3 text-sm"><span className="text-gray-200">{item.equipment?.name || item.work_item?.name || item.name || 'Позиция'}</span><span className="shrink-0 text-cyan-400">{item.quantity} × {item.price}</span></div>)}<p className="mt-4 font-semibold text-white">Итого: {getPrimaryTotalForMode().toLocaleString()} {getCurrencyLabel()}</p></> : <p className="text-gray-400">Нет доступа к сметам.</p>}</div>
      </section>
    </div>;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-gray-900 p-8 rounded-lg">
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  const currencySettings = (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Курс валюты</label>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Курс валюты"
          value={exchangeRateInput}
          onChange={(e) => {
            const value = e.target.value;
            if (!/^\d*([.,]\d*)?$/.test(value)) return;
            setExchangeRateInput(value);
            const rate = Math.round(Number(value.replace(',', '.')) * 100) / 100;
            if (Number.isFinite(rate) && rate > 0) setExchangeRate(rate);
          }}
          onBlur={() => setExchangeRateInput(String(exchangeRate))}
          className="min-h-11 w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-base md:min-h-0 md:text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Система расчёта</label>
        <button
          onClick={() => setPaymentMode('usd')}
          className={`min-h-11 w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors md:min-h-0 md:text-xs ${
            paymentMode === 'usd'
              ? 'bg-cyan-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          USD
        </button>
        <button
          onClick={() => setPaymentMode('byn_noncash')}
          className={`min-h-11 w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors md:min-h-0 md:text-xs ${
            paymentMode === 'byn_noncash'
              ? 'bg-cyan-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          BYN (безналичный)
        </button>
        <button
          onClick={() => setPaymentMode('byn_cash')}
          className={`min-h-11 w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors md:min-h-0 md:text-xs ${
            paymentMode === 'byn_cash'
              ? 'bg-cyan-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          BYN (наличный)
        </button>
      </div>
    </div>
  );
  const categoryMenu = showCategoryDropdown && (
    <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar p-0.5">
      {globalCategories.map(category => (
        <button
          key={category.id}
          onClick={() => handleSelectCategory(category)}
          className="min-h-11 w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-lg md:min-h-0 md:text-xs"
        >
          {category.name}
        </button>
      ))}
    </div>
  );

  return (
    <main aria-label={`Смета: ${budgetName}`} onDragEnd={cancelBudgetDrag} className={`mobile-budget-page ${draggedItem ? 'budget-is-dragging' : ''} fixed inset-0 z-[60] flex h-[100dvh] items-center justify-center bg-gray-950 md:bg-black/60 md:p-4 md:backdrop-blur-sm`}>
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
        @media (max-width: 767px) {
          .mobile-budget-page .budget-items-heading { display: none; }
          .mobile-budget-page .budget-category-header {
            min-height: 52px; gap: 8px; padding: 8px; margin: 8px 0;
            border: 1px solid #374151; border-radius: 12px; flex-wrap: nowrap; gap: 4px;
          }
          .mobile-budget-page [data-budget-drag-type] { touch-action: none; user-select: none; -webkit-user-select: none; opacity: 1; display: flex; align-items: center; justify-content: center; min-width: 24px; min-height: 32px; }
          .mobile-budget-page .budget-category-header h3 { min-width: 0; font-size: 14px; }
          .mobile-budget-page .budget-category-header > :not(h3) { flex-shrink: 0; }
          .mobile-budget-page .budget-category-header > div:last-child { white-space: nowrap; }
          .mobile-budget-page .budget-category-header > button { min-width: 28px; min-height: 32px; }
          .mobile-budget-page .budget-category-header svg { width: 14px; height: 14px; }
          .mobile-budget-page .budget-item-row {
            position: relative; flex-wrap: wrap; gap: 8px; padding: 12px; margin: 8px 0;
            border: 1px solid #1f2937; border-radius: 12px; background-color: #111827;
          }
          .mobile-budget-page .budget-item-row > [draggable] {
            position: absolute; left: 4px; top: 10px; width: 24px;
          }
          .mobile-budget-page .budget-item-fields > :first-child { padding-left: 20px; }
          .mobile-budget-page .budget-mobile-navigation {
            max-height: 360px; overflow: hidden; opacity: 1;
            transition: max-height 220ms ease, opacity 180ms ease;
          }
          .mobile-budget-page.budget-is-dragging .budget-mobile-navigation { max-height: 0; opacity: 0; pointer-events: none; }
          .mobile-budget-page.budget-is-dragging { user-select: none; }
          @media (prefers-reduced-motion: reduce) {
            .mobile-budget-page .budget-mobile-navigation { transition: none; }
          }
          .mobile-budget-page .budget-item-fields,
          .mobile-budget-page .budget-item-fields-with-coefficient {
            order: -1; flex-basis: 100%; min-width: 0;
            grid-template-columns: minmax(72px, 1.1fr) minmax(32px, .55fr) minmax(64px, 1fr) minmax(0, 1.5fr) !important;
            gap: 8px 4px;
          }
          .mobile-budget-page .budget-item-fields > :first-child {
            grid-column: 1 / -1; min-height: 28px; padding-right: 88px; font-size: 15px; font-weight: 600;
          }
          .mobile-budget-page [data-mobile-label] {
            display: flex; align-items: center; justify-content: center; text-align: center; min-width: 0;
          }
          .mobile-budget-page [data-mobile-label]::before { display: none; }
          .mobile-budget-page [data-mobile-label="Количество"] { grid-column: 1; grid-row: 2; }
          .mobile-budget-page [data-mobile-label="Ед. изм."] { grid-column: 2; grid-row: 2; }
          .mobile-budget-page [data-mobile-label="Цена"] { grid-column: 3; grid-row: 2; gap: 2px; }
          .mobile-budget-page [data-mobile-label="Цена"]::before {
            content: '×'; display: block; color: #9ca3af; font-size: 16px;
          }
          .mobile-budget-page [data-mobile-label="Цена"] input { min-width: 0; flex-shrink: 1; }
          .mobile-budget-page [data-mobile-label="Сумма"] {
            grid-column: 4; grid-row: 2; justify-content: flex-end; gap: 4px;
            padding-right: 0; white-space: nowrap; font-size: 14px;
          }
          .mobile-budget-page [data-mobile-label="Сумма"]::before {
            content: '='; display: block; margin-right: auto; color: #9ca3af; font-size: 16px;
          }
          .mobile-budget-page [data-mobile-label="Коэф."] {
            grid-column: 1 / -1; grid-row: 3; justify-content: flex-start; gap: 8px;
          }
          .mobile-budget-page [data-mobile-label="Коэф."]::before {
            content: attr(data-mobile-label); display: block; color: #9ca3af; font-size: 10px;
          }
          .mobile-budget-page .budget-item-fields input { min-height: 36px; max-width: 100%; text-align: center; font-size: 16px; }
          .mobile-budget-page [data-mobile-label="Количество"] button { min-height: 36px; min-width: 20px; }
          .mobile-budget-page [data-mobile-label="Ед. изм."] button { min-height: 36px; font-size: 13px; }
          .mobile-budget-page .budget-item-actions { position: absolute; top: 10px; right: 8px; gap: 0; }
          .mobile-budget-page .budget-item-actions > button,
          .mobile-budget-page .budget-item-actions > div,
          .mobile-budget-page .budget-item-actions > div > button {
            width: 28px; min-width: 28px; min-height: 28px; align-items: center; opacity: 1;
          }
        }
        .budget-touch-target { outline: 2px solid #22d3ee; outline-offset: -2px; background-color: #164e6333; }
        .budget-touch-ghost {
          position: fixed; z-index: 1000; pointer-events: none; max-width: 220px;
          padding: 8px 12px; border: 1px solid #22d3ee; border-radius: 10px;
          background: #111827; color: #e5e7eb; font-size: 13px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 8px 24px #0008;
        }
        /* Для Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #374151 #111827;
        }
      `}</style>

      <div className="flex h-full w-full flex-col overflow-hidden bg-gray-950 md:h-[90vh] md:max-w-[1600px] md:rounded-xl md:border md:border-gray-800 md:bg-gray-900 md:shadow-2xl">
        {/* Header */}
        <div className="hidden px-4 py-2 border-b border-gray-800 md:flex justify-between items-start gap-3 flex-shrink-0 bg-gray-900/50">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="min-w-0 text-lg font-bold text-white flex items-center gap-2 break-words">
              Смета: {budgetName}
            </h2>
            <div className="flex items-center gap-1.5">
              <label htmlFor="budget-version" className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Версия</label>
              <input
                id="budget-version"
                type="text"
                value={budgetVersion}
                onChange={(e) => setBudgetVersion(e.target.value)}
                placeholder="1.0"
                className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
              />
            </div>

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
                  {currencySettings}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBudgetNoteDialog(true)}
              className="px-2 py-1 text-[11px] font-medium text-cyan-300 border border-cyan-700/60 rounded-md hover:bg-cyan-500/10 transition-colors"
            >
              +Примечание
            </button>
            <button
              onClick={() => setShowStickyNotes(!showStickyNotes)}
              className="text-gray-400 hover:text-yellow-400 p-1 hover:bg-gray-800 rounded-full transition-all"
              title="Заметки"
            >
              <StickyNote className="w-5 h-5" />
            </button>
            <button
              onClick={handleClose}
              aria-label="Закрыть смету"
              className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="budget-mobile-navigation shrink-0">
        <MobileBudgetNavigation
          name={budgetName} tab={mobileTab} onTabChange={changeMobileTab} count={budgetItems.length}
          onBack={handleClose} onSettings={() => setShowMobileSettings(true)}
          onCategory={() => setShowCategoryDropdown(!showCategoryDropdown)}
          onLocation={() => setShowLocationDialog(true)} onService={handleCreateExtraServiceCategory}
          onTemplate={() => setShowTemplates(true)} categoryMenu={categoryMenu}
        />
        </div>

        {(autosave.error || autosave.status === 'saving') && <div role={autosave.error ? 'alert' : 'status'} aria-live="polite" className={`shrink-0 px-4 py-1.5 text-xs ${autosave.error ? 'bg-red-950 text-red-200' : 'text-gray-500'}`}>
          {autosave.error ? <>Не удалось сохранить изменения: {autosave.error}. Автосохранение повторится после восстановления соединения. <button type="button" onClick={() => { void autosave.flush().catch(() => {}); }} className="ml-1 underline">Повторить</button></> : 'Сохранение…'}
        </div>}

        {/* Main content */}
        <div className={`${mobileTab === 'total' ? 'hidden' : 'flex'} flex-1 min-h-0 overflow-hidden md:flex`}>
          {/* Left column */}
          <div className={`${mobileTab === 'estimate' ? 'flex' : 'hidden'} w-full min-w-0 flex-col md:flex md:w-3/5 md:border-r md:border-gray-800`}>
            {/* Toolbar */}
            <div className="hidden bg-gray-900/80 border-b border-gray-800 px-3 py-2 flex-shrink-0 md:block">
              <div className="relative category-dropdown-container">
                <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap text-xs font-semibold sm:gap-5 sm:text-sm">
                  <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-white" />
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    aria-expanded={showCategoryDropdown}
                    aria-label="Добавить категорию"
                    className="py-1 text-gray-200 transition-colors hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    Категория
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationDialog(true)}
                    aria-label="Добавить локацию"
                    className="py-1 text-gray-200 transition-colors hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    Локация
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateExtraServiceCategory}
                    aria-label="Добавить дополнительную услугу"
                    className="py-1 text-gray-200 transition-colors hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    Доп. услуга
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(true)}
                    aria-label="Добавить из шаблона"
                    className="py-1 text-gray-200 transition-colors hover:text-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    Шаблон
                  </button>
                </div>

                {categoryMenu}

              </div>
            </div>

            {/* Budget list */}
            <div
              ref={budgetListRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0 custom-scrollbar"
            >
              {budgetItems.length === 0 && activeCategoryIds.size === 0 && locations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                  <Package className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Смета пуста. Начните с добавления категорий или оборудования.</p>
                </div>
              ) : (
                <>
                  {locations.map((location) => {
                    const locationGroupId = `location:${location.id}`;

                    return (
                      <div
                        key={location.id}
                        data-budget-drop-group={JSON.stringify({ type: 'location', id: location.id, locationId: location.id })}
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
                                    onDuplicateCategory={handleDuplicateCategory}
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

                  <div
                    data-budget-drop-group={JSON.stringify({ type: 'uncategorized', id: NO_LOCATION_GROUP_ID, locationId: null })}
                    className={'rounded-xl transition-all duration-200' + (draggedItem ? ' ring-2 ring-cyan-500/50 bg-cyan-500/5' : '')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverTarget(NO_LOCATION_GROUP_ID);
                      setDragOverItemId(null);
                    }}
                    onDrop={(e) => handleDrop(e, { type: 'uncategorized', id: NO_LOCATION_GROUP_ID, locationId: null })}
                  >
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
                          onDuplicateCategory={handleDuplicateCategory}
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
                  </div>


                </>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className={`${mobileTab === 'equipment' || mobileTab === 'personnel' ? 'flex' : 'hidden'} w-full min-w-0 flex-col md:flex md:w-2/5 md:bg-gray-900/30`}>
            <div className="p-3 border-b border-gray-800 space-y-2 flex-shrink-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                ref={catalogSearchRef}
                aria-label="Поиск позиций для добавления в смету"
                placeholder="Поиск по названию или категории..."
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
              />
              <div className="hidden bg-gray-800 p-0.5 rounded-lg md:flex">
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

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-3 pb-3 md:px-0 md:pb-0">
              <button type="button" aria-expanded={mobileCatalogExpanded} onClick={() => setMobileCatalogExpanded(!mobileCatalogExpanded)} className="mb-3 flex min-h-12 w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-400/10 px-3 text-left text-sm font-bold uppercase text-gray-200 md:hidden">
                <ChevronDown className={`h-4 w-4 text-amber-300 transition-transform ${mobileCatalogExpanded ? '' : '-rotate-90'}`} />
                {selectedItemType === 'Оборудование' ? 'Склад' : 'Персонал и доставка'}
                <span className="rounded-full bg-gray-700/70 px-2 text-xs text-gray-400">{selectedItemType === 'Оборудование' ? filteredEquipment.length : filteredWorkItems.length}</span>
              </button>
              <div className={`${mobileCatalogExpanded ? '' : 'hidden'} md:block`}>
              {(selectedItemType === 'Оборудование' ? filteredEquipment : filteredWorkItems).length === 0 && <p className="px-3 py-8 text-center text-sm text-gray-500">Позиции не найдены. Попробуйте изменить поиск.</p>}
              {selectedItemType === 'Оборудование' ? (
                <div className="space-y-3 md:space-y-0 md:divide-y md:divide-gray-800">
                  {filteredEquipment.map(item => (
                    <React.Fragment key={item.id}>
                    <div
                      onClick={() => handleEquipmentClick(item)}
                      onContextMenu={event => { event.preventDefault(); setQuantityTarget(`equipment:${item.id}`); }}
                      className="group flex min-h-20 items-center justify-between rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-4 transition-colors hover:bg-cyan-500/5 md:min-h-0 md:rounded-none md:border-0 md:bg-transparent md:py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-gray-200 break-words group-hover:text-white md:truncate md:text-xs md:font-medium">{item.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <div className="text-right">
                          <p className="text-xs font-mono text-cyan-500 font-bold">${item.rental_price}</p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors group-hover:bg-cyan-600 group-hover:text-white md:h-auto md:w-auto md:p-1 md:text-gray-500">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                    {quantityTarget === `equipment:${item.id}` && <InlineQuantityAdd key={`equipment:${item.id}`} name={item.name} onAdd={quantity => handleAddItem(item, quantity)} onClose={() => setQuantityTarget(current => current === `equipment:${item.id}` ? null : current)} />}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 md:space-y-0 md:divide-y md:divide-gray-800">
                  {filteredWorkItems.map(item => (
                    <React.Fragment key={item.id}>
                    <div
                      onClick={() => handleAddWorkItem(item)}
                      onContextMenu={event => { event.preventDefault(); setQuantityTarget(`work:${item.id}`); }}
                      className="group flex min-h-20 items-center justify-between rounded-xl border border-gray-800 bg-gray-900/60 px-3 py-4 transition-colors hover:bg-cyan-500/5 md:min-h-0 md:rounded-none md:border-0 md:bg-transparent md:py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-200 break-words group-hover:text-white md:truncate md:text-xs md:font-medium">{item.name}</p>
                        <p className="mt-1 text-sm text-gray-500 md:mt-0 md:text-[10px]">Ед. измерения: {item.unit}</p>
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors group-hover:bg-cyan-600 group-hover:text-white md:h-auto md:w-auto md:p-1 md:text-gray-500">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    {quantityTarget === `work:${item.id}` && <InlineQuantityAdd key={`work:${item.id}`} name={item.name} onAdd={quantity => handleAddWorkItem(item, undefined, quantity)} onClose={() => setQuantityTarget(current => current === `work:${item.id}` ? null : current)} />}
                    </React.Fragment>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {(mobileTab === 'equipment' || mobileTab === 'personnel') && <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div><p className="text-xs text-gray-400">Итого</p><p className="font-semibold text-white">{getPrimaryTotalForMode().toLocaleString()} {getCurrencyLabel()}</p></div>
          <button type="button" onClick={() => changeMobileTab('estimate')} className="min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white">К смете · {budgetItems.length}</button>
        </div>}

        {/* Footer */}
        <div className={`${mobileTab === 'total' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-gray-800 bg-gray-900 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:flex md:flex-none md:shrink-0 md:max-h-none md:pb-3 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex min-w-0 flex-col items-start gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Итоговая сумма</span>
              <span className="text-xl font-black text-white">
                <span className="text-cyan-400">{getPrimaryTotalForMode().toLocaleString()}</span>
                <span className="text-xs font-normal text-gray-400 ml-1">{getCurrencyLabel()}</span>
              </span>
              {budgetTotalsMode === 'day1_plus_combined' && (
                <span className="text-[11px] text-gray-400">
                  {budgetDays === 1 ? 'ИТОГО' : 'Итого за 1 день:'} <span className="text-cyan-300">{normalizeGrandTotalForPaymentMode(getDay1TotalForPaymentMode()).toLocaleString()}</span> {getCurrencyLabel()}
                </span>
              )}
              {budgetDays > 1 && (
                <span className="text-[11px] text-gray-400">
                  Итого за {budgetDays} дней: <span className="text-cyan-300">{normalizeGrandTotalForPaymentMode(getCombinedTotalForPaymentMode()).toLocaleString()}</span> {getCurrencyLabel()}
                </span>
              )}
              <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
                <input
                  type="checkbox"
                  checked={showExtraTotal}
                  onChange={(e) => setShowExtraTotal(e.target.checked)}
                  className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                />
                <span className="text-[11px] text-gray-400 font-medium">Итого с дополнительными услугами</span>
              </label>
              {showExtraTotal && budgetTotalsMode === 'combined_only' && (
                <>
                  <span className="text-sm font-bold text-violet-400">
                    {getTotalWithExtraCombined().toLocaleString()} {getCurrencyLabel()}
                  </span>
                  {getDiscountedTotalWithExtraCombined() !== null && (
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mt-0.5">
                      Итого со скидкой {activeDiscountPercentLabel}: {getDiscountedTotalWithExtraCombined()!.toLocaleString()} {getCurrencyLabel()}
                    </span>
                  )}
                </>
              )}
              {showExtraTotal && budgetTotalsMode === 'day1_plus_combined' && budgetDays === 1 && (
                <>
                  <span className="text-sm font-bold text-violet-400">
                    {getTotalWithExtraDay1().toLocaleString()} {getCurrencyLabel()}
                  </span>
                  {getDiscountedTotalWithExtraDay1() !== null && (
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest mt-0.5">
                      Итого со скидкой {activeDiscountPercentLabel}: {getDiscountedTotalWithExtraDay1()!.toLocaleString()} {getCurrencyLabel()}
                    </span>
                  )}
                </>
              )}
              {showExtraTotal && budgetTotalsMode === 'day1_plus_combined' && budgetDays > 1 && (
                <>
                  <span className="text-[11px] text-gray-400">
                    Итого с доп. услугами за {budgetDays} дн.: <span className="text-violet-300">{getTotalWithExtraCombined().toLocaleString()}</span> {getCurrencyLabel()}
                  </span>
                  {getDiscountedTotalWithExtraCombined() !== null && (
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest -mt-1">
                      Итого со скидкой {activeDiscountPercentLabel} ({budgetDays} дн.): {getDiscountedTotalWithExtraCombined()!.toLocaleString()} {getCurrencyLabel()}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex w-full flex-wrap items-start gap-4 md:w-auto md:gap-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={discountEnabled}
                      onChange={(e) => {
                        setDiscountEnabled(e.target.checked);
                        // Скидка организатора остаётся активной независимо от скидки клиенту:
                        // без скидки клиенту она считается от сметы, со скидкой клиенту —
                        // от скидки клиента (зависимость описана в расчётах выше).
                      }}
                      className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-300 font-medium">Скидка клиенту</span>
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
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={discount2Enabled}
                      onChange={(e) => setDiscount2Enabled(e.target.checked)}
                      className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-300 font-medium">Скидка организатору</span>
                    {discount2Enabled && (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={discount2PercentInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDiscount2PercentInput(raw);
                            const parsed = parseFloat(raw);
                            if (!isNaN(parsed)) {
                              setDiscount2Percent(Math.min(100, Math.max(0, parsed)));
                            }
                          }}
                          onBlur={() => {
                            const parsed = parseFloat(discount2PercentInput);
                            if (isNaN(parsed) || discount2PercentInput.trim() === '') {
                              setDiscount2Percent(0);
                              setDiscount2PercentInput('0');
                            } else {
                              const clamped = Math.min(100, Math.max(0, parsed));
                              setDiscount2Percent(clamped);
                              setDiscount2PercentInput(String(clamped));
                            }
                          }}
                          className="w-14 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none text-center"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    )}
                  </label>
                </div>
                {/* Зависимость скидки организатора описана в коде (без режимов выбора):
                    - скидка клиенту НЕ активна -> скидка организатору считается от сметы;
                    - скидка клиенту активна   -> скидка организатору считается от скидки клиента. */}
                {getDiscountedTotal() !== null && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">{footerDiscountLabel}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={discountedTotalInput}
                        onChange={(e) => setDiscountedTotalInput(e.target.value)}
                        onBlur={applyDiscountedTotalInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className="w-28 px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-sm font-black text-green-400 focus:ring-1 focus:ring-cyan-500 outline-none text-right"
                      />
                      <span className="text-xs font-normal text-gray-400 ml-1">{getCurrencyLabel()}</span>
                    </div>
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
                      const next = parseInt(e.target.value, 10);
                      if (Number.isFinite(next) && next >= 1) setBudgetDays(next);
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

          <div className="order-first flex items-center gap-2 flex-wrap md:order-none lg:flex-nowrap lg:justify-end">
            <button
              onClick={() => handleExportPDF()}
              disabled={generatingPDF || budgetItems.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-all disabled:opacity-30 border border-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">PDF</span>
            </button>

          </div>
        </div>
      </div>

      {/* Modals */}
      {showMobileSettings && <MobileBudgetSettings onClose={() => setShowMobileSettings(false)}>
        <label className="block text-sm font-medium text-gray-300">Версия сметы
          <input type="text" value={budgetVersion} onChange={event => setBudgetVersion(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 text-base text-white" />
        </label>
        {currencySettings}
        <div className="flex flex-wrap gap-3 border-t border-gray-800 pt-4">
          <button type="button" onClick={() => { setShowMobileSettings(false); setShowBudgetNoteDialog(true); }} className="min-h-11 rounded-lg bg-gray-800 px-3 text-sm">Примечание</button>
          <button type="button" onClick={() => { setShowMobileSettings(false); setShowStickyNotes(true); }} className="min-h-11 rounded-lg bg-gray-800 px-3 text-sm">Заметки</button>
        </div>
      </MobileBudgetSettings>}

      {showBudgetNoteDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[70] p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setShowBudgetNoteDialog(false)}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Примечание к смете</h3>
              <button
                onClick={() => setShowBudgetNoteDialog(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={budgetNote}
                onChange={(e) => setBudgetNote(e.target.value)}
                placeholder="Введите примечание, которое будет выведено внизу сметы"
                className="w-full min-h-[260px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-y"
              />
            </div>

            <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setShowBudgetNoteDialog(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

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
          budgetId={budgetId}
          eventId={eventId}
          onClose={() => setShowTemplates(false)}
          onApply={() => { setShowTemplates(false); loadData(); }}
        />
      )}

      {showWarehouseSpec && (
        <WarehouseSpecification
          budgetId={budgetId}
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

      {showPodiumStairDialog && selectedPodiumStairEquipment && (
        <PodiumStairDialog
          equipment={selectedPodiumStairEquipment}
          isOpen={showPodiumStairDialog}
          onClose={() => {
            setShowPodiumStairDialog(false);
            setSelectedPodiumStairEquipment(null);
          }}
          onConfirm={handlePodiumStairConfirm}
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

      <StickyNotePanel
        notes={stickyNotes}
        onNotesChange={handleStickyNotesChange}
        onClose={() => setShowStickyNotes(false)}
        isOpen={showStickyNotes}
        storageKey={`budget_sticky_notes_${budgetId}`}
      />
      <ContractDialog
        isOpen={showContractDialog}
        clients={clientsList}
        initialOrganizationId={contractOrganizationId}
        onClose={() => setShowContractDialog(false)}
        onConfirm={handleContractConfirm}
      />
    </main>
  );
}


