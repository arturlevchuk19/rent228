import { supabase } from './supabase';

export interface Location {
  id: string;
  event_id: string;
  name: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLocationsForEvent(eventId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('event_id', eventId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createLocation(eventId: string, name: string, color?: string): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      event_id: eventId,
      name: name.trim(),
      color: color || '#1f2937'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
