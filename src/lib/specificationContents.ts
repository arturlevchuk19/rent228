import { supabase } from './supabase';
import type { BudgetItem } from './events';
import { getEquipmentCompositions } from './equipmentCompositions';
import { getModificationComponents } from './equipment';

export interface ContentPart { key: string; quantity: number; name: string; }
export type SpecificationContents = Map<string, ContentPart[]>;
export const contentRowKey = (side: 'budget' | 'specification', id: string) => `${side}:${id}`;

// Older case replacements stored SKU/name rather than equipment_id. Resolve only
// an exact unique identity; ambiguous names never count as matching equipment.
export async function loadSpecificationContents(budget: BudgetItem[], specification: BudgetItem[]): Promise<SpecificationContents> {
  const all = [...budget, ...specification];
  const unidentified = all.filter(row => row.item_type === 'equipment' && !row.equipment_id);
  const skus = [...new Set(unidentified.flatMap(row => row.sku ? [row.sku] : []))];
  const names = [...new Set(unidentified.flatMap(row => !row.sku && row.name ? [row.name] : []))];
  const lookups = await Promise.all([
    skus.length ? supabase.from('equipment_items').select('id,sku,name,has_composition').in('sku', skus) : Promise.resolve({ data: [], error: null }),
    names.length ? supabase.from('equipment_items').select('id,sku,name,has_composition').in('name', names) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of lookups) if (result.error) throw result.error;
  const inventory = lookups.flatMap(result => result.data || []);
  const identify = (row: BudgetItem) => {
    if (row.equipment_id) return row.equipment_id;
    const matches = inventory.filter(item => row.sku ? item.sku === row.sku : item.name === row.name);
    const ids = [...new Set(matches.map(item => item.id))];
    return ids.length === 1 ? ids[0] : undefined;
  };
  const compositions = new Map<string, Awaited<ReturnType<typeof getEquipmentCompositions>>>();
  for (const row of all) if (row.equipment_id && row.equipment?.has_composition === false) compositions.set(row.equipment_id, []);
  for (const row of inventory) if (row.has_composition === false) compositions.set(row.id, []);
  let next = [...new Set(all.map(identify).filter((id): id is string => !!id))];
  while (next.length) {
    const batch = next.filter(id => !compositions.has(id));
    if (!batch.length) break;
    const loaded = await Promise.all(batch.map(async id => [id, await getEquipmentCompositions(id)] as const));
    loaded.forEach(([id, rows]) => compositions.set(id, rows));
    next = [...new Set(loaded.flatMap(([, rows]) => rows.flatMap(row => row.child_id ? [row.child_id] : [])))];
  }
  const mods = new Map(await Promise.all([...new Set(all.flatMap(row => row.modification_id ? [row.modification_id] : []))].map(async id => [id, await getModificationComponents(id)] as const)));
  // Modification components may themselves contain nested equipment.
  next = [...new Set([...mods.values()].flatMap(rows => rows.flatMap(row => row.component_equipment_id ? [row.component_equipment_id] : [])))];
  while (next.length) {
    const batch = next.filter(id => !compositions.has(id));
    if (!batch.length) break;
    const loaded = await Promise.all(batch.map(async id => [id, await getEquipmentCompositions(id)] as const));
    loaded.forEach(([id, rows]) => compositions.set(id, rows));
    next = [...new Set(loaded.flatMap(([, rows]) => rows.flatMap(row => row.child_id ? [row.child_id] : [])))];
  }
  return buildSpecificationContents(budget, specification, compositions, mods, identify);
}

export function buildSpecificationContents(
  budget: BudgetItem[], specification: BudgetItem[],
  compositions: Map<string, Awaited<ReturnType<typeof getEquipmentCompositions>>>,
  modifications: Map<string, Awaited<ReturnType<typeof getModificationComponents>>>,
  identify: (row: BudgetItem) => string | undefined = row => row.equipment_id || undefined,
): SpecificationContents {
  const result: SpecificationContents = new Map();
  for (const [side, rows] of [['budget', budget], ['specification', specification]] as const) {
    for (const row of rows) {
      const parts: ContentPart[] = [];
      const location = row.location_id || rows.find(parent => parent.id === row.parent_budget_item_id)?.location_id || '';
      const add = (id: string, quantity: number, name: string) => { if (quantity > 0) parts.push({ key: JSON.stringify([location, row.item_type, id]), quantity, name }); };
      const excluded = new Set(row.excluded_child_keys || []);
      const expand = (id: string, quantity: number, name: string, path: Set<string>) => {
        const children = compositions.get(id) || [];
        if (!children.length || path.has(id)) { add(id, quantity, name); return; }
        const visited = new Set(path).add(id);
        for (const child of children) {
          if (excluded.has(`${row.id}-comp-${child.id}${child.child_id ? `-${child.child_id}` : ''}`)) continue;
          if (child.child_id) expand(child.child_id, quantity * child.quantity, child.child_name || name, visited);
        }
      };
      // Unlinked child cases are packaging already represented by the parent.
      if (!(side === 'specification' && row.parent_budget_item_id && !row.source_budget_item_id)) {
        if (row.item_type === 'work') add(row.work_item_id || `work:${row.id}`, row.quantity, row.work_item?.name || row.name || 'Работа');
        else {
          const id = identify(row);
          const modification = row.modification_id ? modifications.get(row.modification_id) || [] : [];
          if (id && (compositions.get(id)?.length || !modification.length)) expand(id, row.quantity, row.equipment?.name || row.name || 'Оборудование', new Set());
          else if (!id) add(`unknown:${side}:${row.id}`, row.quantity, row.name || 'Неизвестный комплект');
          for (const child of modification) if (child.component_equipment_id && !excluded.has(`${row.id}-mod-${child.id}-${child.component_equipment_id}`)) expand(child.component_equipment_id, row.quantity * child.quantity, child.component?.name || 'Компонент', new Set());
        }
      }
      result.set(contentRowKey(side, row.id), parts);
    }
  }
  return result;
}
