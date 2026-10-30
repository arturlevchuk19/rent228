import type { BudgetItem } from './events';

export function getBudgetItemUnit(item: BudgetItem): string {
  return item.unit?.trim() || (item.item_type === 'work' ? item.work_item?.unit : item.equipment?.unit) || (item.item_type === 'work' ? 'усл.' : 'шт.');
}

// Old warehouse snapshots have no unit column. Resolve their source position's
// unit, including a per-estimate override, instead of defaulting to pieces.
export function withBudgetUnits(specification: BudgetItem[], budget: BudgetItem[]): BudgetItem[] {
  const source = new Map(budget.map(item => [item.id, item]));
  return specification.map(item => {
    const original = source.get(item.source_budget_item_id || item.id);
    return { ...item, unit: getBudgetItemUnit(original || item) };
  });
}
