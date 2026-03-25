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

export async function getCategories(excludeTemplates: boolean = false): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (excludeTemplates) {
    query = query.or('is_template.is.null,is_template.eq.false');
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

export async function createCategory(name: string, description?: string, isTemplate: boolean = false): Promise<Category> {
  // First, check for existing category
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('name', name);

  if (existingCategories && existingCategories.length > 0) {
    // If the column exists, we match by isTemplate flag. 
    // If it doesn't exist, we just take the first match.
    const existing = existingCategories.find(c => !('is_template' in c) || c.is_template === isTemplate);
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

  const insertData: any = { 
    name, 
    description: description || '', 
    sort_order: sortOrder,
    is_template: isTemplate 
  };

  const { data, error } = await supabase
    .from('categories')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    // If the column doesn't exist (PGRST204 or 42703), retry without it
    if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('is_template')) {
      const { is_template, ...fallbackData } = insertData;
      const { data: retryData, error: retryError } = await supabase
        .from('categories')
        .insert(fallbackData)
        .select()
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  
  return data;
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // If the error is about is_template column, retry without it
    if (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('is_template')) {
      const { is_template, ...fallbackUpdates } = updates;
      const { data: retryData, error: retryError } = await supabase
        .from('categories')
        .update({ ...fallbackUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
