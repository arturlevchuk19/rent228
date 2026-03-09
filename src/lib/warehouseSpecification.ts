import { supabase } from './supabase';

export interface CableItem {
  id: string;
  event_id: string;
  cable_type: string;
  cable_length: string;
  quantity: number;
  notes: string;
  picked: boolean;
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

export async function deleteOtherItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('warehouse_specification_other')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
