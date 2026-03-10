import { supabase } from './supabase';

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  is_template?: boolean;
  created_at: string;
  updated_at: string;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCategory(name: string, description?: string, isTemplate: boolean = false): Promise<Category> {
  if (!isTemplate) {
    const { data: existing } = await supabase
      .from('categories')
      .select('*')
      .eq('name', name)
      .eq('is_template', false)
      .maybeSingle();

    if (existing) {
      return existing;
    }
  }

  const { data: lastCategory } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastCategory?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from('categories')
    .insert({ name, description: description || '', sort_order: sortOrder, is_template: isTemplate })
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
