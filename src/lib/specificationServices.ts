import type { BudgetItem } from './events';

// Services stay linked to the estimate; warehouse equipment is edited independently.
export function getSpecificationServices(items: BudgetItem[]) {
  return items.filter(item => item.item_type === 'work' && item.quantity > 0).map(item => ({
    id: item.id,
    name: item.name || item.work_item?.name || 'Дополнительная услуга',
    quantity: item.quantity,
    unit: item.work_item?.unit || 'усл.',
    notes: item.notes || '',
  }));
}

export function specificationDiffersFromBudget(budget: BudgetItem[], specification: BudgetItem[]): boolean {
  const source = budget.filter(item => item.item_type === 'equipment' && item.quantity > 0);
  const saved = specification.filter(item => item.item_type === 'equipment') as (BudgetItem & { source_budget_item_id?: string | null })[];
  const linked = new Map(saved.flatMap(item => item.source_budget_item_id ? [[item.source_budget_item_id, item] as const] : []));
  const ids = new Set(source.map(item => item.id));
  return source.some(item => {
    const row = linked.get(item.id);
    return !row || Number(row.quantity) !== Number(item.quantity) || row.equipment_id !== item.equipment_id || row.modification_id !== item.modification_id;
  }) || [...linked.keys()].some(id => !ids.has(id));
}
