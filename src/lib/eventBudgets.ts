import { supabase } from './supabase';
import { getEvent, updateEvent, type Event } from './events';

export interface EventBudget {
  id: string; event_id: string; name: string; is_primary: boolean;
  settings: Partial<Event>; specification_state: Partial<Event>; created_at: string;
}
const settingsKeys = ['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes'];
function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (['42P01','PGRST205','42703','PGRST204'].includes(error.code || '')) throw new Error('Для нескольких смет выполните миграцию 20261029020000_event_budgets.sql.');
  throw error;
}
export async function getEventBudgets(eventId: string): Promise<EventBudget[]> {
  const { data, error } = await supabase.from('event_budgets').select('*').eq('event_id', eventId).order('is_primary', { ascending: false }).order('created_at');
  check(error); return data || [];
}
export async function createEventBudget(eventId: string, name: string, primary = false): Promise<EventBudget> {
  const event = await getEvent(eventId);
  const settings = Object.fromEntries(settingsKeys.map(key => [key, event[key as keyof Event]]));
  const { data, error } = await supabase.from('event_budgets').insert({ event_id: eventId, name: name.trim() || 'Смета', is_primary: primary, settings }).select().single();
  check(error); return data;
}
export async function renameEventBudget(id: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error('Укажите название сметы');
  const { error } = await supabase.from('event_budgets').update({ name: name.trim() }).eq('id', id).select('id').single(); check(error);
}
export async function deleteEventBudget(id: string): Promise<void> {
  const { error } = await supabase.from('event_budgets').delete().eq('id', id); check(error);
}
export async function getBudgetEvent(eventId: string, budgetId: string): Promise<Event> {
  const event = await getEvent(eventId);
  const { data, error } = await supabase.from('event_budgets').select('*').eq('event_id', eventId).eq('id', budgetId).single();
  check(error); return { ...event, ...data.settings, equipment_shipped: false, equipment_shipped_at: undefined, equipment_returned: false, equipment_returned_at: undefined, specification_confirmed: false, specification_confirmed_at: undefined, specification_confirmed_by: undefined, ...data.specification_state, id: event.id };
}
export async function updateBudgetEvent(eventId: string, budgetId: string, patch: Partial<Event>): Promise<Event> {
  const settings = Object.fromEntries(Object.entries(patch).filter(([key]) => settingsKeys.includes(key)));
  const global = Object.fromEntries(Object.entries(patch).filter(([key]) => !settingsKeys.includes(key)));
  if (Object.keys(settings).length) {
    const { error } = await supabase.rpc('update_event_budget_settings', { p_event_id: eventId, p_budget_id: budgetId, p_patch: settings }); check(error);
  }
  if (Object.keys(global).length) {
    if ('progress_equipment_reserved' in global) global.status = global.progress_equipment_reserved ? 'Подтверждено' : 'Запрос';
    await updateEvent(eventId, global);
  }
  return getBudgetEvent(eventId, budgetId);
}
export async function updateBudgetSpecification(eventId: string, budgetId: string, patch: Partial<Event>): Promise<void> {
  const { error } = await supabase.rpc('update_event_budget_specification', { p_event_id: eventId, p_budget_id: budgetId, p_patch: patch }); check(error);
}

/** Copy into a new document in one database transaction. Existing budgets are never a target. */
export async function copyEventBudget(sourceBudgetId: string, targetEventId: string, name?: string): Promise<string> {
  const { data, error } = await supabase.rpc('copy_event_budget', {
    p_source_budget_id: sourceBudgetId, p_target_event_id: targetEventId, p_name: name?.trim() || null
  });
  if (error?.code === 'PGRST202') throw new Error('Для копирования в новую смету выполните миграцию 20261029030000_copy_event_budget.sql.');
  check(error); return data;
}
