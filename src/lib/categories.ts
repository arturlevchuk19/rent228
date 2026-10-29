import { supabase } from './supabase';

export interface Category {
  budget_id?: string | null;
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_template?: boolean;
  event_id?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('event_id', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function getCategoriesForEvent(eventId: string, budgetId?: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('event_id', eventId)
    .or(budgetId ? `budget_id.eq.${budgetId}` : 'budget_id.is.null,budget_id.not.is.null')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function createCategory(name: string, description?: string, isTemplate: boolean = false, eventId?: string, budgetId?: string): Promise<Category> {
  if (!eventId) {
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('*')
      .eq('name', name)
      .is('event_id', null);

    if (existingCategories && existingCategories.length > 0) {
      return existingCategories[0];
    }
  }

  const { data: lastCategory } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastCategory?.sort_order || 0) + 1;

  const insertData: Omit<Category, 'id' | 'created_at' | 'updated_at'> = {
    name,
    description: description || '',
    sort_order: sortOrder,
    is_template: isTemplate,
  };

  if (eventId) {
    insertData.event_id = eventId;
    if (budgetId) insertData.budget_id = budgetId;
  }

  const { data, error } = await supabase
    .from('categories')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
