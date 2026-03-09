import { supabase } from './supabase';

export interface EquipmentComposition {
  id: string;
  parent_id: string;
  child_id: string;
  quantity: number;
  child_name: string;
  child_sku: string;
  child_category: string;
  child_type: string;
  child_object_type?: string;
  child_note: string;
  child_subtype: string;
  created_at: string;
}

export interface EquipmentModule {
  id: string;
  name: string;
  sku: string;
  category: string;
  type: string;
  subtype: string;
  note: string;
  object_type?: string;
  quantity?: number; // For existing compositions
}

export async function getEquipmentCompositions(parentId: string, filterForLedModules: boolean = false): Promise<EquipmentComposition[]> {
  const { data, error } = await supabase
    .from('equipment_compositions')
    .select(`
      id,
      parent_id,
      child_id,
      quantity,
      created_at,
      child:equipment_items!equipment_compositions_child_id_fkey (
        name,
        sku,
        category,
        type,
        object_type,
        note,
        subtype
      )
    `)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const compositions = (data || []).map(item => ({
    id: item.id,
    parent_id: item.parent_id,
    child_id: item.child_id,
    quantity: item.quantity,
    child_name: (item.child as any).name,
    child_sku: (item.child as any).sku,
    child_category: (item.child as any).category,
    child_type: (item.child as any).type,
    child_object_type: (item.child as any).object_type,
    child_note: (item.child as any).note,
    child_subtype: (item.child as any).subtype,
    created_at: item.created_at
  }));

  // Filter to only LED modules, excluding cases (only when explicitly requested)
  if (filterForLedModules) {
    return compositions.filter(comp => {
      return isLedModule({
        name: comp.child_name || '',
        note: comp.child_note || '',
        category: comp.child_category || '',
        subtype: comp.child_subtype || '',
        object_type: comp.child_object_type
      });
    });
  }

  return compositions;
}

export async function addEquipmentComposition(
  parentId: string,
  childId: string,
  quantity: number
): Promise<string> {
  const { data, error } = await supabase
    .from('equipment_compositions')
    .insert({
      parent_id: parentId,
      child_id: childId,
      quantity
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateEquipmentComposition(
  id: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase
    .from('equipment_compositions')
    .update({
      quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEquipmentComposition(id: string): Promise<void> {
  const { error } = await supabase
    .from('equipment_compositions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getLedModules(): Promise<EquipmentModule[]> {
  // Search for LED modules - look for "модуль" in name or note
  const { data, error } = await supabase
    .from('equipment_items')
    .select('id, name, sku, category, type, subtype, note, object_type')
    .or('name.ilike.%модуль%,note.ilike.%модуль%,category.eq.Видео')
    .order('name');

  if (error) throw error;

  // Filter to only LED modules and exclude cases
  return (data || []).map(item => ({
    id: item.id,
    name: item.name || '',
    sku: item.sku || '',
    category: item.category || '',
    type: item.type || '',
    subtype: item.subtype || '',
    note: item.note || '',
    object_type: item.object_type || 'virtual'
  })).filter(isLedModule);
}

/**
 * Helper function to determine if an item is an LED module (not a case).
 * Excludes cases (items with "кейс" in name) and includes LED panels/modules.
 */
export function isLedModule(item: { name: string; note: string; category: string; subtype?: string; object_type?: string }): boolean {
  const name = item.name.toLowerCase();
  const note = item.note?.toLowerCase() || '';
  const category = item.category?.toLowerCase() || '';
  const subtype = item.subtype?.toLowerCase() || '';

  // Exclude cases - items with "case" in name or note
  if (name.includes('case') || note.includes('case')) {
    return false;
  }

  // Include if it's a LED module or video equipment
  return name.includes('модуль') || 
         note.includes('модуль') ||
         name.includes('led') || 
         note.includes('led') ||
         name.includes('светодиод') ||
         note.includes('светодиод') ||
         category === 'видео' ||
         subtype.includes('модуль');
}

export async function getAvailableLedModules(screenType: 'P2.6' | 'P3.91'): Promise<EquipmentModule[]> {
  const allModules = await getLedModules();
  console.log('All LED modules found:', allModules.length, allModules);
  
  // For now, return all LED modules without filtering by type to ensure we find some
  // Filter by basic criteria like containing "модуль" and dimensions
  return allModules.filter(module => {
    const name = module.name.toLowerCase();
    const note = module.note.toLowerCase();
    
    // Check if it contains module dimensions (0,5x0,5, 0,5x1, etc.)
    const hasDimensions = name.match(/\d+[.,]?\d*[x×]\d+[.,]?\d+/) || note.match(/\d+[.,]?\d*[x×]\d+[.,]?\d+/);
    
    // Include if it's a module and has dimensions or doesn't explicitly mention incompatible screen type
    const isModule = name.includes('модуль') || note.includes('модуль');
    const isCompatible = !name.includes('p3,91') && !name.includes('p3.91') && !name.includes('p2,6') && !name.includes('p2.6') ||
                         (screenType === 'P2.6' && (name.includes('p2,6') || name.includes('p2.6'))) ||
                         (screenType === 'P3.91' && (name.includes('p3,91') || name.includes('p3.91')));
    
    return isModule && (hasDimensions || isCompatible);
  });
}

export interface ModuleCase {
  id: string;
  name: string;
  sku: string;
  category: string;
  type: string;
  moduleCapacity: number; // сколько модулей помещается в кейс
  moduleChildId: string; // ID модуля, который хранится в кейсе
}

export async function findCasesForModules(moduleIds: string[]): Promise<ModuleCase[]> {
  // Находим все кейсы (физические элементы), которые содержат указанные модули в своем составе
  const { data, error } = await supabase
    .from('equipment_compositions')
    .select(`
      id,
      parent_id,
      child_id,
      quantity,
      parent:equipment_items!equipment_compositions_parent_id_fkey (
        id,
        name,
        sku,
        category,
        type,
        object_type
      )
    `)
    .in('child_id', moduleIds);

  if (error) throw error;

  const cases: ModuleCase[] = [];
  
  for (const item of data || []) {
    const parent = (item.parent as any);
    // Фильтруем только физические элементы (кейсы)
    if (parent && parent.object_type === 'physical') {
      cases.push({
        id: parent.id,
        name: parent.name,
        sku: parent.sku,
        category: parent.category,
        type: parent.type,
        moduleCapacity: item.quantity,
        moduleChildId: item.child_id
      });
    }
  }

  return cases;
}
