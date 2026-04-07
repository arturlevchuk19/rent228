import { supabase } from './supabase';
import type { BudgetItem } from './events';

export interface CableItem {
  id: string;
  event_id: string;
  cable_type: string;
  cable_length: string;
  quantity: number;
  notes: string;
  picked: boolean;
  return_picked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectorItem {
  id: string;
  event_id: string;
  connector_type: string;
  quantity: number;
  notes: string;
  picked: boolean;
  return_picked: boolean;
  created_at: string;
  updated_at: string;
}

export interface OtherItem {
  id: string;
  event_id: string;
  category: string;
  item_type: string;
  quantity: number;
  notes: string;
  picked: boolean;
  return_picked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CableTemplate {
  type: string;
  lengths: string[];
}

export const CABLE_TEMPLATES: CableTemplate[] = [
  {
    type: 'PowerCON 5м - 30м',
    lengths: ['15м', '20м', '25м', '30м']
  },
  {
    type: 'PowerCON 1м - 10м',
    lengths: ['1м (10шт)', '2м (5шт)', '3м (8шт)', '5м', '10м']
  },
   {
    type: 'PowerCON SHUKO 1,5м - 3,5м',
    lengths: ['1.5м (4шт)', '2.5м (4шт)', '3.5м']
  },
  {
    type: 'DMX 1м - 10м',
    lengths: ['1м (10шт)', '2м (5шт)', '5м', '10м']
  },
  {
    type: 'XLR 0.5м - 10м',
    lengths: ['0.5м (12шт)', '1м (10шт)', '2м (10шт)', '5м', '10м']
  },
  {
    type: 'LAN 5м - 100м',
    lengths: ['5м', '10м', '15м', '15м 2CH', '20м', '20м 2CH', '50м 2CH', '100м']
  },
  {
    type: 'MULTICORE',
    lengths: ['LAN 4CH 15м', 'LAN 4CH 20м', 'LAN 4CH 30m', 'XLR 6CH 10м', 'XLR 8CH 15м']
  },
  {
    type: 'SCREEN',
    lengths: ['powercon 1.2м (10шт)', 'ethernet 1.2м (10шт)','powercon 2м (10шт)','ethernet 2м (10шт)']
  },
  {
    type: 'Удлинители',
    lengths: ['1м', '5м', '10м']
  },
  {
    type: 'Оптика',
    lengths: ['100м', '70м', 'HDMI OPTICAL EXTENDER','ETHERNET OPTICAL EXTENDER']
  }
];

export interface ConnectorTemplate {
  category: string;
  items: string[];
}

export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    category: 'Коннекторы',
    items: ['Сплиттер X6', 'Карабулька X2', 'Состыковка','Брейк PowerCon-Shuko']
  },
  {
    category: 'Силовые Брейки',
    items: ['16А - PowerCON', '32А - Shuko', '32А тройник', 'HARTING - PowerCON']
  },
   {
    category: 'Кабель 16А',
    items: ['Хвост','Переход 32А-16А','4м', '5м', '10м','15м','20м','25м']
  },
  {
    category: 'Кабель 32А',
    items: ['Хвост','Переход 16А-32А', '5м', '10м', '20м','30м', '50м']
  },
   {
    category: 'Лебёдочные',
    items: ['5м','10м', '15м', '20м', '25м','30м', '40м']
  }
];

export interface OtherTemplate {
  category: string;
  items: string[];
}

export const OTHER_TEMPLATES: OtherTemplate[] = [
  {
    category: 'Инструменталка',
    items: ['Инструменталка большая', 'Инструменталка мелкая']
  },
  {
    category: 'Clamp',
    items: ['Clamp Black X1', 'Clamp Black X2', 'Clamp Silver X1', 'Clamp Silver X2']
  },
  {
    category: 'Ремешки',
    items: ['1м', '2м', '3м']
  },
  {
     category: 'Доски',
    items: ['Большие', 'Маленькие', 'Глянцевые']
  }
];

export async function getCables(eventId: string): Promise<CableItem[]> {
  const { data, error } = await supabase
    .from('warehouse_specification_cables')
    .select('*')
    .eq('event_id', eventId)
    .order('cable_type')
    .order('cable_length');

  if (error) throw error;
  return data || [];
}

export async function createCable(cable: Omit<CableItem, 'id' | 'created_at' | 'updated_at'>): Promise<CableItem> {
  const { picked, ...insertCable } = cable;
  const { data, error } = await supabase
    .from('warehouse_specification_cables')
    .insert(insertCable)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCable(id: string, updates: Partial<CableItem>): Promise<CableItem> {
  const { data, error } = await supabase
    .from('warehouse_specification_cables')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCableReturnPicked(id: string, return_picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_cables')
    .update({ return_picked, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCable(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_cables')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getConnectors(eventId: string): Promise<ConnectorItem[]> {
  const { data, error } = await supabase
    .from('warehouse_specification_connectors')
    .select('*')
    .eq('event_id', eventId)
    .order('connector_type');

  if (error) throw error;
  return data || [];
}

export async function createConnector(connector: Omit<ConnectorItem, 'id' | 'created_at' | 'updated_at'>): Promise<ConnectorItem> {
  const { picked, ...insertConnector } = connector;
  const { data, error } = await supabase
    .from('warehouse_specification_connectors')
    .insert(insertConnector)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConnector(id: string, updates: Partial<ConnectorItem>): Promise<ConnectorItem> {
  const { data, error } = await supabase
    .from('warehouse_specification_connectors')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConnectorReturnPicked(id: string, return_picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_connectors')
    .update({ return_picked, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteConnector(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_connectors')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getOtherItems(eventId: string): Promise<OtherItem[]> {
  const { data, error } = await supabase
    .from('warehouse_specification_other')
    .select('*')
    .eq('event_id', eventId)
    .order('category, item_type');

  if (error) throw error;
  return data || [];
}

export async function createOtherItem(item: Omit<OtherItem, 'id' | 'created_at' | 'updated_at'>): Promise<OtherItem> {
  const { picked, ...insertItem } = item;
  const { data, error } = await supabase
    .from('warehouse_specification_other')
    .insert(insertItem)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOtherItem(id: string, updates: Partial<OtherItem>): Promise<OtherItem> {
  const { data, error } = await supabase
    .from('warehouse_specification_other')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateOtherItemReturnPicked(id: string, return_picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_other')
    .update({ return_picked, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOtherItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_other')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

const SPEC_BUDGET_ITEM_BASE_SELECT = `
  *,
  multi_day_rate_override,
  equipment:equipment_items (*),
  work_item:work_items (*)
`;

const SPEC_BUDGET_ITEM_SELECT_WITH_LOCATION = `
  ${SPEC_BUDGET_ITEM_BASE_SELECT},
  location:locations (*)
`;

function isMissingSpecLocationRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error) || !('message' in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? '';
  return code === 'PGRST200' && message.includes('warehouse_specification_budget_items') && message.includes('locations');
}

export async function getSpecificationBudgetItems(eventId: string): Promise<BudgetItem[]> {
  const query = () => supabase
    .from('warehouse_specification_budget_items')
    .select(SPEC_BUDGET_ITEM_SELECT_WITH_LOCATION)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const { data, error } = await query();

  if (error && isMissingSpecLocationRelation(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('warehouse_specification_budget_items')
      .select(SPEC_BUDGET_ITEM_BASE_SELECT)
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (fallbackError) throw fallbackError;
    return fallbackData || [];
  }

  if (error) throw error;
  return data || [];
}

export async function createSpecificationBudgetItem(item: Partial<BudgetItem>): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('warehouse_specification_budget_items')
    .insert(item)
    .select(SPEC_BUDGET_ITEM_BASE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSpecificationBudgetItem(id: string, item: Partial<BudgetItem>): Promise<BudgetItem> {
  const { data, error } = await supabase
    .from('warehouse_specification_budget_items')
    .update(item)
    .eq('id', id)
    .select(SPEC_BUDGET_ITEM_BASE_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateSpecificationBudgetItemPicked(id: string, picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_budget_items')
    .update({ picked, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function updateSpecificationBudgetItemReturnPicked(id: string, return_picked: boolean): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_budget_items')
    .update({ return_picked, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteSpecificationBudgetItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_budget_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function ensureWarehouseSpecificationSnapshot(eventId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('warehouse_specification_budget_items')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (countError) throw countError;
  if ((count || 0) > 0) return;

  const { data: budgetItems, error: budgetError } = await supabase
    .from('budget_items')
    .select('*')
    .eq('event_id', eventId)
    .eq('item_type', 'equipment')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (budgetError) throw budgetError;
  if (!budgetItems || budgetItems.length === 0) return;

  const parentRows = budgetItems.filter(item => !item.parent_budget_item_id);
  const childRows = budgetItems.filter(item => item.parent_budget_item_id);
  const sourceToSpecId = new Map<string, string>();

  for (const source of parentRows) {
    const { data: created, error: createError } = await supabase
      .from('warehouse_specification_budget_items')
      .insert({
        event_id: source.event_id,
        source_budget_item_id: source.id,
        parent_budget_item_id: null,
        item_type: source.item_type,
        equipment_id: source.equipment_id,
        modification_id: source.modification_id,
        work_item_id: source.work_item_id,
        quantity: source.quantity,
        price: source.price,
        total: source.total,
        notes: source.notes || '',
        exchange_rate: source.exchange_rate ?? 1,
        multi_day_rate_override: source.multi_day_rate_override ?? null,
        category_id: source.category_id,
        location_id: source.location_id,
        sort_order: source.sort_order ?? 0,
        picked: source.picked ?? false,
        return_picked: source.return_picked ?? false,
        is_extra: source.is_extra ?? false,
        name: source.name,
        sku: source.sku
      })
      .select('id, source_budget_item_id')
      .single();

    if (createError) throw createError;
    sourceToSpecId.set(created.source_budget_item_id, created.id);
  }

  for (const source of childRows) {
    const parentSpecId = source.parent_budget_item_id ? sourceToSpecId.get(source.parent_budget_item_id) : null;
    const { data: created, error: createError } = await supabase
      .from('warehouse_specification_budget_items')
      .insert({
        event_id: source.event_id,
        source_budget_item_id: source.id,
        parent_budget_item_id: parentSpecId || null,
        item_type: source.item_type,
        equipment_id: source.equipment_id,
        modification_id: source.modification_id,
        work_item_id: source.work_item_id,
        quantity: source.quantity,
        price: source.price,
        total: source.total,
        notes: source.notes || '',
        exchange_rate: source.exchange_rate ?? 1,
        multi_day_rate_override: source.multi_day_rate_override ?? null,
        category_id: source.category_id,
        location_id: source.location_id,
        sort_order: source.sort_order ?? 0,
        picked: source.picked ?? false,
        return_picked: source.return_picked ?? false,
        is_extra: source.is_extra ?? false,
        name: source.name,
        sku: source.sku
      })
      .select('id, source_budget_item_id')
      .single();

    if (createError) throw createError;
    sourceToSpecId.set(created.source_budget_item_id, created.id);
  }
}

export async function resetWarehouseSpecificationSnapshot(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_budget_items')
    .delete()
    .eq('event_id', eventId);

  if (error) throw error;

  await ensureWarehouseSpecificationSnapshot(eventId);
}
