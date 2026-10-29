import { supabase } from './supabase';

export interface Location {
  budget_id?: string | null;
  id: string;
  event_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function isMissingLocationsTable(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return (error as { code?: string }).code === 'PGRST205';
}

export async function getLocationsForEvent(eventId: string, budgetId?: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('event_id', eventId)
    .or(budgetId ? `budget_id.eq.${budgetId}` : 'budget_id.is.null,budget_id.not.is.null')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error && isMissingLocationsTable(error)) {
    return [];
  }

  if (error) throw error;
  return data || [];
}

export async function createLocation(eventId: string, name: string, color: string = '#6B7280', budgetId?: string): Promise<Location> {
  const { data: lastLocation } = await supabase
    .from('locations')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastLocation?.sort_order || 0) + 1;

  const { data, error } = await supabase
    .from('locations')
    .insert({
      event_id: eventId,
      budget_id: budgetId,
      name,
      color,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLocation(id: string, updates: Partial<Location>): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
