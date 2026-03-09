import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'superuser' | 'admin' | 'clerk' | 'staff' | 'warehouse';
export type UserStatus = 'pending' | 'active' | 'inactive';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Equipment {
  id: string;
  category: string;
  type: string;
  subtype?: string;
  article: string;
  price_usd: number;
  power_consumption?: number;
  weight?: number;
  cost_price?: number;
  available_for_rent: boolean;
  description?: string;
  created_at: string;
}

export interface InventoryUnit {
  id: string;
  equipment_id: string;
  rfid_tag?: string;
  serial_number?: string;
  status: 'in_stock' | 'reserved' | 'rented' | 'maintenance' | 'retired';
  last_maintenance?: string;
  notes?: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city?: string;
  distance_km?: number;
  notes?: string;
  created_at: string;
}

export interface Car {
  id: string;
  brand: string;
  license_plate: string;
  rate_per_km_usd: number;
  status: 'active' | 'maintenance' | 'retired';
  created_at: string;
}

export interface Staff {
  id: string;
  user_id: string;
  employment_type: 'salary' | 'contract' | 'helper';
  monthly_salary_byn?: number;
  primary_role?: string;
  rate_per_km_byn?: number;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  client_id?: string;
  venue_id?: string;
  event_date: string;
  load_in_date?: string;
  load_out_date?: string;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  version: number;
  is_active: boolean;
  event_id?: string;
  calculation_type: 'dollars' | 'cash_byn' | 'cashless_byn';
  usd_rate?: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  total_usd: number;
  total_byn: number;
  created_by: string;
  created_at: string;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  item_type: 'equipment' | 'work' | 'delivery';
  equipment_id?: string;
  work_type?: string;
  car_id?: string;
  quantity: number;
  days: number;
  price_usd: number;
  distance_km?: number;
  total_usd: number;
  total_byn: number;
  created_at: string;
}

export interface WorkReport {
  id: string;
  event_id: string;
  estimate_id?: string;
  report_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'paid';
  notes?: string;
  created_at: string;
}

export interface WorkDistribution {
  id: string;
  work_report_id: string;
  estimate_item_id?: string;
  staff_id: string;
  share_percentage: number;
  payment_percentage: number;
  amount_byn: number;
  notes?: string;
  created_at: string;
}
