import type { BudgetItem, Event } from './events';

export const BUDGET_MARKER_COLORS = ['#fef08a', '#fdba74', '#ef4444', '#86efac', '#7dd3fc', '#c4b5fd'] as const;

export interface BudgetCoefficientGroup {
  id: string;
  name: string;
  coefficient: number;
  color: string | null;
  itemIds: string[];
}

export function isBudgetCoefficientGroupList(value: unknown): value is BudgetCoefficientGroup[] {
  return Array.isArray(value) && value.every(group =>
    group && typeof group.id === 'string' && typeof group.name === 'string' &&
    Number.isFinite(group.coefficient) && group.coefficient >= 0 &&
    (group.color === null || BUDGET_MARKER_COLORS.some(color => color === group.color)) &&
    Array.isArray(group.itemIds) && group.itemIds.every((id: unknown) => typeof id === 'string'));
}

export function indexBudgetCoefficientGroups(groups: BudgetCoefficientGroup[]) {
  return new Map(groups.flatMap(group => group.itemIds.map(id => [id, group] as const)));
}

export function getEffectiveBudgetItems(items: BudgetItem[], settings: Partial<Event>) {
  if (!settings.budget_dynamic_coefficients) return items;
  const groups = isBudgetCoefficientGroupList(settings.budget_coefficient_groups) ? settings.budget_coefficient_groups : [];
  const groupsByItem = indexBudgetCoefficientGroups(groups);
  return items.map(item => ({ ...item, dynamic_coefficient: groupsByItem.get(item.id)?.coefficient ?? 0 }));
}
