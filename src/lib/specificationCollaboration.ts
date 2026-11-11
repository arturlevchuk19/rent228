import { supabase } from './supabase';

export interface RowMark { row_key: string; picked: boolean; return_picked: boolean; }
export interface SharedRow { id: string; picked?: boolean; return_picked?: boolean; [key: string]: unknown; }
export interface CollaborationSnapshot {
  equipment: SharedRow[]; cables: SharedRow[]; connectors: SharedRow[]; other: SharedRow[];
  marks: RowMark[]; state: Record<string, unknown>;
}
export const sharedSpecificationTables = ['warehouse_specification_budget_items', 'warehouse_specification_cables', 'warehouse_specification_connectors', 'warehouse_specification_other', 'specification_row_marks'] as const;
export async function getCollaborationSnapshot(eventId: string, budgetId: string): Promise<CollaborationSnapshot> {
  const results = await Promise.all([
    ...sharedSpecificationTables.map(table => supabase.from(table).select('*').eq('event_id', eventId).eq('budget_id', budgetId)),
    supabase.from('event_budgets').select('specification_state').eq('event_id', eventId).eq('id', budgetId).single(),
  ]);
  for (const result of results) if (result.error) throw result.error;
  return { equipment: results[0].data as unknown as SharedRow[], cables: results[1].data as unknown as SharedRow[], connectors: results[2].data as unknown as SharedRow[], other: results[3].data as unknown as SharedRow[], marks: results[4].data as unknown as RowMark[], state: (results[5].data as unknown as {specification_state: Record<string, unknown>}).specification_state || {} };
}

/** Ignore checkbox metadata when deciding whether a full structural refresh is needed. */
export function specificationStructureKey(snapshot: CollaborationSnapshot): string {
  const tables = [snapshot.equipment, snapshot.cables, snapshot.connectors, snapshot.other];
  return JSON.stringify(tables.map(rows => [...rows]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(row => Object.fromEntries(Object.entries(row)
      .filter(([key]) => !['picked', 'return_picked', 'updated_at', 'equipment', 'work_item', 'location'].includes(key))
      .sort(([a], [b]) => a.localeCompare(b))))));
}
export function mergeSharedMarks<T extends { picked?: boolean; return_picked?: boolean }>(rows: T[], shared: {id: string; picked?: boolean; return_picked?: boolean}[], identify: (row: T) => string): T[] {
  const byId = new Map(shared.map(row => [row.id, row]));
  return rows.map(row => { const remote = byId.get(identify(row)); return remote ? { ...row, picked: remote.picked ?? false, return_picked: remote.return_picked ?? false } : row; });
}
export async function saveGeneratedRowMark(eventId: string, budgetId: string, parentId: string, rowKey: string, field: 'picked' | 'return_picked', value: boolean, label: string) {
  const { error } = await supabase.rpc('set_specification_row_mark', { p_event_id: eventId, p_budget_id: budgetId, p_parent_id: parentId, p_row_key: rowKey, p_field: field, p_value: value, p_label: label });
  if (error) throw error;
}

export interface SpecificationActivity {
  id: number; actor_name: string; row_name: string; action: 'insert' | 'update' | 'delete';
  changes: Record<string, {old: unknown; new: unknown}>; created_at: string;
}
export async function getSpecificationActivity(eventId: string, budgetId: string, before?: number): Promise<SpecificationActivity[]> {
  let query = supabase.from('specification_activity').select('id,actor_name,row_name,action,changes,created_at').eq('event_id', eventId).eq('budget_id', budgetId).order('id', { ascending: false }).limit(50);
  if (before !== undefined) query = query.lt('id', before);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
const fields: Record<string, string> = {quantity:'Количество',notes:'Примечание',name:'Название',price:'Цена',total:'Стоимость',equipment_id:'Оборудование',modification_id:'Модификация',location_id:'Локация',category_id:'Категория',component_selection:'Комплектация',excluded_child_keys:'Исключённые элементы',spec_sticky_notes:'Заметки',specification_confirmed:'Подтверждение спецификации',equipment_shipped:'Отгрузка',equipment_returned:'Возврат',unit:'Единица измерения',sku:'Артикул',sort_order:'Порядок',is_extra:'Добор',cable_type:'Тип кабеля',cable_length:'Длина кабеля',connector_type:'Тип коннектора',connector_item:'Коннектор',item_type:'Тип позиции',category:'Категория'};
const display = (value: unknown): string => value == null || value === '' ? '—' : typeof value === 'boolean' ? value ? 'да' : 'нет' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function activityDescription(entry: SpecificationActivity): string[] {
  if (entry.action === 'delete') return ['Удалил позицию'];
  const lines = entry.action === 'insert' ? ['Добавил позицию'] : [];
  for (const [field, change] of Object.entries(entry.changes)) {
    if (entry.action === 'insert' && ['picked','return_picked'].includes(field) && !change.new) continue;
    if (field === 'picked') lines.push(change.new ? 'Отметил выдачу' : 'Снял отметку выдачи');
    else if (field === 'return_picked') lines.push(change.new ? 'Отметил возврат' : 'Снял отметку возврата');
    else if (field === 'excluded_child_keys') lines.push('Изменил список исключённых элементов');
    else if (field === 'spec_sticky_notes') lines.push('Изменил заметки спецификации');
    else if (fields[field] && field.endsWith('_id')) lines.push(`Изменил: ${fields[field].toLowerCase()}`);
    else if (fields[field]) lines.push(`${fields[field]}: ${display(change.old)} → ${display(change.new)}`);
  }
  return lines.length ? lines : ['Изменил параметры позиции'];
}
