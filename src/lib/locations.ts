import { supabase } from './supabase';

export interface Location {
  id: string;
  event_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getLocationsForEvent(eventId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLocation(eventId: string, name: string, color: string = '#6B7280'): Promise<Location> {
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
