import { supabase } from './supabase';

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  distance_km: number;
  contact: string;
  capacity: number;
  description: string;
  notes: string;
  created_at: string;
}

export interface Client {
  id: string;
  organization: string;
  full_name: string;
  position: string;
  phone: string;
  email: string;
  notes: string;
  created_at: string;
}

export interface Organizer {
  id: string;
  full_name: string;
  position: string;
  phone: string;
  email: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  event_date: string;
  venue_id: string | null;
  event_type: string;
  client_id: string | null;
  budget: string;
  specification: string;
  status: string;
  organizer_id: string | null;
  progress_budget_done: boolean;
  progress_equipment_reserved: boolean;
  progress_project_completed: boolean;
  progress_paid: boolean;
  name: string;
  notes: string;
  created_at: string;
  specification_confirmed?: boolean;
  specification_confirmed_at?: string;
  specification_confirmed_by?: string;
  equipment_shipped?: boolean;
  equipment_shipped_at?: string;
  equipment_returned?: boolean;
  equipment_returned_at?: string;
  discount_enabled?: boolean;
  discount_percent?: number;
  venues?: Venue;
  clients?: Client;
  organizers?: Organizer;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  type: string;
  subtype: string;
  note: string;
  attribute: string;
  sku: string;
  quantity: number;
  rental_price: number;
  power: string;
  object_type: 'physical' | 'virtual';
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

export interface BudgetItem {
  id: string;
  event_id: string;
  equipment_id?: string | null;
  work_item_id?: string | null;
  modification_id?: string | null;
  parent_budget_item_id?: string | null;
  item_type: 'equipment' | 'work';
  quantity: number;
  price: number;
  total: number;
  notes: string;
  exchange_rate: number;
  category_id?: string | null;
  location_id?: string | null;
  sort_order: number;
  picked: boolean;
  is_extra?: boolean;
  return_picked?: boolean;
  created_at: string;
  updated_at: string;
  name?: string;
  sku?: string;
  equipment?: Equipment;
  work_item?: WorkItem;
  location?: {
    id: string;
    event_id: string;
    name: string;
    color: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  } | null;
}

export const EVENT_TYPES = [
  'Концерт',
  'Свадьба',
  'Семинар',
  'Выставка',
  'Встреча',
  'Фестиваль'
] as const;

export const EVENT_STATUSES = [
  'Запрос',
  'На рассмотрении',
  'Подтверждено'
] as const;

export async function getEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      venues (
        id,
        name,
        address,
        city
      ),
      clients (
        id,
        organization,
        full_name
      ),
      organizers (
        id,
        full_name
      )
    `)
    .order('event_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getEvent(id: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      venues (*),
      clients (*),
      organizers (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createEvent(event: Partial<Event>): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEvent(id: string, event: Partial<Event>): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update(event)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmSpecification(eventId: string, userId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update({
      specification_confirmed: true,
      specification_confirmed_at: new Date().toISOString(),
      specification_confirmed_by: userId
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmShipment(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update({
      equipment_shipped: true,
      equipment_shipped_at: new Date().toISOString()
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function confirmReturn(eventId: string): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .update({
      equipment_returned: true,
      equipment_returned_at: new Date().toISOString()
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createVenue(venue: Partial<Venue>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .insert(venue)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateVenue(id: string, venue: Partial<Venue>): Promise<Venue> {
  const { data, error } = await supabase
    .from('venues')
    .update(venue)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from('venues')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('organization');

  if (error) throw error;
  return data || [];
}

export async function createClient(client: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClient(id: string, client: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(client)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOrganizers(): Promise<Organizer[]> {
  const { data, error } = await supabase
    .from('organizers')
    .select('*')
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function createOrganizer(organizer: Partial<Organizer>): Promise<Organizer> {
  const { data, error } = await supabase
    .from('organizers')
    .insert({
      ...organizer,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrganizer(id: string, organizer: Partial<Organizer>): Promise<Organizer> {
  const { data, error } = await supabase
    .from('organizers')
    .update({
      ...organizer,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrganizer(id: string): Promise<void> {
  const { error } = await supabase
    .from('organizers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getBudgetItems(eventId: string): Promise<BudgetItem[]> {
  const { data, error } = await supabase
    .from('budget_items')
    .select(`
      *,
      equipment:equipment_items (*),
      work_item:work_items (*),
      location:locations (*)
    `)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createBudgetItem(item: Partial<BudgetItem>): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('budget_items')
    .insert(item)
    .select(`
      *,
      equipment:equipment_items (*),
      work_item:work_items (*),
      location:locations (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudgetItem(id: string, item: Partial<BudgetItem>): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('budget_items')
    .update(item)
    .eq('id', id)
    .select(`
      *,
      equipment:equipment_items (*),
      work_item:work_items (*),
      location:locations (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudgetItemPicked(id: string, picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('budget_items')
    .update({
      picked,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
}

export async function updateBudgetItemReturnPicked(id: string, return_picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('budget_items')
    .update({ return_picked, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('budget_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
