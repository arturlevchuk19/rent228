import { supabase } from './supabase';

export interface EquipmentItem {
  id: string;
  category: string;
  type: string;
  subtype: string;
  name: string;
  note: string;
  attribute: string;
  sku: string;
  quantity: number;
  rental_price: number;
  power: string;
  object_type: 'physical' | 'virtual';
  rental_type: 'rental' | 'sublease';
  has_composition: boolean;
  created_at: string;
  updated_at: string;
}

export async function getEquipmentCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('equipment_items')
    .select('category')
    .order('category');

  if (error) throw error;
  const categories = [...new Set(data?.map(item => item.category).filter(Boolean))];
  return categories as string[];
}

export async function getEquipmentItems(): Promise<EquipmentItem[]> {
  const { data, error} = await supabase
    .from('equipment_items')
    .select('*')
    .order('category, type, name');

  if (error) throw error;
  return data || [];
}

export async function createEquipmentItem(item: Partial<EquipmentItem>): Promise<EquipmentItem> {
  const { data, error } = await supabase
    .from('equipment_items')
    .insert({
      ...item,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEquipmentItem(id: string, item: Partial<EquipmentItem>): Promise<EquipmentItem> {
  const { data, error } = await supabase
    .from('equipment_items')
    .update({
      ...item,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEquipmentItem(id: string): Promise<void> {
  // First check if equipment is referenced in budget_items
  const { data: budgetItems, error: budgetError } = await supabase
    .from('budget_items')
    .select('id')
    .eq('equipment_id', id)
    .limit(1);

  if (budgetError) throw budgetError;

  if (budgetItems && budgetItems.length > 0) {
    throw new Error('Нельзя удалить оборудование, которое используется в сметах. Сначала удалите или измените связанные позиции в сметах.');
  }

  // Check if equipment is referenced in template_items
  const { data: templateItems, error: templateError } = await supabase
    .from('template_items')
    .select('id')
    .eq('equipment_id', id)
    .limit(1);

  if (templateError) throw templateError;

  if (templateItems && templateItems.length > 0) {
    throw new Error('Нельзя удалить оборудование, которое используется в шаблонах. Сначала удалите или измените связанные позиции в шаблонах.');
  }

  // If no references found, proceed with deletion
  const { error } = await supabase
    .from('equipment_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export interface EquipmentModification {
  id: string;
  equipment_id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ModificationComponent {
  id: string;
  modification_id: string;
  component_equipment_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  component?: EquipmentItem;
}

export async function getEquipmentModifications(equipmentId: string): Promise<EquipmentModification[]> {
  const { data, error } = await supabase
    .from('equipment_modifications')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('sort_order, name');

  if (error) throw error;
  return data || [];
}

export async function getModificationComponents(modificationId: string): Promise<ModificationComponent[]> {
  const { data, error } = await supabase
    .from('modification_components')
    .select('*, component:equipment_items!component_equipment_id(*)')
    .eq('modification_id', modificationId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function createEquipmentModification(
  equipmentId: string,
  name: string,
  description: string = ''
): Promise<EquipmentModification> {
  const { data, error } = await supabase
    .from('equipment_modifications')
    .insert({
      equipment_id: equipmentId,
      name,
      description,
      sort_order: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addModificationComponent(
  modificationId: string,
  componentEquipmentId: string,
  quantity: number = 1
): Promise<ModificationComponent> {
  const { data, error } = await supabase
    .from('modification_components')
    .insert({
      modification_id: modificationId,
      component_equipment_id: componentEquipmentId,
      quantity
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeModificationComponent(componentId: string): Promise<void> {
  const { error } = await supabase
    .from('modification_components')
    .delete()
    .eq('id', componentId);

  if (error) throw error;
}

export async function deleteEquipmentModification(modificationId: string): Promise<void> {
  const { error } = await supabase
    .from('equipment_modifications')
    .delete()
    .eq('id', modificationId);

  if (error) throw error;
}

export async function importWorkItemsFromCSV(csvText: string): Promise<number> {
  const lines = csvText.split('\n');
  const items: Array<{ name: string; unit: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length < 2) continue;

    const name = parts[0] || '';
    const unit = parts[1] || 'шт';

    if (!name) continue;

    items.push({ name, unit });
  }

  if (items.length === 0) return 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Deduplicate items by name, keeping the last occurrence
  const uniqueItems = new Map<string, { name: string; unit: string }>();
  for (const item of items) {
    uniqueItems.set(item.name, item);
  }

  const itemsWithUser = Array.from(uniqueItems.values()).map(item => ({
    ...item,
    user_id: user.id
  }));

  const { error } = await supabase
    .from('work_items')
    .upsert(itemsWithUser, { onConflict: 'name,user_id', ignoreDuplicates: false });

  if (error) throw error;
  return itemsWithUser.length;
}

export async function importEquipmentFromCSV(csvText: string): Promise<number> {
  const lines = csvText.split('\n');
  const items: Partial<EquipmentItem>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    if (parts.length < 7) continue;

    const category = parts[0] || '';
    const type = parts[1] || '';
    const subtype = parts[2] || '';
    const name = parts[3] || '';
    const note = parts[4] || '';
    const attribute = parts[5] || '';
    const sku = parts[6] || '';
    const quantityStr = parts[7] || '0';
    const rentalPriceStr = parts[8] || '0';
    const power = parts[9] || '';

    if (!category || !type || !name || !sku) continue;

    const quantity = parseInt(quantityStr) || 0;
    const rental_price = parseFloat(rentalPriceStr.replace(',', '.')) || 0;

    items.push({
      category,
      type,
      subtype,
      name,
      note,
      attribute,
      sku,
      quantity,
      rental_price,
      power
    });
  }

  if (items.length === 0) return 0;

  const { error } = await supabase
    .from('equipment_items')
    .upsert(items, { onConflict: 'sku', ignoreDuplicates: false });

  if (error) throw error;
  return items.length;
}
