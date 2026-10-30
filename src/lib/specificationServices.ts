import type { BudgetItem } from './events';

export const specificationIsEditable = (status?: string) => status === 'Подтверждено' || status === 'Выполнено';
export const isBudgetSpecificationItem = (item: BudgetItem, extraCategories: Set<string>) => item.item_type === 'equipment' || !!(item.category_id && extraCategories.has(item.category_id));
export const budgetSpecificationPreview = (items: BudgetItem[]) => items.map(item => ({ ...item, source_budget_item_id: item.id, picked: false, return_picked: false }));
export interface SpecificationDifference { sourceId: string; name: string; kind: 'add' | 'update' | 'remove'; source?: BudgetItem; saved?: BudgetItem; }
export function getSpecificationDifferences(budget: BudgetItem[], specification: BudgetItem[]): SpecificationDifference[] {
  const linked = new Map(specification.flatMap(item => item.source_budget_item_id ? [[item.source_budget_item_id, item] as const] : []));
  const ids = new Set(budget.map(item => item.id));
  const result: SpecificationDifference[] = [];
  for (const source of budget) {
    const saved = linked.get(source.id);
    const name = source.name || source.equipment?.name || source.work_item?.name || 'Позиция';
    if (!saved) result.push({ sourceId: source.id, name, kind: 'add', source });
    else if (['quantity','equipment_id','modification_id','category_id','location_id','name'].some(key => (saved[key as keyof BudgetItem] ?? null) !== (source[key as keyof BudgetItem] ?? null))) result.push({ sourceId: source.id, name, kind: 'update', source, saved });
  }
  for (const [sourceId, saved] of linked) if (!ids.has(sourceId)) result.push({ sourceId, name: saved.name || saved.equipment?.name || saved.work_item?.name || 'Позиция', kind: 'remove', saved });
  return result;
}
export const specificationDiffersFromBudget = (budget: BudgetItem[], specification: BudgetItem[]) => getSpecificationDifferences(budget, specification).length > 0;
