import { supabase } from './supabase';

export interface Personnel {
  id: string;
  user_id: string;
  full_name: string;
  salary: number;
  rate_percentage: number;
  drivers_license: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface WorkItem {
  id: string;
  user_id: string;
  name: string;
  unit: string;
  created_at: string;
}

export async function getPersonnel(): Promise<Personnel[]> {
  const { data, error } = await supabase
    .from('personnel')
    .select('*')
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function createPersonnel(personnel: Partial<Personnel>): Promise<Personnel> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('personnel')
    .insert({ ...personnel, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePersonnel(id: string, personnel: Partial<Personnel>): Promise<Personnel> {
  const { data, error } = await supabase
    .from('personnel')
    .update(personnel)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePersonnel(id: string): Promise<void> {
  const { error } = await supabase
    .from('personnel')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getWorkItems(): Promise<WorkItem[]> {
  const { data, error } = await supabase
    .from('work_items')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createWorkItem(workItem: Partial<WorkItem>): Promise<WorkItem> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('work_items')
    .insert({ ...workItem, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignPersonnelToBudgetItem(budgetItemId: string, personnelIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('budget_item_personnel')
    .delete()
    .eq('budget_item_id', budgetItemId);

  if (deleteError) throw deleteError;

  if (personnelIds.length > 0) {
    const { error: insertError } = await supabase
      .from('budget_item_personnel')
      .insert(
        personnelIds.map(personnelId => ({
          budget_item_id: budgetItemId,
          personnel_id: personnelId
        }))
      );

    if (insertError) throw insertError;
  }
}

export async function getBudgetItemPersonnel(budgetItemId: string): Promise<Personnel[]> {
  const { data, error } = await supabase
    .from('budget_item_personnel')
    .select(`
      personnel:personnel_id (*)
    `)
    .eq('budget_item_id', budgetItemId);

  if (error) throw error;
  return data?.map(item => item.personnel).filter(Boolean) as Personnel[] || [];
}
