import { withBudgetUnits } from './specificationUnits';
import { cableDisplayName } from './cableNames';
import { budgetSpecificationPreview, specificationIsEditable } from './specificationServices';
import { getBudgetItems, type BudgetItem } from './events';
import { getBudgetEvent } from './eventBudgets';
import { getEquipmentCompositions, type EquipmentComposition } from './equipmentCompositions';
import { getModificationComponents, type ModificationComponent } from './equipment';
import { getCategories, getCategoriesForEvent } from './categories';
import { getLocationsForEvent } from './locations';
import { ensureWarehouseSpecificationSnapshot, getSpecificationBudgetItems, getCables, getConnectors, getOtherItems } from './warehouseSpecification';

export interface SpecificationRow {
  group: string; name: string; sku: string; quantity: number; unit: string; notes: string;
}
export function buildSpecificationEquipmentRows(items: BudgetItem[], compositions: Map<string, EquipmentComposition[]>, modifications: Map<string, ModificationComponent[]>, categoryNames: Map<string, string>, locationNames: Map<string, string>, extraCategoryIds = new Set<string>()): SpecificationRow[] {
  const excluded = new Set(items.flatMap(item => item.excluded_child_keys || []));
  const rows: SpecificationRow[] = [];
  const add = (item: BudgetItem, key: string, name: string, sku: string, quantity: number, category: string, parent?: BudgetItem, unit = 'шт.') => {
    if (excluded.has(key) || quantity <= 0) return;
    const locationId = item.location_id || parent?.location_id;
    const location = (locationId && locationNames.get(locationId)) || item.location?.name || parent?.location?.name || 'Без локации';
    const categoryId = item.category_id || parent?.category_id;
    rows.push({ group: `${(item.is_extra && !item.source_budget_item_id) || (parent?.is_extra && !parent.source_budget_item_id) ? 'Добор' : 'Оборудование'} / ${location} / ${(categoryId && categoryNames.get(categoryId)) || category || 'Прочее'}`, name, sku, quantity, unit, notes: item.notes || '' });
  };
  for (const item of items) {
    if (item.item_type === 'work') {
      if (item.quantity > 0 && item.category_id && extraCategoryIds.has(item.category_id)) { const before = rows.length; add(item, item.id, item.name || item.work_item?.name || 'Позиция', '', item.quantity, categoryNames.get(item.category_id) || 'Прочее'); rows.length > before && (rows[rows.length - 1].unit = item.unit || item.work_item?.unit || 'усл.'); }
      continue;
    }
    const parent = item.parent_budget_item_id ? items.find(row => row.id === item.parent_budget_item_id) : undefined;
    if (item.parent_budget_item_id) { add(item, item.id, item.name || 'Кейс', item.sku || '', item.quantity, parent?.equipment?.category || 'Видео', parent); continue; }
    const name = item.equipment?.name || item.name || 'Без названия';
    const lower = name.toLowerCase();
    const fixedVirtual = ['светодиодный экран','сценический подиум','ступенька из сценических подиумов','тотем'].some(value => lower.includes(value)) || /п-образная (фермовая )?конструкция/.test(lower);
    if (item.equipment?.object_type === 'virtual' && !fixedVirtual) {
      const parts = item.equipment_id ? compositions.get(item.equipment_id) || [] : [];
      const mods = item.modification_id ? modifications.get(item.modification_id) || [] : [];
      if (parts.length || mods.length) {
        for (const part of parts) add(item, `${item.id}-comp-${part.id}${part.child_id ? `-${part.child_id}` : ''}`, part.child_name || 'Без названия', part.child_sku || '', item.quantity * part.quantity, part.child_category, undefined, part.child_unit || 'шт.');
        for (const part of mods) add(item, `${item.id}-mod-${part.id}${part.component_equipment_id ? `-${part.component_equipment_id}` : ''}`, part.component?.name || 'Без названия', part.component?.sku || '', item.quantity * part.quantity, part.component?.category || 'Прочее', undefined, part.component?.unit || 'шт.');
        continue;
      }
    }
    const podium = lower.includes('сценический подиум') || lower.includes('ступенька из сценических подиумов');
    add(item, item.id, podium ? item.name || name : name, item.equipment?.sku || item.sku || '', item.quantity, item.equipment?.category || 'Прочее', undefined, item.unit || item.equipment?.unit || 'шт.');
  }
  return rows;
}

export async function loadSpecificationExport(eventId: string, budgetId: string, initialize: boolean) {
  const currentEvent = await getBudgetEvent(eventId, budgetId);
  const frozen = specificationIsEditable(currentEvent.status);
  if (initialize && frozen) await ensureWarehouseSpecificationSnapshot(eventId, budgetId);
  const [event, savedItems, cables, connectors, others, globalCategories, categories, locations, liveItems] = await Promise.all([
    getBudgetEvent(eventId, budgetId), getSpecificationBudgetItems(eventId, budgetId), getCables(eventId, budgetId), getConnectors(eventId, budgetId), getOtherItems(eventId, budgetId), getCategories(), getCategoriesForEvent(eventId, budgetId), getLocationsForEvent(eventId, budgetId), getBudgetItems(eventId, budgetId)
  ]);
  const items = withBudgetUnits(frozen ? savedItems : budgetSpecificationPreview(liveItems), liveItems);
  const equipmentIds = [...new Set(items.filter(item => !item.parent_budget_item_id && item.equipment?.object_type === 'virtual' && item.equipment_id).map(item => item.equipment_id!))];
  const modificationIds = [...new Set(items.flatMap(item => item.modification_id ? [item.modification_id] : []))];
  const [compositionEntries, modificationEntries] = await Promise.all([
    Promise.all(equipmentIds.map(async id => [id, await getEquipmentCompositions(id)] as const)),
    Promise.all(modificationIds.map(async id => [id, await getModificationComponents(id)] as const))
  ]);
  const rows = buildSpecificationEquipmentRows(items, new Map(compositionEntries), new Map(modificationEntries), new Map([...globalCategories, ...categories].map(row => [row.id, row.name])), new Map(locations.map(row => [row.id, row.name])), new Set([...globalCategories, ...categories].filter(row => row.description === '__extra_service__').map(row => row.id)));

  const accessories = new Map<string, SpecificationRow>();
  const add = (group: string, name: string, quantity: number, notes: string) => {
    if (quantity <= 0) return;
    const key = JSON.stringify([group, name]); const previous = accessories.get(key);
    if (previous) { previous.quantity += quantity; if (notes && !previous.notes.split('\n').includes(notes)) previous.notes = [previous.notes, notes].filter(Boolean).join('\n'); }
    else accessories.set(key, { group, name, quantity, notes, unit: 'шт.', sku: '' });
  };
  cables.forEach(row => add(`Кабели / ${cableDisplayName(row.cable_type)}`, row.cable_length, row.quantity, row.notes));
  connectors.forEach(row => {
    const [category, ...legacyName] = row.connector_type.split('::');
    add(`Коннекторы / ${category}`, row.connector_item || legacyName.join('::') || row.connector_type, row.quantity, row.notes);
  });
  others.forEach(row => add(`Прочее / ${row.category}`, row.item_type, row.quantity, row.notes));
  return { event, rows: [...rows, ...accessories.values()] };
}
