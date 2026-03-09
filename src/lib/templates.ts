import { supabase } from './supabase';
import { EquipmentItem } from './equipment';
import { createBudgetItem } from './events';
import { createCategory, updateCategory } from './categories';

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  equipment_id: string;
  quantity: number;
  price: number;
  exchange_rate: number;
  sort_order: number;
  created_at: string;
  equipment_items?: EquipmentItem;
}

export interface TemplateWithItems extends Template {
  items: TemplateItem[];
}

export async function getTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getTemplateById(id: string): Promise<TemplateWithItems> {
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (templateError) throw templateError;
  if (!template) throw new Error('Template not found');

  const { data: items, error: itemsError } = await supabase
    .from('template_items')
    .select('*, equipment_items(*)')
    .eq('template_id', id)
    .order('sort_order');

  if (itemsError) throw itemsError;

  return {
    ...template,
    items: items || []
  };
}

export async function createTemplate(name: string, description: string = ''): Promise<Template> {
  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      description,
      user_id: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, name: string, description: string): Promise<Template> {
  const { data, error } = await supabase
    .from('templates')
    .update({
      name,
      description,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function addTemplateItem(
  templateId: string,
  equipmentId: string,
  quantity: number,
  price: number = 0,
  exchange_rate: number = 1
): Promise<TemplateItem> {
  const { data: lastItem } = await supabase
    .from('template_items')
    .select('sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastItem?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from('template_items')
    .insert({
      template_id: templateId,
      equipment_id: equipmentId,
      quantity,
      price,
      exchange_rate,
      sort_order: sortOrder
    })
    .select('*, equipment_items(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateTemplateItem(
  itemId: string,
  quantity: number,
  price?: number
): Promise<TemplateItem> {
  const updates: any = { quantity };
  if (price !== undefined) updates.price = price;

  const { data, error } = await supabase
    .from('template_items')
    .update(updates)
    .eq('id', itemId)
    .select('*, equipment_items(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function removeTemplateItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('template_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

export async function reorderTemplateItems(
  _templateId: string,
  items: Array<{ id: string; sort_order: number }>
): Promise<void> {
  const updates = items.map(item =>
    supabase
      .from('template_items')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);
  const error = results.find(r => r.error)?.error;
  if (error) throw error;
}

export async function applyTemplateToEvent(
  templateId: string,
  eventId: string,
  categoryName?: string
): Promise<void> {
  try {
    const template = await getTemplateById(templateId);

    const category = await createCategory(
      categoryName || template.name,
      undefined,
      true
    );

    if (!category.is_template) {
      await updateCategory(category.id, { is_template: true });
    }

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i];
      if (!item.equipment_items) continue;

      const price = item.price || item.equipment_items.rental_price || 0;
      const total = price * item.quantity;

      await createBudgetItem({
        event_id: eventId,
        equipment_id: item.equipment_id,
        item_type: 'equipment',
        quantity: item.quantity,
        price,
        total,
        exchange_rate: 1,
        category_id: category.id,
        notes: '',
        sort_order: i
      });
    }
  } catch (error) {
    console.error('Error applying template:', error);
    throw error;
  }
}
