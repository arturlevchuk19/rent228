import { supabase } from './supabase';

export interface Payment {
  id: string;
  personnel_id: string;
  event_id: string | null;
  budget_item_id: string | null;
  work_item_id: string | null;
  month: string;
  amount: number;
  status: 'Запланировано' | 'Выплачено' | 'Просрочено';
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  personnel: {
    id: string;
    full_name: string;
    salary: number;
    rate_percentage: number;
  };
  event: {
    id: string;
    name: string;
  } | null;
  work_item: {
    id: string;
    name: string;
  } | null;
  budget_item: {
    id: string;
    notes: string;
  } | null;
}

export async function getPaymentsByMonth(month: string): Promise<PaymentWithDetails[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      personnel:personnel_id (
        id,
        full_name,
        salary,
        rate_percentage
      ),
      event:event_id (
        id,
        name
      ),
      work_item:work_item_id (
        id,
        name
      ),
      budget_item:budget_item_id (
        id,
        notes
      )
    `)
    .eq('month', month)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }

  return data as PaymentWithDetails[];
}

export async function getPaymentsByPersonnel(personnelId: string): Promise<PaymentWithDetails[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      personnel:personnel_id (
        id,
        full_name,
        salary,
        rate_percentage
      ),
      event:event_id (
        id,
        name
      ),
      work_item:work_item_id (
        id,
        name
      ),
      budget_item:budget_item_id (
        id,
        notes
      )
    `)
    .eq('personnel_id', personnelId)
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching payments by personnel:', error);
    throw error;
  }

  return data as PaymentWithDetails[];
}

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();

  if (error) {
    console.error('Error creating payment:', error);
    throw error;
  }

  return data as Payment;
}

export async function updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating payment:', error);
    throw error;
  }

  return data as Payment;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting payment:', error);
    throw error;
  }
}

export async function getMonthsWithPayments(): Promise<string[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('month')
    .order('month', { ascending: false });

  if (error) {
    console.error('Error fetching months:', error);
    throw error;
  }

  const uniqueMonths = [...new Set(data.map(p => p.month))];
  return uniqueMonths;
}

export function formatMonth(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
}

export function getFirstDayOfMonth(year: number, month: number): string {
  const date = new Date(year, month, 1);
  const day = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${day}`;
}
